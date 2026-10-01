export type MediaAssetKind = 'audio' | 'video' | 'image';

export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaAssetKind;
  mimeType: string;
  size: number;
  createdAt: string;
  durationMs?: number;
};

type StoredMediaAsset = MediaAsset & { blob: Blob };

const DB_NAME = 'lumarig-media-library-v1';
const STORE = 'assets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Media library is not available in this runtime.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open media library.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Media save was aborted.')); };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Media library transaction failed.'));
    };
    action(store, (value) => { result = value; }, reject);
  }));
}

export function mediaKindForFile(file: Pick<File, 'type' | 'name'>): MediaAssetKind | null {
  if (file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name)) return 'video';
  if (file.type.startsWith('audio/') || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac)$/i.test(file.name)) return 'audio';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) return 'image';
  return null;
}

export async function importMediaAsset(file: File, durationMs?: number): Promise<MediaAsset> {
  const kind = mediaKindForFile(file);
  if (!kind) throw new Error('Choose audio, MP4/video, or an image.');
  const asset: StoredMediaAsset = {
    id: `media-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    kind,
    mimeType: file.type || (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mpeg' : 'image/png'),
    size: file.size,
    createdAt: new Date().toISOString(),
    durationMs,
    blob: file
  };
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(asset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  const { blob: _blob, ...metadata } = asset;
  return metadata;
}

export async function listMediaAssets(): Promise<MediaAsset[]> {
  return transaction<MediaAsset[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = (request.result as StoredMediaAsset[]).map(({ blob: _blob, ...asset }) => asset);
      resolve(records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getMediaAssetBlob(id: string): Promise<Blob | null> {
  return transaction<Blob | null>('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as StoredMediaAsset | undefined)?.blob ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMediaAsset(id: string): Promise<void> {
  return transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function mediaObjectUrl(id: string): Promise<string> {
  const blob = await getMediaAssetBlob(id);
  if (!blob) throw new Error('Media file is missing. Relink or re-import it.');
  return URL.createObjectURL(blob);
}
