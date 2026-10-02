use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Seek, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
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

#[derive(Default, Clone)]
pub struct MediaLibraryState {
    lock: Arc<Mutex<()>>,
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

#[derive(Debug, Clone, Deserialize)]
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
    pub restore_id: String,
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
    let collapsed = cleaned.replace("..", "_");
    let trimmed = collapsed
        .trim()
        .trim_matches(|ch| ch == '.' || ch == '_')
        .trim();
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
            .chars()
            .take(70)
            .collect::<String>()
    )))
}

fn incoming_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    valid_asset_id(id)?;
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
    let root = library_root(app)?;
    let generations = root.join("registry-revisions");
    let mut revisions = if generations.exists() {
        fs::read_dir(&generations)
            .map_err(|e| io_error("Registry revisions could not be read", e))?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|e| e == "json"))
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    revisions.sort();
    let path = revisions.last().cloned().unwrap_or(registry_path(app)?);
    let backup = root.join("registry.json.bak");
    if !path.exists() && backup.exists() {
        fs::rename(&backup, &path).map_err(|e| io_error("Media registry recovery failed", e))?;
    }
    if !path.exists() {
        return Ok(MediaRegistry::default());
    }
    let bytes =
        fs::read(&path).map_err(|error| io_error("Media registry could not be read", error))?;
    let registry: MediaRegistry = serde_json::from_slice(&bytes)
        .map_err(|error| io_error("Media registry is invalid", error))?;
    if registry.version != REGISTRY_VERSION {
        return Err(format!(
            "Media registry version {} is not supported.",
            registry.version
        ));
    }
    Ok(registry)
}

fn commit_registry(root: &Path, registry: &MediaRegistry) -> Result<(), String> {
    let folder = root.join("registry-revisions");
    fs::create_dir_all(&folder).map_err(|e| io_error("Registry folder could not be created", e))?;
    let latest = fs::read_dir(&folder)
        .map_err(|e| io_error("Registry revisions could not be read", e))?
        .filter_map(Result::ok)
        .filter_map(|e| {
            e.path()
                .file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.parse::<u64>().ok())
        })
        .max()
        .unwrap_or(0);
    let next = latest
        .checked_add(1)
        .ok_or("Registry revision limit reached.")?;
    let temp = folder.join(format!("{next:020}.tmp"));
    let mut file = File::create(&temp).map_err(|e| io_error("Registry could not be staged", e))?;
    file.write_all(
        &serde_json::to_vec_pretty(registry).map_err(|e| io_error("Registry is invalid", e))?,
    )
    .map_err(|e| io_error("Registry write failed", e))?;
    file.sync_all()
        .map_err(|e| io_error("Registry sync failed", e))?;
    fs::rename(temp, folder.join(format!("{next:020}.json")))
        .map_err(|e| io_error("Registry commit failed", e))
}
fn write_registry(app: &AppHandle, registry: &MediaRegistry) -> Result<(), String> {
    commit_registry(&library_root(app)?, registry)
}
fn valid_asset_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 120
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b':'))
    {
        return Err("Invalid media asset ID.".into());
    }
    Ok(())
}
fn unique_managed_path(app: &AppHandle, id: &str, name: &str) -> Result<PathBuf, String> {
    managed_path(app, &format!("{}-{}", id, Uuid::new_v4()), name)
}

