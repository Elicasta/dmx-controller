use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct UpdateState(pub Mutex<Option<Update>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_for_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Option<UpdateMetadata>, String> {
    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;

    let metadata = update.as_ref().map(|pending| UpdateMetadata {
        version: pending.version.clone(),
        current_version: pending.current_version.clone(),
        notes: pending.body.clone(),
    });

    *state
        .0
        .lock()
        .map_err(|_| "Update state is unavailable.".to_string())? = update;

    Ok(metadata)
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<(), String> {
    let update = state
        .0
        .lock()
        .map_err(|_| "Update state is unavailable.".to_string())?
        .take()
        .ok_or_else(|| "No update is ready to install. Check for updates again.".to_string())?;

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    app.request_restart();
    Ok(())
}
