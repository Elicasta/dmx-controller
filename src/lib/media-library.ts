import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export type MediaSourceMode = 'copy' | 'reference';
export type MediaKind = 'audio' | 'video' | 'image';

export type MediaFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
};

export type MediaAsset = {
  id: string;
  name: string;
  folderId: string | null;
  sourceMode: MediaSourceMode;
  path: string;
  kind: MediaKind;
  size: number;
  createdAt: number;
  modifiedAt: number;
  missing: boolean;
};

export type MediaLibrarySnapshot = {
  version: number;
  folders: MediaFolder[];
  assets: MediaAsset[];
};

export type PortableBackupManifest = {
  format: 'lumarig-portable-backup';
  version: 1;
  exportedAt: string;
  programState: unknown;
  mediaFolders: MediaFolder[];
  media: Array<Pick<MediaAsset, 'id' | 'name' | 'folderId' | 'kind'>>;
};

export type PortableBackupImport = {
  path: string;
  manifestJson: string;
  importedMedia: number;
  restoreToken: string;
};

export type PortablePackageFormat = 'lumarig-song' | 'lumarig-show';

export type PortablePackageManifest<T = unknown> = {
  format: PortablePackageFormat;
  version: 1;
  exportedAt: string;
  payload: T;
  mediaFolders: MediaFolder[];
  media: Array<Pick<MediaAsset, 'id' | 'name' | 'folderId' | 'kind'>>;
};

const EMPTY_LIBRARY: MediaLibrarySnapshot = { version: 1, folders: [], assets: [] };
const CHUNK_BYTES = 1024 * 1024;

export function nativeMediaLibraryAvailable() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function requireNativeMediaLibrary() {
  if (!nativeMediaLibraryAvailable()) {
    throw new Error('The native Media Library is available in the installed LumaRig desktop app.');
  }
}

export function mediaKindForName(name: string, mime = ''): MediaKind {
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(name)) return 'video';
  return 'audio';
}

export async function readMediaLibrary(): Promise<MediaLibrarySnapshot> {
  if (!nativeMediaLibraryAvailable()) return EMPTY_LIBRARY;
  return invoke<MediaLibrarySnapshot>('media_library_snapshot');
}

export async function createMediaFolder(name: string, parentId: string | null = null) {
  requireNativeMediaLibrary();
  return invoke<MediaFolder>('media_create_folder', { name, parentId });
}

export async function renameMediaFolder(folderId: string, name: string) {
  requireNativeMediaLibrary();
  return invoke<MediaFolder>('media_rename_folder', { folderId, name });
}

export async function deleteMediaFolder(folderId: string) {
  requireNativeMediaLibrary();
  await invoke('media_delete_folder', { folderId });
}

export async function pickMediaAssets(mode: MediaSourceMode, folderId: string | null = null) {
  requireNativeMediaLibrary();
  return invoke<MediaAsset[]>('media_pick_import', { mode, folderId });
}

export async function moveMediaAsset(assetId: string, folderId: string | null) {
  requireNativeMediaLibrary();
  return invoke<MediaAsset>('media_move_asset', { assetId, folderId });
}

export async function removeMediaAsset(assetId: string) {
  requireNativeMediaLibrary();
  await invoke('media_remove_asset', { assetId });
}

export async function relinkMediaAsset(assetId: string) {
  requireNativeMediaLibrary();
  return invoke<MediaAsset | null>('media_relink_asset', { assetId });
}

export async function readMediaAsset(assetId: string) {
  if (!nativeMediaLibraryAvailable()) return null;
  return invoke<MediaAsset | null>('media_asset', { assetId });
}

export async function readNativeMediaBlob(assetId: string): Promise<Blob | undefined> {
  const asset = await readMediaAsset(assetId);
  if (!asset) return undefined;
  if (asset.missing) throw new Error(`Relink missing media: ${asset.name}`);
  const response = await fetch(convertFileSrc(asset.path));
  if (!response.ok) throw new Error(`LumaRig could not read ${asset.name} from disk.`);
  return response.blob();
}

/**
 * Copies a browser File/Blob into LumaRig's native managed-media store without
 * building one giant JSON/base64 payload. Tauri receives 1 MiB raw IPC chunks.
 */
export async function persistManagedMedia(
  assetId: string,
  blob: Blob,
  name: string,
  folderId: string | null = null,
  kind: MediaKind = mediaKindForName(name, blob.type),
): Promise<MediaAsset | null> {
  if (!nativeMediaLibraryAvailable()) return null;
  await invoke('media_begin_managed_write', { assetId });
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (!part.value?.byteLength) continue;
      for (let offset = 0; offset < part.value.byteLength; offset += CHUNK_BYTES) {
        const chunk = part.value.subarray(offset, Math.min(part.value.byteLength, offset + CHUNK_BYTES));
        await invoke('media_append_managed_write', chunk, {
          headers: { 'x-lumarig-media-id': assetId },
        });
      }
    }
  } finally {
    reader.releaseLock();
  }
  return invoke<MediaAsset>('media_finish_managed_write', {
    assetId,
    name,
    folderId,
    kind,
  });
}

export function collectMediaIds(value: unknown): string[] {
  const ids = new Set<string>();
  const seen = new Set<object>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    if (seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.mediaId === 'string' && record.mediaId) ids.add(record.mediaId);
    Object.values(record).forEach(visit);
  };
  visit(value);
  return [...ids];
}