fn asset_snapshot(asset: &StoredMediaAsset) -> MediaAsset {
    MediaAsset {
        id: asset.id.clone(),
        name: asset.name.clone(),
        folder_id: asset.folder_id.clone(),
        source_mode: asset.source_mode.clone(),
        path: asset.path.clone(),
        kind: asset.kind.clone(),
        size: fs::metadata(&asset.path)
            .map(|m| m.len())
            .unwrap_or(asset.size),
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
    let root = library_root(app)?;
    for stale in [root.join(".incoming"), root.join(".restore")] {
        if stale.exists() {
            let _ = fs::remove_dir_all(stale);
        }
    }
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
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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
    if clean.is_empty() || clean.chars().count() > 120 {
        return Err("Enter a folder name of 1 to 120 characters.".to_string());
    }
    if clean.chars().count() > 120 {
        return Err("Folder names are limited to 120 characters.".to_string());
    }
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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
    if clean.is_empty() || clean.chars().count() > 120 {
        return Err("Enter a folder name of 1 to 120 characters.".to_string());
    }
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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

fn media_pick_import_impl(
    app: AppHandle,
    state: MediaLibraryState,
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
        .map(|file| {
            file.into_path()
                .map_err(|error| io_error("Selected media path is invalid", error))
        })
        .collect::<Result<_, _>>()?;

    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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
            if let Some(existing) = registry.assets.iter().find(|asset| {
                asset.source_mode == "reference" && Path::new(&asset.path) == canonical
            }) {
                allow_asset(&app, &canonical)?;
                registry.assets[index].folder_id = folder_id.clone();
                registry.assets[index].modified_at = file_modified_ms(&canonical);
                imported.push(asset_snapshot(&registry.assets[index]));
                continue;
            }
        }

        let id = Uuid::new_v4().to_string();
        let name = file_name(&source);
        let kind = detect_kind(&source);
        let destination = if mode == "copy" {
            let target = managed_path(&app, &id, &name)?;
            fs::copy(&source, &target)
                .map_err(|error| io_error("Media could not be copied into LumaRig", error))?;
            target
        } else {
            source.canonicalize().unwrap_or(source)
        };
        allow_asset(&app, &destination)?;
        let metadata = fs::metadata(&destination)
            .map_err(|error| io_error("Imported media metadata is unavailable", error))?;
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
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
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
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    let asset = registry
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .cloned()
        .ok_or("Media asset no longer exists.")?;
    registry.assets.retain(|item| item.id != asset_id);
    write_registry(&app, &registry)?;
    if asset.source_mode == "copy" && Path::new(&asset.path).is_file() {
        let _ = fs::remove_file(&asset.path);
    }
    Ok(())
}

fn media_relink_asset_impl(
    app: AppHandle,
    state: MediaLibraryState,
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

    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    let index = registry
        .assets
        .iter()
        .position(|asset| asset.id == asset_id)
        .ok_or("Media asset no longer exists.")?;
    let original = registry.assets[index].clone();
    let name = file_name(&source);
    let destination = if original.source_mode == "copy" {
        let target = unique_managed_path(&app, &original.id, &name)?;
        fs::create_dir_all(managed_files_dir(&app)?)
            .map_err(|error| io_error("Managed media folder could not be created", error))?;
        fs::copy(&source, &target)
            .map_err(|error| io_error("Relinked media could not be copied into LumaRig", error))?;
        target
    } else {
        source.canonicalize().unwrap_or(source)
    };
    allow_asset(&app, &destination)?;
    let metadata = fs::metadata(&destination)
        .map_err(|error| io_error("Relinked media metadata is unavailable", error))?;
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
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let registry = read_registry(&app)?;
    let result = registry
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .map(asset_snapshot);
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
) -> Result<String, String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    valid_asset_id(&asset_id)?;
    let job_id = Uuid::new_v4().to_string();
    let path = incoming_path(&app, &job_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| io_error("Media staging folder could not be created", error))?;
    }
    File::create(&path)
        .map_err(|error| io_error("Media staging file could not be created", error))?;
    Ok(job_id)
}

