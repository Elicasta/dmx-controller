import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clients = new Map<string, SupabaseClient>();

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

export function desktopDeviceId() {
  return `lumarig-${desktopPlatformId()}`;
}