export async function exportPortableBackup(
  programState: unknown,
  mediaIds: string[],
  suggestedName: string,
) {
  requireNativeMediaLibrary();
  const library = await readMediaLibrary();
  const assets = mediaIds.map((id) => {
    const asset = library.assets.find((candidate) => candidate.id === id);
    if (!asset) throw new Error(`Media ${id} is not in the native Media Library.`);
    if (asset.missing) throw new Error(`Relink missing media before backup: ${asset.name}`);
    return asset;
  });
  const manifest: PortableBackupManifest = {
    format: 'lumarig-portable-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    programState,
    mediaFolders: library.folders,
    media: assets.map(({ id, name, folderId, kind }) => ({ id, name, folderId, kind })),
  };
  return invoke<string | null>('media_export_portable_backup', {
    manifestJson: JSON.stringify(manifest),
    mediaIds,
    suggestedName,
  });
}

export async function importPortableBackup() {
  requireNativeMediaLibrary();
  const result = await invoke<PortableBackupImport | null>('media_import_portable_backup');
  if (!result) return null;
  let manifest: unknown;
  try {
    manifest = JSON.parse(result.manifestJson);
  } catch {
    await cancelPortableBackupRestore(result.restoreToken).catch(() => {});
    throw new Error('Portable backup manifest could not be parsed after import.');
  }
  const candidate = manifest as Partial<PortableBackupManifest>;
  if (candidate.format !== 'lumarig-portable-backup' || candidate.version !== 1 || !('programState' in candidate)) {
    await cancelPortableBackupRestore(result.restoreToken).catch(() => {});
    throw new Error('This file is not a supported LumaRig portable backup.');
  }
  return { ...result, manifest: candidate as PortableBackupManifest };
}

function packageFolderClosure(library: MediaLibrarySnapshot, assets: readonly MediaAsset[]) {
  const wanted = new Set(assets.flatMap((asset) => asset.folderId ? [asset.folderId] : []));
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of library.folders) {
      if (!wanted.has(folder.id) || !folder.parentId || wanted.has(folder.parentId)) continue;
      wanted.add(folder.parentId);
      changed = true;
    }
  }
  return library.folders.filter((folder) => wanted.has(folder.id));
}

export async function exportPortablePackage<T>(
  format: PortablePackageFormat,
  payload: T,
  mediaIds: string[],
  suggestedName: string,
) {
  requireNativeMediaLibrary();
  const library = await readMediaLibrary();
  const uniqueIds = [...new Set(mediaIds)];
  const assets = uniqueIds.map((id) => {
    const asset = library.assets.find((candidate) => candidate.id === id);
    if (!asset) throw new Error(`Media ${id} is not in the native Media Library.`);
    if (asset.missing) throw new Error(`Relink missing media before export: ${asset.name}`);
    return asset;
  });
  const manifest: PortablePackageManifest<T> = {
    format,
    version: 1,
    exportedAt: new Date().toISOString(),
    payload,
    mediaFolders: packageFolderClosure(library, assets),
    media: assets.map(({ id, name, folderId, kind }) => ({ id, name, folderId, kind })),
  };
  return invoke<string | null>('media_export_portable_package', {
    manifestJson: JSON.stringify(manifest),
    mediaIds: uniqueIds,
    suggestedName,
    packageFormat: format,
  });
}

export async function importPortablePackage<T = unknown>(format: PortablePackageFormat) {
  requireNativeMediaLibrary();
  const result = await invoke<PortableBackupImport | null>('media_import_portable_package', {
    packageFormat: format,
  });
  if (!result) return null;
  let manifest: unknown;
  try {
    manifest = JSON.parse(result.manifestJson);
  } catch {
    await cancelPortableBackupRestore(result.restoreToken).catch(() => {});
    throw new Error('Portable package manifest could not be parsed after import.');
  }
  const candidate = manifest as Partial<PortablePackageManifest<T>>;
  if (candidate.format !== format || candidate.version !== 1 || !('payload' in candidate)) {
    await cancelPortableBackupRestore(result.restoreToken).catch(() => {});
    throw new Error('This file is not the expected LumaRig package type.');
  }
  return { ...result, manifest: candidate as PortablePackageManifest<T> };
}

export async function commitPortableBackupRestore(restoreToken: string) {
  requireNativeMediaLibrary();
  return invoke<number>('media_commit_portable_backup_restore', { restoreToken });
}

export async function cancelPortableBackupRestore(restoreToken: string) {
  if (!nativeMediaLibraryAvailable()) return;
  await invoke('media_cancel_portable_backup_restore', { restoreToken });
}

export function countMediaIds(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  const seen = new Set<object>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    if (seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.mediaId === 'string' && record.mediaId) {
      counts[record.mediaId] = (counts[record.mediaId] ?? 0) + 1;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return counts;
}

export function mediaNameForId(value: unknown, mediaId: string): string | undefined {
  const seen = new Set<object>();
  let result: string | undefined;
  const visit = (item: unknown) => {
    if (result || !item || typeof item !== 'object') return;
    if (seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const record = item as Record<string, unknown>;
    if (record.mediaId === mediaId) {
      if (typeof record.mediaName === 'string' && record.mediaName) result = record.mediaName;
      else if (typeof record.name === 'string' && record.name) result = record.name;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return result;
}