#[tauri::command]
pub fn media_append_managed_write(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let asset_id = request
        .headers()
        .get("x-lumarig-media-job")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .ok_or("Media chunk is missing its asset id.")?;
    let tauri::ipc::InvokeBody::Raw(chunk) = request.body() else {
        return Err("Media chunk must use Tauri's binary IPC body.".to_string());
    };
    if chunk.len() > 1_048_576 {
        return Err("Media chunk exceeds 1 MiB.".into());
    }
    let offset = request
        .headers()
        .get("x-lumarig-media-offset")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or("Media chunk offset is missing.")?;
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let path = incoming_path(&app, asset_id)?;
    if fs::metadata(&path)
        .map_err(|e| io_error("Media staging file is missing", e))?
        .len()
        != offset
    {
        return Err("Media chunks arrived out of order.".into());
    }
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
    job_id: String,
    expected_size: u64,
    name: String,
    folder_id: Option<String>,
    kind: Option<String>,
) -> Result<MediaAsset, String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let mut registry = read_registry(&app)?;
    ensure_folder(&registry, &folder_id)?;
    valid_asset_id(&asset_id)?;
    let staged = incoming_path(&app, &job_id)?;
    if !staged.is_file() {
        return Err("Staged media is missing. Import the file again.".to_string());
    }
    fs::create_dir_all(managed_files_dir(&app)?)
        .map_err(|error| io_error("Managed media folder could not be created", error))?;
    if fs::metadata(&staged)
        .map_err(|e| io_error("Staged media is unavailable", e))?
        .len()
        != expected_size
    {
        return Err("Incomplete media import.".into());
    }
    OpenOptions::new()
        .write(true)
        .open(&staged)
        .map_err(|e| e.to_string())?
        .sync_all()
        .map_err(|e| e.to_string())?;
    let destination = unique_managed_path(&app, &asset_id, &name)?;
    fs::rename(&staged, &destination)
        .map_err(|error| io_error("Managed media could not be committed", error))?;
    allow_asset(&app, &destination)?;
    let metadata = fs::metadata(&destination)
        .map_err(|error| io_error("Managed media metadata is unavailable", error))?;
    let previous = registry
        .assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .cloned();
    let asset = StoredMediaAsset {
        id: asset_id,
        name,
        folder_id,
        source_mode: "copy".to_string(),
        path: destination.to_string_lossy().to_string(),
        kind: kind.unwrap_or_else(|| detect_kind(&destination)),
        size: metadata.len(),
        created_at: previous
            .as_ref()
            .map(|asset| asset.created_at)
            .unwrap_or_else(now_ms),
        modified_at: file_modified_ms(&destination),
    };
    let result = asset_snapshot(&asset);
    upsert_asset(&mut registry, asset);
    write_registry(&app, &registry)?;
    Ok(result)
}

fn media_export_portable_backup_impl(
    app: AppHandle,
    state: MediaLibraryState,
    manifest_json: String,
    media_ids: Vec<String>,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let header: PortableBackupHeader = serde_json::from_str(&manifest_json)
        .map_err(|error| io_error("Backup manifest is invalid", error))?;
    if header.format != BACKUP_FORMAT || header.version != BACKUP_VERSION {
        return Err("Backup manifest format is not supported.".to_string());
    }
    validate_backup_header(&header)?;
    let provided: HashSet<String> = media_ids.iter().cloned().collect();
    let expected: HashSet<String> = header.media.iter().map(|m| m.id.clone()).collect();
    let program: serde_json::Value =
        serde_json::from_str(&manifest_json).map_err(|e| e.to_string())?;
    if provided.len() != media_ids.len()
        || provided != expected
        || !collect_state_media(&program["programState"]).is_subset(&provided)
    {
        return Err("Backup media manifest is incomplete or duplicated.".into());
    }

    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let registry = read_registry(&app)?;
    let mut assets = Vec::new();
    for id in &media_ids {
        let asset = registry
            .assets
            .iter()
            .find(|asset| &asset.id == id)
            .ok_or_else(|| format!("Media {id} is not in the local media library."))?;
        if !Path::new(&asset.path).is_file() {
            return Err(format!(
                "Relink missing media before backup: {}",
                asset.name
            ));
        }
        assets.push(asset.clone());
    }

    let default_name = if suggested_name.trim().is_empty() {
        "LumaRig Backup.lumarigbackup".to_string()
    } else if suggested_name
        .to_ascii_lowercase()
        .ends_with(".lumarigbackup")
    {
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

    let parent = path
        .parent()
        .ok_or("Backup destination has no parent folder.")?;
    let mut staged = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| io_error("Backup could not be staged", e))?;
    let mut archive = ZipWriter::new(staged.as_file_mut());
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
        let mut source = File::open(&asset.path)
            .map_err(|error| io_error("Backup media could not be opened", error))?;
        std::io::copy(&mut source, &mut archive)
            .map_err(|error| io_error("Backup media could not be written", error))?;
    }
    archive
        .finish()
        .map_err(|error| io_error("Portable backup could not be finalized", error))?
        .sync_all()
        .map_err(|e| io_error("Backup sync failed", e))?;
    staged
        .persist(&path)
        .map_err(|e| io_error("Backup could not be committed", e))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

