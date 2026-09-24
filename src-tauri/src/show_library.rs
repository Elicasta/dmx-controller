use std::{fs, path::{Path, PathBuf}, process::Command};
use tauri::Manager;

const SHOW_EXTENSION: &str = ".lumarig.json";

fn ensure_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| format!("Could not create show library: {error}"))
}

fn safe_file_name(file_name: &str) -> Result<String, String> {
    let name = file_name.trim();
    if name.is_empty()
        || name.len() > 180
        || !name.ends_with(SHOW_EXTENSION)
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
    {
        return Err("Invalid show-library filename".to_string());
    }
    Ok(name.to_string())
}

#[tauri::command]
pub fn default_show_library_directory(app: tauri::AppHandle) -> Result<String, String> {
    let base = app.path().document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|error| format!("Could not locate a show-library folder: {error}"))?;
    let directory = base.join("LumaRig Shows");
    ensure_directory(&directory)?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn write_show_library_snapshot(directory: String, file_name: String, contents: String) -> Result<String, String> {
    if contents.len() > 20 * 1024 * 1024 {
        return Err("Show snapshot is larger than 20 MB".to_string());
    }
    let directory = PathBuf::from(directory);
    ensure_directory(&directory)?;
    let name = safe_file_name(&file_name)?;
    let destination = directory.join(name);
    let temporary = destination.with_extension("json.tmp");
    fs::write(&temporary, contents).map_err(|error| format!("Could not write show snapshot: {error}"))?;
    if destination.exists() {
        fs::remove_file(&destination).map_err(|error| format!("Could not replace show snapshot: {error}"))?;
    }
    fs::rename(&temporary, &destination).map_err(|error| format!("Could not finalize show snapshot: {error}"))?;
    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_show_library_snapshots(directory: String) -> Result<Vec<String>, String> {
    let directory = PathBuf::from(directory);
    ensure_directory(&directory)?;
    let mut entries = fs::read_dir(&directory)
        .map_err(|error| format!("Could not read show library: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(SHOW_EXTENSION))
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.metadata().and_then(|metadata| metadata.modified()).ok());
    entries.reverse();
    entries.truncate(100);
    Ok(entries.into_iter().filter_map(|entry| {
        let metadata = entry.metadata().ok()?;
        if metadata.len() > 20 * 1024 * 1024 { return None; }
        fs::read_to_string(entry.path()).ok()
    }).collect())
}

#[tauri::command]
pub fn remove_show_library_snapshot(directory: String, file_name: String) -> Result<(), String> {
    let path = PathBuf::from(directory).join(safe_file_name(&file_name)?);
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Could not remove show snapshot: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn reveal_show_library_directory(directory: String) -> Result<(), String> {
    let directory = PathBuf::from(directory);
    ensure_directory(&directory)?;
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&directory).spawn()
        .map_err(|error| format!("Could not open show library: {error}"))?;
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&directory).spawn()
        .map_err(|error| format!("Could not open show library: {error}"))?;
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    Command::new("xdg-open").arg(&directory).spawn()
        .map_err(|error| format!("Could not open show library: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::safe_file_name;

    #[test]
    fn accepts_only_lumarig_snapshot_names() {
        assert!(safe_file_name("show-abc.lumarig.json").is_ok());
        assert!(safe_file_name("../show-abc.lumarig.json").is_err());
        assert!(safe_file_name("show.json").is_err());
    }
}
