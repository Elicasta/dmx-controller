mod dmx;
mod midi;
mod media_library;
mod output;
mod studio_bridge;
mod updates;
mod video_export;

use dmx::{DmxEngine, DmxStatus};
use midi::{MidiEngine, MidiEvent, MidiInputInfo, MidiStatus};
use output::{artnet::ArtNetEngine, lumaviz_direct::LumaVizDirectEngine, udmx::UdmxDeviceInfo};
use studio_bridge::{StudioBridge, StudioBridgeEnvelope, StudioBridgeResponse, StudioBridgeStatus};
use tauri::{State, Manager};

#[tauri::command]
fn open_media_output(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("media-output") {
        return window.set_focus().map_err(|e| e.to_string());
    }
    tauri::WebviewWindowBuilder::new(&app, "media-output", tauri::WebviewUrl::App("index.html?media-output=1".into()))
        .title("LumaRig · Video Output")
        .inner_size(1280.0, 720.0)
        .min_inner_size(320.0, 180.0)
        .build().map(|_| ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn toggle_media_output_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("media-output").ok_or("Video output is not open.")?;
    let fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!fullscreen).map_err(|e| e.to_string())
}
#[tauri::command]
fn open_stage_monitor(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("stage-monitor") {
        return window.set_focus().map_err(|e| e.to_string());
    }
    tauri::WebviewWindowBuilder::new(&app, "stage-monitor", tauri::WebviewUrl::App("index.html?stage-monitor=1".into()))
        .title("LumaRig · Visualizer")
        .inner_size(1280.0, 800.0)
        .min_inner_size(720.0, 480.0)
        .build().map(|_| ()).map_err(|e| e.to_string())
}


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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(DmxEngine::new())
        .manage(media_library::MediaLibraryState::default())
        .manage(ArtNetEngine::default())
        .manage(LumaVizDirectEngine::default())
        .manage(StudioBridge::new())
        .manage(MidiEngine::new())
        .manage(updates::UpdateState::default())
        .setup(|app| {
            if let Err(error) = media_library::restore_asset_scopes(app.handle()) {
                eprintln!("media scope restore warning: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_stage_monitor,
            media_library::media_library_snapshot,
            media_library::media_create_folder,
            media_library::media_rename_folder,
            media_library::media_delete_folder,
            media_library::media_pick_import,
            media_library::media_move_asset,
            media_library::media_remove_asset,
            media_library::media_relink_asset,
            media_library::media_asset,
            media_library::media_begin_managed_write,
            media_library::media_append_managed_write,
            media_library::media_finish_managed_write,
            media_library::media_cancel_managed_write,
            media_library::media_commit_portable_backup,
            media_library::media_discard_portable_backup,
            media_library::media_export_portable_backup,
            media_library::media_import_portable_backup,
            video_export::begin_video_export,
            video_export::append_video_export,
            video_export::finish_video_export,
            video_export::cancel_video_export,
            open_media_output,
            toggle_media_output_fullscreen,
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
            updates::install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running DMX Controller");
}
