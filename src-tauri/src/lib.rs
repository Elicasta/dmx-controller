mod dmx;
mod midi;
mod output;
mod studio_bridge;
mod updates;

use dmx::{DmxEngine, DmxStatus};
use midi::{MidiEngine, MidiEvent, MidiInputInfo, MidiStatus};
use output::{artnet::ArtNetEngine, lumaviz_direct::LumaVizDirectEngine, udmx::UdmxDeviceInfo};
use studio_bridge::{StudioBridge, StudioBridgeEnvelope, StudioBridgeResponse, StudioBridgeStatus};
use tauri::{Manager, State};
use std::fs;

#[tauri::command]
fn list_udmx_devices(engine: State<'_, DmxEngine>) -> Result<Vec<UdmxDeviceInfo>, String> {
    engine.list_devices()
}

#[tauri::command]
fn connect_dmx(engine: State<'_, DmxEngine>, device_key: String) -> Result<(), String> {
    engine.connect(device_key)
}

#[tauri::command]
fn disconnect_dmx(engine: State<'_, DmxEngine>) -> Result<(), String> {
    engine.disconnect()
}

#[tauri::command]
fn set_channel(engine: State<'_, DmxEngine>, channel: usize, value: u8) -> Result<(), String> {
    engine.set_channel(channel, value)
}

#[tauri::command]
fn set_universe(engine: State<'_, DmxEngine>, values: Vec<u8>) -> Result<(), String> {
    engine.set_universe(values)
}

#[tauri::command]
fn set_blackout(engine: State<'_, DmxEngine>, enabled: bool) -> Result<(), String> {
    engine.set_blackout(enabled)
}

#[tauri::command]
fn dmx_status(engine: State<'_, DmxEngine>) -> DmxStatus {
    engine.status()
}

#[tauri::command]
fn list_midi_inputs(engine: State<'_, MidiEngine>) -> Result<Vec<MidiInputInfo>, String> {
    engine.list_inputs()
}

#[tauri::command]
fn connect_midi(engine: State<'_, MidiEngine>, input_id: usize) -> Result<(), String> {
    engine.connect(input_id)
}

#[tauri::command]
fn disconnect_midi(engine: State<'_, MidiEngine>) -> Result<(), String> {
    engine.disconnect()
}

#[tauri::command]
fn midi_status(engine: State<'_, MidiEngine>) -> MidiStatus {
    engine.status()
}

#[tauri::command]
fn drain_midi_events(engine: State<'_, MidiEngine>) -> Vec<MidiEvent> {
    engine.drain_events()
}


#[tauri::command]
fn studio_bridge_status(bridge: State<'_, StudioBridge>) -> StudioBridgeStatus {
    bridge.status()
}

#[tauri::command]
fn drain_studio_bridge(bridge: State<'_, StudioBridge>) -> Vec<StudioBridgeEnvelope> {
    bridge.drain()
}

#[tauri::command]
fn reply_studio_bridge(
    bridge: State<'_, StudioBridge>,
    id: String,
    ok: bool,
    error: Option<String>,
    payload: Option<serde_json::Value>,
) -> Result<(), String> {
    bridge.reply(StudioBridgeResponse { id, ok, error, payload })
}

#[tauri::command]
fn save_show_library(app: tauri::AppHandle, library: serde_json::Value) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("Show Library");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("library.json");
    let bytes = serde_json::to_vec_pretty(&library).map_err(|e| e.to_string())?;
    let tmp = dir.join("library.json.tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_show_library_folder(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("Show Library");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&dir).spawn().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DmxEngine::new())
        .manage(ArtNetEngine::default())
        .manage(LumaVizDirectEngine::default())
        .manage(StudioBridge::new())
        .manage(MidiEngine::new())
        .manage(updates::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            list_udmx_devices,
            connect_dmx,
            disconnect_dmx,
            set_channel,
            set_universe,
            set_blackout,
            dmx_status,
            output::artnet::send_artnet_frame,
            output::lumaviz_direct::start_lumaviz_direct,
            output::lumaviz_direct::lumaviz_direct_status,
            output::lumaviz_direct::send_lumaviz_fixture_frame,
            output::lumaviz_direct::poll_lumaviz_direct_messages,
            output::lumaviz_direct::send_lumaviz_direct_message,
            studio_bridge_status,
            drain_studio_bridge,
            reply_studio_bridge,
            list_midi_inputs,
            connect_midi,
            disconnect_midi,
            midi_status,
            drain_midi_events,
            updates::app_version,
            updates::check_for_update,
            updates::install_update,
            save_show_library,
            open_show_library_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running DMX Controller");
}
