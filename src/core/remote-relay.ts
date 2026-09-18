import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type RemoteRelayConfig = {
  url: string;
  publishableKey: string;
  email: string;
  password?: string;
  roomCode: string;
};

export type RemoteRelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type RelayCommandEnvelope = {
  id: string;
  command: unknown;
};

export function normalizeRoomCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
}

export function validateRemoteRelayConfig(config: RemoteRelayConfig) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(config.url.trim().replace(/\/$/, ''))) return 'Enter the HTTPS Supabase project URL.';
  if (!config.publishableKey.trim()) return 'Enter the Supabase publishable key.';
  if (!/^\S+@\S+\.\S+$/.test(config.email.trim())) return 'Enter the relay account email.';
  if (normalizeRoomCode(config.roomCode).length < 12) return 'Use a room code with at least 12 letters or numbers.';
  return '';
}

export function relayTopic(userId: string, roomCode: string) {
  return `dmx:${userId}:${normalizeRoomCode(roomCode)}`;
}

export class RemoteRelay {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private status: RemoteRelayStatus = 'disconnected';
  private revision = 0;

  get connectionStatus() { return this.status; }

  async connect(
    config: RemoteRelayConfig,
    onCommand: (envelope: RelayCommandEnvelope) => void,
    onStatus?: (status: RemoteRelayStatus, detail?: string) => void,
    onStateRequest?: () => void
  ) {
    const validation = validateRemoteRelayConfig(config);
    if (validation) throw new Error(validation);
    await this.disconnect();
    this.setStatus('connecting', onStatus);
    const url = config.url.trim().replace(/\/$/, '');
    const storageKey = `dmx-controller-relay-${new URL(url).hostname.replace(/[^a-z0-9]/gi, '-')}`;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, config.publishableKey.trim(), { auth: { persistSession: true, storageKey } });
    this.client = client;

    let session = (await client.auth.getSession()).data.session;
    const desiredEmail = config.email.trim().toLowerCase();
    if (!session || session.user.email?.toLowerCase() !== desiredEmail) {
      if (!config.password) throw new Error('Enter the relay account password the first time this Mac connects.');
      const result = await client.auth.signInWithPassword({ email: desiredEmail, password: config.password });
      if (result.error) throw result.error;
      session = result.data.session;
    }
    if (!session) throw new Error('Supabase did not return an authenticated session.');

    const channel = client.channel(relayTopic(session.user.id, config.roomCode), {
      config: { private: true, broadcast: { ack: true, self: false } }
    });
    channel.on('broadcast', { event: 'command' }, ({ payload }) => {
      if (!payload || typeof payload !== 'object') return;
      const candidate = payload as Partial<RelayCommandEnvelope>;
      if (typeof candidate.id === 'string' && candidate.command && typeof candidate.command === 'object') {
        onCommand({ id: candidate.id, command: candidate.command });
      }
    });
    channel.on('broadcast', { event: 'state.request' }, () => onStateRequest?.());
    this.channel = channel;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Remote relay connection timed out.')), 12000);
      channel.subscribe((next, error) => {
        if (next === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          this.setStatus('connected', onStatus);
          resolve();
        } else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') {
          window.clearTimeout(timeout);
          const detail = error?.message || `Relay channel ${next.toLowerCase().replace('_', ' ')}.`;
          this.setStatus('error', onStatus, detail);
          reject(new Error(detail));
        }
      });
    });
  }

  async sendSnapshot(state: object, revision?: number) {
    if (!this.channel || this.status !== 'connected') return false;
    this.revision = revision ?? this.revision + 1;
    const response = await this.channel.send({ type: 'broadcast', event: 'state.snapshot', payload: { revision: this.revision, state } });
    return response === 'ok';
  }

  async sendPatch(changes: object, revision?: number) {
    if (!this.channel || this.status !== 'connected') return false;
    this.revision = revision ?? this.revision + 1;
    const response = await this.channel.send({ type: 'broadcast', event: 'state.patch', payload: { revision: this.revision, changes } });
    return response === 'ok';
  }

  async sendCommandResult(id: string, ok: boolean, error?: string) {
    if (!this.channel || this.status !== 'connected') return false;
    const response = await this.channel.send({ type: 'broadcast', event: 'command.result', payload: { id, ok, error } });
    return response === 'ok';
  }

  async disconnect() {
    const channel = this.channel;
    const client = this.client;
    this.channel = null;
    this.client = null;
    this.status = 'disconnected';
    if (channel && client) await client.removeChannel(channel);
  }

  private setStatus(status: RemoteRelayStatus, listener?: (status: RemoteRelayStatus, detail?: string) => void, detail?: string) {
    this.status = status;
    listener?.(status, detail);
  }
}
