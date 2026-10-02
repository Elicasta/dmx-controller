use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const REGISTRY_VERSION: u32 = 1;
const BACKUP_FORMAT: &str = "lumarig-portable-backup";
const BACKUP_VERSION: u32 = 1;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Default)]
pub struct MediaLibraryState {
    lock: Mutex<()>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredMediaAsset {
    id: String,
    name: String,
    folder_id: Option<String>,
    source_mode: String,
    path: String,
    kind: String,
    size: u64,
    created_at: u64,
    modified_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub name: String,
    pub folder_id: Option<String>,
    pub source_mode: String,
    pub path: String,
    pub kind: String,
    pub size: u64,
    pub created_at: u64,
    pub modified_at: u64,
    pub missing: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibrarySnapshot {
    pub version: u32,
    pub folders: Vec<MediaFolder>,
    pub assets: Vec<MediaAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaRegistry {
    version: u32,
    folders: Vec<MediaFolder>,
    assets: Vec<StoredMediaAsset>,
}

impl Default for MediaRegistry {
    fn default() -> Self {
        Self {
            version: REGISTRY_VERSION,
            folders: Vec::new(),
            assets: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableMediaDescriptor {
    id: String,
    name: String,
    folder_id: Option<String>,
    kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableBackupHeader {
    format: String,
    version: u32,
    #[serde(default)]
    media: Vec<PortableMediaDescriptor>,
    #[serde(default)]
    media_folders: Vec<MediaFolder>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableBackupImport {
    pub path: String,
    pub manifest_json: String,
    pub imported_media: usize,
    pub restore_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableRestorePlan {
    media: Vec<PortableMediaDescriptor>,
    media_folders: Vec<MediaFolder>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0)
}

fn io_error(context: &str, error: impl std::fmt::Display) -> String {
    format!("{context}: {error}")
}

fn library_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("media-library"))
        .map_err(|error| io_error("Media library path is unavailable", error))
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_root(app)?.join("registry.json"))
}

fn managed_files_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_root(app)?.join("files"))
}

fn incoming_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_root(app)?.join(".incoming"))
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | ' ') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "media.bin".to_string()
    } else {
        trimmed.chars().take(180).collect()
    }
}

fn managed_path(app: &AppHandle, id: &str, name: &str) -> Result<PathBuf, String> {
    Ok(managed_files_dir(app)?.join(format!(
        "{}--{}",
        sanitize_file_name(id),
        sanitize_file_name(name)
    )))
}

fn incoming_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(incoming_dir(app)?.join(format!("{}.part", sanitize_file_name(id))))
}

fn file_modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64)
        .unwrap_or_else(now_ms)
}

fn read_registry(app: &AppHandle) -> Result<MediaRegistry, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(MediaRegistry::default());
    }
    let bytes = fs::read(&path).map_err(|error| io_error("Media registry could not be read", error))?;
    let registry: MediaRegistry =
        serde_json::from_slice(&bytes).map_err(|error| io_error("Media registry is invalid", error))?;
    if registry.version != REGISTRY_VERSION {
        return Err(format!(
            "Media registry version {} is not supported.",
            registry.version
        ));
    }
    Ok(registry)
}

fn write_registry(app: &AppHandle, registry: &MediaRegistry) -> Result<(), String> {
    let root = library_root(app)?;
    fs::create_dir_all(&root).map_err(|error| io_error("Media library folder could not be created", error))?;
    let path = registry_path(app)?;
    let temp = root.join("registry.json.tmp");
    let backup = root.join("registry.json.bak");
    let data = serde_json::to_vec_pretty(registry)
        .map_err(|error| io_error("Media registry could not be serialized", error))?;
    fs::write(&temp, data).map_err(|error| io_error("Media registry could not be staged", error))?;

    if backup.exists() {
        let _ = fs::remove_file(&backup);
    }
    if path.exists() {
        fs::rename(&path, &backup)
            .map_err(|error| io_error("Previous media registry could not be protected", error))?;
    }
    if let Err(error) = fs::rename(&temp, &path) {
        if backup.exists() {
            let _ = fs::rename(&backup, &path);
        }
        let _ = fs::remove_file(&temp);
        return Err(io_error("Media registry could not be committed", error));
    }
    if backup.exists() {
        let _ = fs::remove_file(&backup);
    }
    Ok(())
}