fn media_import_portable_backup_impl(
    app: AppHandle,
    state: MediaLibraryState,
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

    let _guard = state
        .lock
        .lock()
        .map_err(|_| "Media library lock failed.".to_string())?;
    let source = File::open(&path)
        .map_err(|error| io_error("Portable backup could not be opened", error))?;
    let mut archive = ZipArchive::new(source)
        .map_err(|error| io_error("Portable backup is not a valid archive", error))?;
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
    let header: PortableBackupHeader = serde_json::from_str(&manifest_json)
        .map_err(|error| io_error("Portable backup manifest is invalid", error))?;
    if header.format != BACKUP_FORMAT || header.version != BACKUP_VERSION {
        return Err("This LumaRig backup version is not supported.".to_string());
    }

    validate_backup_header(&header)?;
    let mut manifest: serde_json::Value =
        serde_json::from_str(&manifest_json).map_err(|e| e.to_string())?;
    let expected = collect_state_media(&manifest["programState"]);
    let present: HashSet<String> = header.media.iter().map(|m| m.id.clone()).collect();
    if !expected.is_subset(&present) {
        return Err(
            "Portable backup is missing a media descriptor used by its programming.".into(),
        );
    }
    let restore_id = Uuid::new_v4().to_string();
    let staging_root = library_root(&app)?.join(".restore").join(&restore_id);
    fs::create_dir_all(&staging_root).map_err(|e| io_error("Restore staging failed", e))?;
    let ids: HashMap<String, String> = header
        .media
        .iter()
        .map(|m| (m.id.clone(), Uuid::new_v4().to_string()))
        .collect();
    let folder_ids: HashMap<String, String> = header
        .media_folders
        .iter()
        .map(|f| (f.id.clone(), Uuid::new_v4().to_string()))
        .collect();
    let result = (|| -> Result<String, String> {
        extract_backup_media(&mut archive, &header, &staging_root, &ids)?;
        remap_state_media(&mut manifest["programState"], &ids);
        for media in manifest["media"]
            .as_array_mut()
            .ok_or("Invalid media manifest.")?
        {
            let old = media["id"].as_str().ok_or("Invalid media ID.")?.to_string();
            media["id"] = ids[&old].clone().into();
            if let Some(folder) = media["folderId"].as_str().map(str::to_string) {
                media["folderId"] = folder_ids
                    .get(&folder)
                    .ok_or("Missing backup media folder.")?
                    .clone()
                    .into();
            }
        }
        for folder in manifest["mediaFolders"]
            .as_array_mut()
            .ok_or("Invalid folder manifest.")?
        {
            let old = folder["id"]
                .as_str()
                .ok_or("Invalid folder ID.")?
                .to_string();
            folder["id"] = folder_ids[&old].clone().into();
            if let Some(parent) = folder["parentId"].as_str().map(str::to_string) {
                folder["parentId"] = folder_ids
                    .get(&parent)
                    .ok_or("Missing backup parent folder.")?
                    .clone()
                    .into();
            }
        }
        let json = serde_json::to_string(&manifest).map_err(|e| e.to_string())?;
        fs::write(staging_root.join("manifest.json"), &json).map_err(|e| e.to_string())?;
        Ok(json)
    })();
    match result {
        Ok(manifest_json) => Ok(Some(PortableBackupImport {
            path: path.to_string_lossy().into(),
            manifest_json,
            imported_media: header.media.len(),
            restore_id,
        })),
        Err(e) => {
            let _ = fs::remove_dir_all(staging_root);
            Err(e)
        }
    }
}
fn extract_backup_media<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    header: &PortableBackupHeader,
    staging: &Path,
    ids: &HashMap<String, String>,
) -> Result<(), String> {
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
            return Err("Invalid backup media entry.".into());
        }
        let mut output = File::create(staging.join(format!("{}.asset", ids[&descriptor.id])))
            .map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|e| io_error("Backup media is damaged or could not be extracted", e))?;
        output.sync_all().map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn collect_state_media(value: &serde_json::Value) -> HashSet<String> {
    let mut ids = HashSet::new();
    match value {
        serde_json::Value::Object(o) => {
            for (k, v) in o {
                if k == "mediaId" {
                    if let Some(id) = v.as_str() {
                        if !id.is_empty() {
                            ids.insert(id.to_string());
                        }
                    }
                } else {
                    ids.extend(collect_state_media(v));
                }
            }
        }
        serde_json::Value::Array(a) => {
            for v in a {
                ids.extend(collect_state_media(v));
            }
        }
        _ => {}
    }
    ids
}
fn remap_state_media(value: &mut serde_json::Value, ids: &HashMap<String, String>) {
    match value {
        serde_json::Value::Object(o) => {
            for (k, v) in o {
                if k == "mediaId" {
                    if let Some(new) = v.as_str().and_then(|id| ids.get(id)) {
                        *v = new.clone().into();
                    }
                } else {
                    remap_state_media(v, ids);
                }
            }
        }
        serde_json::Value::Array(a) => {
            for v in a {
                remap_state_media(v, ids);
            }
        }
        _ => {}
    }
}
fn validate_backup_header(header: &PortableBackupHeader) -> Result<(), String> {
    if header.media.len() > 10000 || header.media_folders.len() > 10000 {
        return Err("Backup contains too many media assets or folders.".into());
    }
    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    for m in &header.media {
        valid_asset_id(&m.id)?;
        if m.kind
            .as_deref()
            .is_some_and(|k| !["audio", "video", "image"].contains(&k))
        {
            return Err("Invalid backup media kind.".into());
        }
        if m.name.trim().is_empty()
            || !ids.insert(&m.id)
            || !paths.insert(format!(
                "{}/{}",
                sanitize_file_name(&m.id),
                sanitize_file_name(&m.name)
            ))
        {
            return Err("Duplicate or invalid backup media descriptor.".into());
        }
    }
    let folders: HashMap<&str, &MediaFolder> = header
        .media_folders
        .iter()
        .map(|f| (f.id.as_str(), f))
        .collect();
    if folders.len() != header.media_folders.len() {
        return Err("Duplicate backup folders.".into());
    }
    for f in &header.media_folders {
        valid_asset_id(&f.id)?;
        if f.name.trim().is_empty() || f.name.chars().count() > 120 {
            return Err("Invalid backup folder name.".into());
        }
        let mut visited = HashSet::new();
        let mut current = Some(f.id.as_str());
        while let Some(id) = current {
            if !visited.insert(id) {
                return Err("Backup folder hierarchy contains a cycle.".into());
            }
            current = folders
                .get(id)
                .ok_or("Backup folder parent is missing.")?
                .parent_id
                .as_deref();
        }
    }
    for m in &header.media {
        if m.folder_id
            .as_deref()
            .is_some_and(|id| !folders.contains_key(id))
        {
            return Err("Backup media folder is missing.".into());
        }
    }
    Ok(())
}
fn restore_folder(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Uuid::parse_str(id).map_err(|_| "Invalid restore ID.")?;
    Ok(library_root(app)?.join(".restore").join(id))
}
#[tauri::command]
pub fn media_cancel_managed_write(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    job_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media lock failed.")?;
    let path = incoming_path(&app, &job_id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn media_discard_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    restore_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media lock failed.")?;
    let path = restore_folder(&app, &restore_id)?;
    if path.exists() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn media_commit_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    restore_id: String,
) -> Result<(), String> {
    let _guard = state.lock.lock().map_err(|_| "Media lock failed.")?;
    let staging = restore_folder(&app, &restore_id)?;
    let header: PortableBackupHeader = serde_json::from_slice(
        &fs::read(staging.join("manifest.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    validate_backup_header(&header)?;
    let mut registry = read_registry(&app)?;
    if header
        .media
        .iter()
        .any(|m| registry.assets.iter().any(|a| a.id == m.id))
    {
        return Err("Restore media IDs already exist. Reopen the backup.".into());
    }
    let destination = managed_files_dir(&app)?.join(format!("restore-{restore_id}"));
    fs::create_dir_all(managed_files_dir(&app)?).map_err(|e| e.to_string())?;
    fs::rename(&staging, &destination).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        registry.folders.extend(header.media_folders);
        for m in header.media {
            let path = destination.join(format!("{}.asset", m.id));
            allow_asset(&app, &path)?;
            let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
            registry.assets.push(StoredMediaAsset {
                id: m.id,
                name: m.name,
                folder_id: m.folder_id,
                source_mode: "copy".into(),
                path: path.to_string_lossy().into(),
                kind: m.kind.unwrap_or("audio".into()),
                size: meta.len(),
                created_at: now_ms(),
                modified_at: now_ms(),
            });
        }
        write_registry(&app, &registry)
    })();
    if result.is_err() {
        let _ = fs::rename(&destination, &staging);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    fn header() -> PortableBackupHeader {
        serde_json::from_value(serde_json::json!({"format":BACKUP_FORMAT,"version":1,"media":[{"id":"a","name":"song.wav","kind":"audio","folderId":null}],"mediaFolders":[]})).unwrap()
    }
    fn archive(bytes: &[u8]) -> Vec<u8> {
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .start_file(
                "media/a/song.wav",
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
            )
            .unwrap();
        writer.write_all(bytes).unwrap();
        writer.finish().unwrap().into_inner()
    }
    #[test]
    fn registry_commit_keeps_previous_complete_revision() {
        let root = tempfile::tempdir().unwrap();
        commit_registry(root.path(), &MediaRegistry::default()).unwrap();
        let mut second = MediaRegistry::default();
        second.folders.push(MediaFolder {
            id: "f".into(),
            name: "Songs".into(),
            parent_id: None,
            created_at: 0,
        });
        commit_registry(root.path(), &second).unwrap();
        let dir = root.path().join("registry-revisions");
        assert!(dir.join("00000000000000000001.json").is_file());
        let latest: MediaRegistry =
            serde_json::from_slice(&fs::read(dir.join("00000000000000000002.json")).unwrap())
                .unwrap();
        assert_eq!(latest.folders.len(), 1);
    }
    #[test]
    fn reference_missing_and_relink_keep_asset_id() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("song.wav");
        fs::write(&path, b"sound").unwrap();
        let mut asset = StoredMediaAsset {
            id: "a".into(),
            name: "song.wav".into(),
            folder_id: None,
            source_mode: "reference".into(),
            path: path.to_string_lossy().into(),
            kind: "audio".into(),
            size: 5,
            created_at: 0,
            modified_at: 0,
        };
        assert!(!asset_snapshot(&asset).missing);
        fs::remove_file(path).unwrap();
        assert!(asset_snapshot(&asset).missing);
        let next = root.path().join("moved.wav");
        fs::write(&next, b"sound").unwrap();
        asset.path = next.to_string_lossy().into();
        assert!(!asset_snapshot(&asset).missing);
        assert_eq!(asset_snapshot(&asset).id, "a");
    }
    #[test]
    fn backup_rejects_duplicate_ids_and_folder_cycles() {
        let mut h = header();
        h.media.push(h.media[0].clone());
        assert!(validate_backup_header(&h).is_err());
        let mut h = header();
        h.media_folders = vec![MediaFolder {
            id: "f".into(),
            name: "folder".into(),
            parent_id: Some("f".into()),
            created_at: 0,
        }];
        assert!(validate_backup_header(&h).is_err());
    }
    #[test]
    fn nested_folder_descriptors_require_real_parents() {
        let mut h = header();
        h.media_folders = vec![
            MediaFolder {
                id: "parent".into(),
                name: "Songs".into(),
                parent_id: None,
                created_at: 0,
            },
            MediaFolder {
                id: "child".into(),
                name: "Worship".into(),
                parent_id: Some("parent".into()),
                created_at: 0,
            },
        ];
        h.media[0].folder_id = Some("child".into());
        assert!(validate_backup_header(&h).is_ok());
        h.media_folders.remove(0);
        assert!(validate_backup_header(&h).is_err());
    }
    #[test]
    fn backup_remaps_links_without_mutating_cue_ids() {
        let mut value =
            serde_json::json!({"id":"a","songs":[{"mediaId":"a"}],"videoClips":[{"mediaId":"a"}]});
        assert_eq!(
            collect_state_media(&value),
            HashSet::from(["a".to_string()])
        );
        remap_state_media(&mut value, &HashMap::from([("a".into(), "fresh".into())]));
        assert_eq!(value["id"], "a");
        assert_eq!(value["songs"][0]["mediaId"], "fresh");
    }
    #[test]
    fn corrupt_or_missing_archive_never_overwrites_existing_media() {
        let root = tempfile::tempdir().unwrap();
        let existing = root.path().join("old.wav");
        fs::write(&existing, b"original").unwrap();
        let ids = HashMap::from([("a".into(), "fresh".into())]);
        let bytes = archive(b"backup-audio");
        let mut damaged = bytes.clone();
        let offset = damaged
            .windows(12)
            .position(|w| w == b"backup-audio")
            .unwrap();
        damaged[offset] ^= 1;
        let mut zip = ZipArchive::new(Cursor::new(damaged)).unwrap();
        assert!(extract_backup_media(&mut zip, &header(), root.path(), &ids).is_err());
        assert_eq!(fs::read(&existing).unwrap(), b"original");
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut h = header();
        h.media[0].name = "absent.wav".into();
        assert!(extract_backup_media(&mut zip, &h, root.path(), &ids).is_err());
    }
    #[test]
    fn extraction_moves_media_between_machines_without_source_paths() {
        let root = tempfile::tempdir().unwrap();
        let mut zip = ZipArchive::new(Cursor::new(archive(b"backup-audio"))).unwrap();
        extract_backup_media(
            &mut zip,
            &header(),
            root.path(),
            &HashMap::from([("a".into(), "fresh".into())]),
        )
        .unwrap();
        assert_eq!(
            fs::read(root.path().join("fresh.asset")).unwrap(),
            b"backup-audio"
        );
    }
    #[test]
    fn file_names_and_ids_cannot_traverse_windows_or_macos_folders() {
        assert!(valid_asset_id("../escape").is_err());
        assert!(valid_asset_id(r"C:\escape").is_err());
        assert!(valid_asset_id("").is_err());
        assert!(!sanitize_file_name(r"C:\Music\song.wav").contains('\\'));
        assert!(!sanitize_file_name("../../song.wav").contains('/'));
    }
}

#[tauri::command]
pub async fn media_pick_import(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    mode: String,
    folder_id: Option<String>,
) -> Result<Vec<MediaAsset>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        media_pick_import_impl(app, state, mode, folder_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn media_relink_asset(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    asset_id: String,
) -> Result<Option<MediaAsset>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || media_relink_asset_impl(app, state, asset_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn media_export_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
    manifest_json: String,
    media_ids: Vec<String>,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        media_export_portable_backup_impl(app, state, manifest_json, media_ids, suggested_name)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn media_import_portable_backup(
    app: AppHandle,
    state: State<'_, MediaLibraryState>,
) -> Result<Option<PortableBackupImport>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || media_import_portable_backup_impl(app, state))
        .await
        .map_err(|e| e.to_string())?
}
