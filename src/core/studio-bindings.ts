import type { StudioShowBinding, StudioSongIdentity } from './studio-bridge-protocol';
import { reusableSongKey, studioBindingKey } from './studio-bridge-protocol';

const STORAGE_KEY = 'lumarig-studio-show-bindings-v1';

type BindingStore = Record<string, StudioShowBinding>;

function readStore(): BindingStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as BindingStore;
  } catch {
    return {};
  }
}

function writeStore(store: BindingStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function resolveStudioBinding(identity: StudioSongIdentity) {
  const store = readStore();
  return store[studioBindingKey(identity)] ?? store[reusableSongKey(identity.songId)] ?? null;
}

export function saveStudioBinding(identity: StudioSongIdentity, lumarigShowId: string) {
  const store = readStore();
  const binding: StudioShowBinding = { ...identity, lumarigShowId, updatedAt: new Date().toISOString() };
  store[studioBindingKey(identity)] = binding;
  store[reusableSongKey(identity.songId)] = binding;
  writeStore(store);
  return binding;
}