fn asset_snapshot(asset: &StoredMediaAsset) -> MediaAsset {
    MediaAsset {
        id: asset.id.clone(),
        name: asset.name.clone(),
        folder_id: asset.folder_id.clone(),
        source_mode: asset.source_mode.clone(),
        path: asset.path.clone(),
        kind: asset.kind.clone(),
        size: asset.size,
        created_at: asset.created_at,
        modified_at: asset.modified_at,
        missing: !Path::new(&asset.path).is_file(),
    }
}

fn snapshot(registry: MediaRegistry) -> MediaLibrarySnapshot {
    MediaLibrarySnapshot {
        version: registry.version,
        folders: registry.folders,
        assets: registry.assets.iter().map(asset_snapshot).collect(),
    }
}

fn ensure_folder(registry: &MediaRegistry, folder_id: &Option<String>) -> Result<(), String> {
    if let Some(id) = folder_id {
        if !registry.folders.iter().any(|folder| &folder.id == id) {
            return Err("The selected media folder no longer exists.".to_string());
        }
    }
    Ok(())
}

fn detect_kind(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "mov" | "m4v" | "webm" => "video".to_string(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff" => "image".to_string(),
        _ => "audio".to_string(),
    }
}

fn allow_asset(app: &AppHandle, path: &Path) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_file(path)
        .map_err(|error| io_error("Media playback permission could not be granted", error))
}

pub fn restore_asset_scopes(app: &AppHandle) -> Result<(), String> {
    let registry = read_registry(app)?;
    for asset in registry.assets {
        let path = PathBuf::from(asset.path);
        if path.is_file() {
            let _ = allow_asset(app, &path);
        }
    }
    Ok(())
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("media.bin")
        .to_string()
}

fn upsert_asset(registry: &mut MediaRegistry, asset: StoredMediaAsset) {
    if let Some(index) = registry.assets.iter().position(|item| item.id == asset.id) {
        registry.assets[index] = asset;
    } else {
        registry.assets.push(asset);
    }
}

#[tauri::command]
pub fn media_library_snapshot(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
) -> Result<MediaLibrarySnapshot, String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    read_registry(&app).map(snapshot)
}

#[tauri::command]
pub fn media_create_folder(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    name: String,
    parent_id: Option<String>,
) -> Result<MediaFolder, String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Folder name is required.".to_string());
    }
    if clean.chars().count() > 120 {
        return Err("Folder names are limited to 120 characters.".to_string());
    }
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    if let Some(parent) = &parent_id {
        if !registry.folders.iter().any(|folder| &folder.id == parent) {
            return Err("Parent folder no longer exists.".to_string());
        }
    }
    if registry
        .folders
        .iter()
        .any(|folder| folder.parent_id == parent_id && folder.name.eq_ignore_ascii_case(clean))
    {
        return Err("A media folder with that name already exists here.".to_string());
    }
    let folder = MediaFolder {
        id: Uuid::new_v4().to_string(),
        name: clean.to_string(),
        parent_id,
        created_at: now_ms(),
    };
    registry.folders.push(folder.clone());
    write_registry(&app, &registry)?;
    Ok(folder)
}

