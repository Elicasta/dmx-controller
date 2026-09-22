mod dmx;
mod midi;
mod output;
mod updates;

use dmx::{DmxEngine, DmxStatus};
use midi::{MidiEngine, MidiEvent, MidiInputInfo, MidiStatus};
use output::{artnet::ArtNetEngine, lumaviz_direct::LumaVizDirectEngine, udmx::UdmxDeviceInfo};
use tauri::State;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DmxEngine::new())
        .manage(ArtNetEngine::default())
        .manage(LumaVizDirectEngine::default())
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
            output::lumaviz_direct::drain_lumaviz_stage_changes,
            output::lumaviz_direct::lumaviz_preview_frame,
            output::lumaviz_direct::send_lumaviz_stage_change,
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
