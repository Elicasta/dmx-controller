pub use super::direct_server::{DirectFixtureFrame, DirectStatus, LumaVizDirectEngine};

#[tauri::command]
pub fn start_lumaviz_direct(engine: tauri::State<'_, LumaVizDirectEngine>) -> Result<DirectStatus, String> {
    engine.start()?;
    Ok(engine.status())
}

#[tauri::command]
pub fn lumaviz_direct_status(engine: tauri::State<'_, LumaVizDirectEngine>) -> DirectStatus {
    engine.status()
}

#[tauri::command]
pub fn send_lumaviz_fixture_frame(
    engine: tauri::State<'_, LumaVizDirectEngine>,
    frame: DirectFixtureFrame,
) -> Result<(), String> {
    engine.broadcast(frame)
}

#[tauri::command]
pub fn poll_lumaviz_direct_messages(engine: tauri::State<'_, LumaVizDirectEngine>) -> Vec<String> {
    engine.poll_incoming()
}

#[tauri::command]
pub fn send_lumaviz_direct_message(
    engine: tauri::State<'_, LumaVizDirectEngine>,
    payload: String,
) -> Result<(), String> {
    engine.broadcast_message(payload)
}