#[tauri::command]
pub fn media_rename_folder(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    folder_id: String,
    name: String,
) -> Result<MediaFolder, String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Folder name is required.".to_string());
    }
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    let index = registry
        .folders
        .iter()
        .position(|folder| folder.id == folder_id)
        .ok_or("Media folder no longer exists.")?;
    let parent = registry.folders[index].parent_id.clone();
    if registry.folders.iter().any(|folder| {
        folder.id != folder_id
            && folder.parent_id == parent
            && folder.name.eq_ignore_ascii_case(clean)
    }) {
        return Err("A media folder with that name already exists here.".to_string());
    }
    registry.folders[index].name = clean.to_string();
    let folder = registry.folders[index].clone();
    write_registry(&app, &registry)?;
    Ok(folder)
}

#[tauri::command]
pub fn media_delete_folder(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    folder_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    if registry
        .folders
        .iter()
        .any(|folder| folder.parent_id.as_deref() == Some(folder_id.as_str()))
        || registry
            .assets
            .iter()
            .any(|asset| asset.folder_id.as_deref() == Some(folder_id.as_str()))
    {
        return Err("Move the folder's media and subfolders before deleting it.".to_string());
    }
    let before = registry.folders.len();
    registry.folders.retain(|folder| folder.id != folder_id);
    if registry.folders.len() == before {
        return Err("Media folder no longer exists.".to_string());
    }
    write_registry(&app, &registry)
}

#[tauri::command]
pub fn media_pick_import(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    mode: String,
    folder_id: Option<String>,
) -> Result<Vec<MediaAsset>, String> {
    if mode != "copy" && mode != "reference" {
        return Err("Media import mode must be copy or reference.".to_string());
    }

    let selected = app
        .dialog()
        .file()
        .add_filter(
            "LumaRig Media",
            &[
                "wav", "mp3", "m4a", "aac", "aif", "aiff", "ogg", "flac", "mp4", "mov", "m4v",
                "webm", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff",
            ],
        )
        .blocking_pick_files();

    let Some(files) = selected else {
        return Ok(Vec::new());
    };

    let paths: Vec<PathBuf> = files
        .into_iter()
        .map(|file| file.into_path().map_err(|error| io_error("Selected media path is invalid", error)))
        .collect::<Result<_, _>>()?;

    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    ensure_folder(&registry, &folder_id)?;
    fs::create_dir_all(managed_files_dir(&app)?)
        .map_err(|error| io_error("Managed media folder could not be created", error))?;

    let mut imported = Vec::new();
    for source in paths {
        if !source.is_file() {
            continue;
        }

        if mode == "reference" {
            let canonical = source.canonicalize().unwrap_or_else(|_| source.clone());
            if let Some(existing) = registry
                .assets
                .iter()
                .find(|asset| asset.source_mode == "reference" && Path::new(&asset.path) == canonical)
            {
                allow_asset(&app, &canonical)?;
                imported.push(asset_snapshot(existing));
                continue;
            }
        }

        let id = Uuid::new_v4().to_string();
        let name = file_name(&source);
        let kind = detect_kind(&source);
        let destination = if mode == "copy" {
            let target = managed_path(&app, &id, &name)?;
            fs::copy(&source, &target).map_err(|error| io_error("Media could not be copied into LumaRig", error))?;
            target
        } else {
            source.canonicalize().unwrap_or(source)
        };
        allow_asset(&app, &destination)?;
        let metadata = fs::metadata(&destination).map_err(|error| io_error("Imported media metadata is unavailable", error))?;
        let asset = StoredMediaAsset {
            id,
            name,
            folder_id: folder_id.clone(),
            source_mode: mode.clone(),
            path: destination.to_string_lossy().to_string(),
            kind,
            size: metadata.len(),
            created_at: now_ms(),
            modified_at: file_modified_ms(&destination),
        };
        imported.push(asset_snapshot(&asset));
        registry.assets.push(asset);
    }
    write_registry(&app, &registry)?;
    Ok(imported)
}

#[tauri::command]
pub fn media_move_asset(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
    folder_id: Option<String>,
) -> Result<MediaAsset, String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    ensure_folder(&registry, &folder_id)?;
    let asset = registry
        .assets
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or("Media asset no longer exists.")?;
    asset.folder_id = folder_id;
    let result = asset_snapshot(asset);
    write_registry(&app, &registry)?;
    Ok(result)
}

