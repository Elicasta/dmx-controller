use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProPresenterStatus {
    pub base_url: String,
    pub version: Value,
    pub slide: Value,
    pub active_presentation: Value,
    pub presentation_transport: Value,
}

fn clean_base_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("ProPresenter API address is required.".to_string());
    }
    if !trimmed.starts_with("http://127.0.0.1:")
        && !trimmed.starts_with("http://localhost:")
        && !trimmed.starts_with("http://[::1]:")
    {
        return Err("This ProPresenter adapter currently supports the same computer only.".to_string());
    }
    Ok(trimmed.to_string())
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_millis(1000))
        .build()
        .map_err(|error| error.to_string())
}

async fn get_json(base_url: &str, path: &str) -> Result<Value, String> {
    let response = client()?
        .get(format!("{base_url}{path}"))
        .send()
        .await
        .map_err(|error| format!("ProPresenter API unavailable: {error}"))?;
    let status = response.status();
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("ProPresenter returned HTTP {status} for {path}."));
    }
    if bytes.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&bytes).map_err(|error| format!("ProPresenter returned invalid JSON for {path}: {error}"))
}

#[tauri::command]
pub async fn propresenter_status(base_url: String) -> Result<ProPresenterStatus, String> {
    let base_url = clean_base_url(&base_url)?;
    let version = get_json(&base_url, "/version").await?;
    let slide = get_json(&base_url, "/v1/status/slide").await.unwrap_or(Value::Null);
    let active_presentation = get_json(&base_url, "/v1/presentation/active").await.unwrap_or(Value::Null);
    let presentation_transport = get_json(&base_url, "/v1/transport/presentation/time").await.unwrap_or(Value::Null);
    Ok(ProPresenterStatus {
        base_url,
        version,
        slide,
        active_presentation,
        presentation_transport,
    })
}

#[tauri::command]
pub async fn propresenter_command(base_url: String, operation: String) -> Result<Value, String> {
    let base_url = clean_base_url(&base_url)?;
    let path = match operation.as_str() {
        "next" => "/v1/presentation/active/next/trigger",
        "previous" => "/v1/presentation/active/previous/trigger",
        "retrigger" => "/v1/presentation/active/trigger",
        "play" => "/v1/transport/presentation/play",
        "pause" => "/v1/transport/presentation/pause",
        "timeline-play" => "/v1/presentation/active/timeline/play",
        "timeline-pause" => "/v1/presentation/active/timeline/pause",
        "timeline-rewind" => "/v1/presentation/active/timeline/rewind",
        _ => return Err("Unsupported ProPresenter control operation.".to_string()),
    };
    get_json(&base_url, path).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_propresenter_control_local_by_default() {
        assert!(clean_base_url("http://127.0.0.1:50001").is_ok());
        assert!(clean_base_url("http://localhost:50001/").is_ok());
        assert!(clean_base_url("http://10.0.0.25:50001").is_err());
        assert!(clean_base_url("https://example.com").is_err());
    }
}
