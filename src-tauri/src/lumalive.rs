use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const FIRST_PORT: u16 = 7878;
const LAST_PORT: u16 = 7897;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LumaLiveEndpoint {
    pub base_url: String,
    pub version: String,
    pub bridge_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LumaLiveState {
    pub bridge_connected: bool,
    pub playing: bool,
    pub tempo: f64,
    pub current_song_time: f64,
    pub current_song_id: Option<String>,
    pub current_song_title: Option<String>,
    pub current_section_id: Option<String>,
    pub current_section_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LumaLivePairRequest {
    pub base_url: String,
    pub code: String,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LumaLivePairResult {
    pub base_url: String,
    pub token: String,
}

fn client(timeout_ms: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|error| error.to_string())
}

fn clean_base_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("LumaLive address is required.".to_string());
    }
    if !trimmed.starts_with("http://127.0.0.1:")
        && !trimmed.starts_with("http://localhost:")
        && !trimmed.starts_with("http://[::1]:")
    {
        return Err("LumaLive desktop linking is restricted to this computer.".to_string());
    }
    Ok(trimmed.to_string())
}

async fn probe(base_url: &str) -> Result<LumaLiveEndpoint, String> {
    let response = client(350)?
        .get(format!("{base_url}/health"))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("LumaLive health returned HTTP {}.", response.status()));
    }
    let payload: Value = response.json().await.map_err(|error| error.to_string())?;
    if payload.get("product").and_then(Value::as_str) != Some("luma-live") {
        return Err("That endpoint is not LumaLive.".to_string());
    }
    Ok(LumaLiveEndpoint {
        base_url: base_url.to_string(),
        version: payload.get("version").and_then(Value::as_str).unwrap_or("unknown").to_string(),
        bridge_port: payload.get("bridgePort").and_then(Value::as_u64).map(|value| value as u16),
    })
}

#[tauri::command]
pub async fn scan_lumalive() -> Result<Option<LumaLiveEndpoint>, String> {
    for port in FIRST_PORT..=LAST_PORT {
        let base_url = format!("http://127.0.0.1:{port}");
        if let Ok(endpoint) = probe(&base_url).await {
            return Ok(Some(endpoint));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn pair_lumalive(request: LumaLivePairRequest) -> Result<LumaLivePairResult, String> {
    let base_url = clean_base_url(&request.base_url)?;
    let code = request.code.trim();
    if code.len() != 6 || !code.bytes().all(|value| value.is_ascii_digit()) {
        return Err("Enter LumaLive's six-digit pairing code.".to_string());
    }
    let response = client(1500)?
        .post(format!("{base_url}/api/pair"))
        .json(&json!({
            "code": code,
            "deviceName": request.device_name.trim()
        }))
        .send()
        .await
        .map_err(|error| format!("LumaLive pairing failed: {error}"))?;
    let status = response.status();
    let payload: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(payload.get("error").and_then(Value::as_str).unwrap_or("LumaLive pairing was rejected.").to_string());
    }
    let token = payload.get("token").and_then(Value::as_str).filter(|value| !value.is_empty())
        .ok_or("LumaLive pairing returned no token.")?;
    Ok(LumaLivePairResult { base_url, token: token.to_string() })
}

fn extract_live_context_text(payload: &Value, field: &str) -> Option<String> {
    payload.get("liveContext")
        .and_then(|value| value.get(field))
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[tauri::command]
pub async fn lumalive_state(base_url: String, token: String) -> Result<LumaLiveState, String> {
    let base_url = clean_base_url(&base_url)?;
    if token.trim().is_empty() {
        return Err("Pair LumaLive before reading transport state.".to_string());
    }
    let response = client(1000)?
        .get(format!("{base_url}/api/state"))
        .header("x-luma-token", token.trim())
        .send()
        .await
        .map_err(|error| format!("LumaLive state unavailable: {error}"))?;
    let status = response.status();
    let payload: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(payload.get("error").and_then(Value::as_str).unwrap_or("LumaLive state request failed.").to_string());
    }
    let state = payload.get("state").unwrap_or(&payload);
    Ok(LumaLiveState {
        bridge_connected: state.get("bridgeConnected").and_then(Value::as_bool).unwrap_or(false),
        playing: state.get("isPlaying").and_then(Value::as_bool).unwrap_or(false),
        tempo: state.get("tempo").and_then(Value::as_f64).unwrap_or(120.0),
        current_song_time: state.get("currentSongTime").and_then(Value::as_f64).unwrap_or(0.0).max(0.0),
        current_song_id: extract_live_context_text(state, "songId"),
        current_song_title: extract_live_context_text(state, "songTitle"),
        current_section_id: extract_live_context_text(state, "sectionId"),
        current_section_name: extract_live_context_text(state, "sectionName"),
    })
}

#[tauri::command]
pub async fn lumalive_command(base_url: String, token: String, command: Value) -> Result<Value, String> {
    let base_url = clean_base_url(&base_url)?;
    if token.trim().is_empty() {
        return Err("Pair LumaLive before sending transport commands.".to_string());
    }
    let response = client(1500)?
        .post(format!("{base_url}/api/direct"))
        .header("x-luma-token", token.trim())
        .json(&json!({ "command": command }))
        .send()
        .await
        .map_err(|error| format!("LumaLive command failed: {error}"))?;
    let status = response.status();
    let payload: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(payload.get("error").and_then(Value::as_str).unwrap_or("LumaLive command was rejected.").to_string());
    }
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restricts_desktop_bridge_to_loopback() {
        assert_eq!(clean_base_url("http://127.0.0.1:7878/").unwrap(), "http://127.0.0.1:7878");
        assert!(clean_base_url("http://localhost:7878").is_ok());
        assert!(clean_base_url("http://192.168.1.22:7878").is_err());
        assert!(clean_base_url("https://example.com").is_err());
    }
}