#[tauri::command]
pub fn media_remove_asset(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    let asset = registry
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .cloned()
        .ok_or("Media asset no longer exists.")?;
    if asset.source_mode == "copy" {
        let path = PathBuf::from(&asset.path);
        if path.is_file() {
            fs::remove_file(&path).map_err(|error| io_error("Managed media could not be removed", error))?;
        }
    }
    registry.assets.retain(|item| item.id != asset_id);
    write_registry(&app, &registry)
}

#[tauri::command]
pub fn media_relink_asset(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
) -> Result<Option<MediaAsset>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter(
            "LumaRig Media",
            &[
                "wav", "mp3", "m4a", "aac", "aif", "aiff", "ogg", "flac", "mp4", "mov", "m4v",
                "webm", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff",
            ],
        )
        .blocking_pick_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let source = selected
        .into_path()
        .map_err(|error| io_error("Selected media path is invalid", error))?;
    if !source.is_file() {
        return Err("Selected media file is unavailable.".to_string());
    }

    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    let index = registry
        .assets
        .iter()
        .position(|asset| asset.id == asset_id)
        .ok_or("Media asset no longer exists.")?;
    let original = registry.assets[index].clone();
    let name = file_name(&source);
    let destination = if original.source_mode == "copy" {
        let target = managed_path(&app, &original.id, &name)?;
        fs::create_dir_all(managed_files_dir(&app)?)
            .map_err(|error| io_error("Managed media folder could not be created", error))?;
        fs::copy(&source, &target).map_err(|error| io_error("Relinked media could not be copied into LumaRig", error))?;
        if original.path != target.to_string_lossy() {
            let old_path = PathBuf::from(&original.path);
            if old_path.is_file() {
                let _ = fs::remove_file(old_path);
            }
        }
        target
    } else {
        source.canonicalize().unwrap_or(source)
    };
    allow_asset(&app, &destination)?;
    let metadata = fs::metadata(&destination).map_err(|error| io_error("Relinked media metadata is unavailable", error))?;
    registry.assets[index].name = name;
    registry.assets[index].path = destination.to_string_lossy().to_string();
    registry.assets[index].kind = detect_kind(&destination);
    registry.assets[index].size = metadata.len();
    registry.assets[index].modified_at = file_modified_ms(&destination);
    let result = asset_snapshot(&registry.assets[index]);
    write_registry(&app, &registry)?;
    Ok(Some(result))
}

