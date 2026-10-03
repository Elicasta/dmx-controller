import { invoke } from '@tauri-apps/api/core';

export type LumaLiveEndpoint = {
  baseUrl: string;
  version: string;
  bridgePort: number | null;
};

export type LumaLivePairResult = {
  baseUrl: string;
  token: string;
};

export type LumaLiveState = {
  bridgeConnected: boolean;
  playing: boolean;
  tempo: number;
  currentSongTime: number;
  currentSongId: string | null;
  currentSongTitle: string | null;
  currentSectionId: string | null;
  currentSectionName: string | null;
};

export type LumaLiveConnection = {
  baseUrl: string;
  token: string;
  version: string;
};

const STORAGE_KEY = 'lumarig.lumalive.v1';

export function loadLumaLiveConnection(): LumaLiveConnection | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as Partial<LumaLiveConnection> | null;
    if (!parsed?.baseUrl || !parsed.token) return null;
    if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(parsed.baseUrl)) return null;
    return {
      baseUrl: parsed.baseUrl,
      token: parsed.token,
      version: typeof parsed.version === 'string' ? parsed.version : ''
    };
  } catch {
    return null;
  }
}

export function saveLumaLiveConnection(value: LumaLiveConnection | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!value) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The live connection remains usable for this session even if persistence fails.
  }
}

export async function scanLumaLive() {
  return invoke<LumaLiveEndpoint | null>('scan_lumalive');
}

export async function pairLumaLive(baseUrl: string, code: string, deviceName: string) {
  return invoke<LumaLivePairResult>('pair_lumalive', {
    request: { baseUrl, code, deviceName }
  });
}

export async function readLumaLiveState(connection: LumaLiveConnection) {
  return invoke<LumaLiveState>('lumalive_state', {
    baseUrl: connection.baseUrl,
    token: connection.token
  });
}

export async function sendLumaLiveCommand(connection: LumaLiveConnection, type: string, args: Record<string, unknown> = {}) {
  return invoke<unknown>('lumalive_command', {
    baseUrl: connection.baseUrl,
    token: connection.token,
    command: { type, args }
  });
}

export function lumaLivePositionMs(state: Pick<LumaLiveState, 'currentSongTime' | 'tempo'>) {
  return Math.max(0, state.currentSongTime) * 60000 / Math.max(20, state.tempo || 120);
}
