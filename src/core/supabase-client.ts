import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clients = new Map<string, SupabaseClient>();
const DEVICE_ID_KEY = 'lumarig.device-id.v1';
let fallbackDeviceId = '';

export function lumaSupabaseStorageKey(url: string) {
  return `dmx-controller-relay-${new URL(url).hostname.replace(/[^a-z0-9]/gi, '-')}`;
}

export function getLumaSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = publishableKey.trim();
  const cacheKey = `${cleanUrl}::${cleanKey}`;
  const existing = clients.get(cacheKey);
  if (existing) return existing;

  const client = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      storageKey: lumaSupabaseStorageKey(cleanUrl)
    }
  });
  clients.set(cacheKey, client);
  return client;
}

export function classifyDesktopPlatform(source: string) {
  if (/windows|win32|win64/i.test(source)) return 'windows';
  if (/macintosh|mac os|macintel/i.test(source)) return 'macos';
  if (/linux/i.test(source)) return 'linux';
  return 'desktop';
}

export function desktopPlatformId() {
  if (typeof navigator === 'undefined') return 'desktop';
  return classifyDesktopPlatform(`${navigator.platform || ''} ${navigator.userAgent || ''}`);
}

function randomUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '00000000-0000-4000-8000-000000000000';
}

export function desktopDeviceId() {
  if (typeof window === 'undefined') {
    if (!fallbackDeviceId) fallbackDeviceId = randomUuid();
    return fallbackDeviceId;
  }
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = randomUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    if (!fallbackDeviceId) fallbackDeviceId = randomUuid();
    return fallbackDeviceId;
  }
}

export function desktopDeviceInfo(appVersion = '') {
  const platform = desktopPlatformId();
  const id = desktopDeviceId();
  const suffix = id.replace(/-/g, '').slice(-4).toUpperCase();
  const label = platform === 'windows' ? 'Windows' : platform === 'macos' ? 'Mac' : platform === 'linux' ? 'Linux' : 'Desktop';
  return {
    deviceId: id,
    displayName: `${label} LumaRig · ${suffix}`,
    kind: 'desktop' as const,
    platform,
    appName: 'LumaRig',
    appVersion
  };
}