#[tauri::command]
pub fn media_asset(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
) -> Result<Option<MediaAsset>, String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let registry = read_registry(&app)?;
    let result = registry.assets.iter().find(|asset| asset.id == asset_id).map(asset_snapshot);
    if let Some(asset) = &result {
        if !asset.missing {
            allow_asset(&app, Path::new(&asset.path))?;
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn media_begin_managed_write(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let path = incoming_path(&app, &asset_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| io_error("Media staging folder could not be created", error))?;
    }
    File::create(&path).map_err(|error| io_error("Media staging file could not be created", error))?;
    Ok(())
}

#[tauri::command]
pub fn media_append_managed_write(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let asset_id = request
        .headers()
        .get("x-lumarig-media-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .ok_or("Media chunk is missing its asset id.")?;
    let tauri::ipc::InvokeBody::Raw(chunk) = request.body() else {
        return Err("Media chunk must use Tauri's binary IPC body.".to_string());
    };
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let path = incoming_path(&app, asset_id)?;
    let mut file = OpenOptions::new()
        .append(true)
        .open(&path)
        .map_err(|error| io_error("Media staging file could not be opened", error))?;
    file.write_all(chunk)
        .map_err(|error| io_error("Media chunk could not be written", error))
}

#[tauri::command]
pub fn media_finish_managed_write(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
    name: String,
    folder_id: Option<String>,
    kind: Option<String>,
) -> Result<MediaAsset, String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    ensure_folder(&registry, &folder_id)?;
    let staged = incoming_path(&app, &asset_id)?;
    if !staged.is_file() {
        return Err("Staged media is missing. Import the file again.".to_string());
    }
    fs::create_dir_all(managed_files_dir(&app)?)
        .map_err(|error| io_error("Managed media folder could not be created", error))?;
    let destination = managed_path(&app, &asset_id, &name)?;
    if destination.is_file() {
        fs::remove_file(&destination).map_err(|error| io_error("Previous managed media could not be replaced", error))?;
    }
    fs::rename(&staged, &destination)
        .map_err(|error| io_error("Managed media could not be committed", error))?;
    allow_asset(&app, &destination)?;
    let metadata = fs::metadata(&destination).map_err(|error| io_error("Managed media metadata is unavailable", error))?;
    let previous = registry.assets.iter().find(|asset| asset.id == asset_id).cloned();
    let asset = StoredMediaAsset {
        id: asset_id,
        name,
        folder_id,
        source_mode: "copy".to_string(),
        path: destination.to_string_lossy().to_string(),
        kind: kind.unwrap_or_else(|| detect_kind(&destination)),
        size: metadata.len(),
        created_at: previous.as_ref().map(|asset| asset.created_at).unwrap_or_else(now_ms),
        modified_at: file_modified_ms(&destination),
    };
    let result = asset_snapshot(&asset);
    upsert_asset(&mut registry, asset);
    write_registry(&app, &registry)?;
    Ok(result)
}

#[tauri::command]
pub fn media_export_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    manifest_json: String,
    media_ids: Vec<String>,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let header: PortableBackupHeader =
        serde_json::from_str(&manifest_json).map_err(|error| io_error("Backup manifest is invalid", error))?;
    if header.format != BACKUP_FORMAT || header.version != BACKUP_VERSION {
        return Err("Backup manifest format is not supported.".to_string());
    }

    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let registry = read_registry(&app)?;
    let mut assets = Vec::new();
    for id in &media_ids {
        let asset = registry
            .assets
            .iter()
            .find(|asset| &asset.id == id)
            .ok_or_else(|| format!("Media {id} is not in the local media library."))?;
        if !Path::new(&asset.path).is_file() {
            return Err(format!("Relink missing media before backup: {}", asset.name));
        }
        assets.push(asset.clone());
    }

    let default_name = if suggested_name.trim().is_empty() {
        "LumaRig Backup.lumarigbackup".to_string()
    } else if suggested_name.to_ascii_lowercase().ends_with(".lumarigbackup") {
        suggested_name
    } else {
        format!("{}.lumarigbackup", suggested_name)
    };

    let selected = app
        .dialog()
        .file()
        .add_filter("LumaRig Portable Backup", &["lumarigbackup"])
        .set_file_name(default_name)
        .blocking_save_file();

    let Some(selected) = selected else {
        return Ok(None);
    };
    let mut path = selected
        .into_path()
        .map_err(|error| io_error("Backup destination is invalid", error))?;
    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("lumarigbackup"))
        .unwrap_or(true)
    {
        path.set_extension("lumarigbackup");
    }

    let file = File::create(&path).map_err(|error| io_error("Portable backup could not be created", error))?;
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    archive
        .start_file("manifest.json", options)
        .map_err(|error| io_error("Backup manifest entry could not be created", error))?;
    archive
        .write_all(manifest_json.as_bytes())
        .map_err(|error| io_error("Backup manifest could not be written", error))?;

    for asset in assets {
        let entry = format!(
            "media/{}/{}",
            sanitize_file_name(&asset.id),
            sanitize_file_name(&asset.name)
        );
        archive
            .start_file(entry, options)
            .map_err(|error| io_error("Backup media entry could not be created", error))?;
        let mut source =
            File::open(&asset.path).map_err(|error| io_error("Backup media could not be opened", error))?;
        std::io::copy(&mut source, &mut archive)
            .map_err(|error| io_error("Backup media could not be written", error))?;
    }
    archive
        .finish()
        .map_err(|error| io_error("Portable backup could not be finalized", error))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

