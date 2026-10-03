import { describe, expect, it } from 'vitest';
import { LUMARIG_CLOUD_PUBLISHABLE_KEY, LUMARIG_CLOUD_URL, migrateRemoteRelayProject, normalizeRoomCode, relayTopic, validateRemoteRelayConfig } from './remote-relay';

describe('remote relay configuration', () => {
  it('normalizes room codes into stable channel-safe identifiers', () => {
    expect(normalizeRoomCode(' Sunday Show / FOH! ')).toBe('sundayshowfoh');
    expect(relayTopic('user-123', ' Sunday Show / FOH! ')).toBe('dmx:user-123:sundayshowfoh');
  });

  it('requires authenticated relay settings and a non-trivial room code', () => {
    expect(validateRemoteRelayConfig({ url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test', email: 'operator@example.com', roomCode: 'sunday-show-2026' })).toBe('');
    expect(validateRemoteRelayConfig({ url: 'http://localhost', publishableKey: '', email: 'bad', roomCode: 'short' })).toMatch(/HTTPS/);
  });

  it('migrates the retired LumaRig Supabase project without losing operator settings', () => {
    const result = migrateRemoteRelayProject({
      url: 'https://jtvrrsyqvahslelpmtvv.supabase.co/',
      publishableKey: 'old-key',
      email: 'operator@example.com',
      password: 'not-persisted',
      roomCode: 'sunday-show-2026',
    });
    expect(result.migrated).toBe(true);
    expect(result.config).toEqual({
      url: LUMARIG_CLOUD_URL,
      publishableKey: LUMARIG_CLOUD_PUBLISHABLE_KEY,
      email: 'operator@example.com',
      password: '',
      roomCode: 'sunday-show-2026',
    });
  });

  it('leaves deliberate custom Supabase projects alone', () => {
    const result = migrateRemoteRelayProject({
      url: 'https://custom.supabase.co',
      publishableKey: 'custom-key',
      email: 'operator@example.com',
      roomCode: 'sunday-show-2026',
    });
    expect(result.migrated).toBe(false);
    expect(result.config.url).toBe('https://custom.supabase.co');
    expect(result.config.publishableKey).toBe('custom-key');
  });
});
