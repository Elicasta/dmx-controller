import { describe, expect, it } from 'vitest';
import { normalizeRoomCode, relayTopic, validateRemoteRelayConfig } from './remote-relay';

describe('remote relay configuration', () => {
  it('normalizes room codes into stable channel-safe identifiers', () => {
    expect(normalizeRoomCode(' Sunday Show / FOH! ')).toBe('sundayshowfoh');
    expect(relayTopic('user-123', ' Sunday Show / FOH! ')).toBe('dmx:user-123:sundayshowfoh');
  });

  it('requires authenticated relay settings and a non-trivial room code', () => {
    expect(validateRemoteRelayConfig({ url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test', email: 'operator@example.com', roomCode: 'sunday-show-2026' })).toBe('');
    expect(validateRemoteRelayConfig({ url: 'http://localhost', publishableKey: '', email: 'bad', roomCode: 'short' })).toMatch(/HTTPS/);
  });
});