fn valid_restore_token(value: &str) -> bool {
    Uuid::parse_str(value).is_ok()
}

fn valid_media_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 180
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | ':'))
}

fn restore_root(app: &AppHandle, token: &str) -> Result<PathBuf, String> {
    if !valid_restore_token(token) {
        return Err("Portable restore token is invalid.".to_string());
    }
    Ok(library_root(app)?.join(".restore").join(token))
}

#[tauri::command]
pub fn media_import_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
) -> Result<Option<PortableBackupImport>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("LumaRig Portable Backup", &["lumarigbackup"])
        .blocking_pick_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|error| io_error("Backup path is invalid", error))?;

    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let source = File::open(&path).map_err(|error| io_error("Portable backup could not be opened", error))?;
    let mut archive = ZipArchive::new(source).map_err(|error| io_error("Portable backup is not a valid archive", error))?;
    let manifest_json = {
        let mut manifest = archive
            .by_name("manifest.json")
            .map_err(|error| io_error("Portable backup has no manifest", error))?;
        if manifest.size() > MAX_MANIFEST_BYTES {
            return Err("Portable backup manifest is unexpectedly large.".to_string());
        }
        let mut text = String::new();
        manifest
            .read_to_string(&mut text)
            .map_err(|error| io_error("Portable backup manifest could not be read", error))?;
        text
    };
    let header: PortableBackupHeader =
        serde_json::from_str(&manifest_json).map_err(|error| io_error("Portable backup manifest is invalid", error))?;
    if header.format != BACKUP_FORMAT || header.version != BACKUP_VERSION {
        return Err("This LumaRig backup version is not supported.".to_string());
    }
    if header.media.len() > 10_000 {
        return Err("Portable backup contains too many media entries.".to_string());
    }
    let mut ids = HashSet::new();
    for descriptor in &header.media {
        if !valid_media_id(&descriptor.id) || descriptor.name.trim().is_empty() || descriptor.name.len() > 512 {
            return Err("Portable backup contains an invalid media descriptor.".to_string());
        }
        if !ids.insert(descriptor.id.clone()) {
            return Err(format!("Portable backup contains duplicate media id: {}", descriptor.id));
        }
    }

    let restore_token = Uuid::new_v4().to_string();
    let staging_root = restore_root(&app, &restore_token)?;
    fs::create_dir_all(&staging_root)
        .map_err(|error| io_error("Backup restore staging folder could not be created", error))?;

    let restore_result = (|| -> Result<(), String> {
        for descriptor in &header.media {
            let entry_name = format!(
                "media/{}/{}",
                sanitize_file_name(&descriptor.id),
                sanitize_file_name(&descriptor.name)
            );
            let mut entry = archive
                .by_name(&entry_name)
                .map_err(|_| format!("Portable backup is missing media: {}", descriptor.name))?;
            if entry.is_dir() {
                return Err(format!("Portable backup media entry is invalid: {}", descriptor.name));
            }
            let target = staging_root.join(format!(
                "{}--{}",
                sanitize_file_name(&descriptor.id),
                sanitize_file_name(&descriptor.name)
            ));
            let mut output =
                File::create(&target).map_err(|error| io_error("Restored media could not be staged", error))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|error| io_error("Restored media could not be extracted", error))?;
        }
        let plan = PortableRestorePlan {
            media: header.media.clone(),
            media_folders: header.media_folders.clone(),
        };
        let plan_json = serde_json::to_vec(&plan)
            .map_err(|error| io_error("Portable restore plan could not be serialized", error))?;
        fs::write(staging_root.join("plan.json"), plan_json)
            .map_err(|error| io_error("Portable restore plan could not be staged", error))?;
        Ok(())
    })();

    if let Err(error) = restore_result {
        let _ = fs::remove_dir_all(&staging_root);
        return Err(error);
    }

    Ok(Some(PortableBackupImport {
        path: path.to_string_lossy().to_string(),
        manifest_json,
        imported_media: header.media.len(),
        restore_token,
    }))
}

#[tauri::command]
pub fn media_cancel_portable_backup_restore(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    restore_token: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let staging_root = restore_root(&app, &restore_token)?;
    if staging_root.exists() {
        fs::remove_dir_all(staging_root)
            .map_err(|error| io_error("Portable restore staging folder could not be removed", error))?;
    }
    Ok(())
}

#[tauri::command]
pub fn media_commit_portable_backup_restore(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    restore_token: String,
) -> Result<usize, String> {
    let _guard = state.lock.lock().map_err(|_| "Media library lock failed.".to_string())?;
    let staging_root = restore_root(&app, &restore_token)?;
    let plan_bytes = fs::read(staging_root.join("plan.json"))
        .map_err(|error| io_error("Portable restore plan is missing", error))?;
    let plan: PortableRestorePlan = serde_json::from_slice(&plan_bytes)
        .map_err(|error| io_error("Portable restore plan is invalid", error))?;

    let mut registry = read_registry(&app)?;
    for folder in plan.media_folders {
        if !registry.folders.iter().any(|existing| existing.id == folder.id) {
            registry.folders.push(folder);
        }
    }
    fs::create_dir_all(managed_files_dir(&app)?)
        .map_err(|error| io_error("Managed media folder could not be created", error))?;

    let mut imported = 0usize;
    let mut committed_paths = Vec::new();

    let commit_result = (|| -> Result<(), String> {
        for descriptor in plan.media {
            // A media id is a stable identity. If this computer already has a
            // healthy asset with that id, preserve it rather than clobbering a
            // user's local file during restore.
            if let Some(existing) = registry.assets.iter().find(|asset| asset.id == descriptor.id) {
                if Path::new(&existing.path).is_file() {
                    continue;
                }
            }

            let staged_path = staging_root.join(format!(
                "{}--{}",
                sanitize_file_name(&descriptor.id),
                sanitize_file_name(&descriptor.name)
            ));
            if !staged_path.is_file() {
                return Err(format!("Staged backup media is missing: {}", descriptor.name));
            }
            let destination = managed_path(&app, &descriptor.id, &descriptor.name)?;
            if destination.exists() {
                return Err(format!("Managed media destination already exists unexpectedly: {}", descriptor.name));
            }
            fs::rename(&staged_path, &destination)
                .map_err(|error| io_error("Restored media could not be committed", error))?;
            committed_paths.push(destination.clone());
            allow_asset(&app, &destination)?;
            let metadata = fs::metadata(&destination)
                .map_err(|error| io_error("Restored media metadata is unavailable", error))?;
            let previous = registry.assets.iter().find(|asset| asset.id == descriptor.id).cloned();
            let asset = StoredMediaAsset {
                id: descriptor.id,
                name: descriptor.name,
                folder_id: descriptor.folder_id.filter(|id| registry.folders.iter().any(|folder| &folder.id == id)),
                source_mode: "copy".to_string(),
                path: destination.to_string_lossy().to_string(),
                kind: descriptor.kind.unwrap_or_else(|| detect_kind(&destination)),
                size: metadata.len(),
                created_at: previous.as_ref().map(|asset| asset.created_at).unwrap_or_else(now_ms),
                modified_at: file_modified_ms(&destination),
            };
            upsert_asset(&mut registry, asset);
            imported += 1;
        }
        write_registry(&app, &registry)
    })();

    if let Err(error) = commit_result {
        for path in committed_paths {
            let _ = fs::remove_file(path);
        }
        return Err(error);
    }

    let _ = fs::remove_dir_all(&staging_root);
    Ok(imported)
}
