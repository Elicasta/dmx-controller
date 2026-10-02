export type ConnectionKind =
  | 'midi'
  | 'studio'
  | 'ableton'
  | 'lumalive'
  | 'propresenter'
  | 'cloud'
  | 'controller'
  | 'media';

export type ConnectionStatus = 'off' | 'connecting' | 'connected' | 'degraded' | 'error';

export type ConnectionRecord = {
  id: string;
  kind: ConnectionKind;
  name: string;
  status: ConnectionStatus;
  capabilities: string[];
  lastSeenAt: number | null;
  lastError: string;
  detail: string;
};

export class ConnectionManager {
  private records = new Map<string, ConnectionRecord>();

  upsert(input: Omit<ConnectionRecord, 'lastSeenAt' | 'lastError' | 'detail'> & Partial<Pick<ConnectionRecord, 'lastSeenAt' | 'lastError' | 'detail'>>) {
    const current = this.records.get(input.id);
    const next: ConnectionRecord = {
      id: input.id,
      kind: input.kind,
      name: input.name,
      status: input.status,
      capabilities: [...input.capabilities],
      lastSeenAt: input.lastSeenAt ?? current?.lastSeenAt ?? null,
      lastError: input.lastError ?? current?.lastError ?? '',
      detail: input.detail ?? current?.detail ?? '',
    };
    this.records.set(next.id, next);
    return { ...next, capabilities: [...next.capabilities] };
  }

  heartbeat(id: string, detail = '', now = Date.now()) {
    const current = this.records.get(id);
    if (!current) return null;
    current.lastSeenAt = now;
    current.status = 'connected';
    current.lastError = '';
    if (detail) current.detail = detail;
    return { ...current, capabilities: [...current.capabilities] };
  }

  fail(id: string, error: string, degraded = false) {
    const current = this.records.get(id);
    if (!current) return null;
    current.status = degraded ? 'degraded' : 'error';
    current.lastError = error;
    return { ...current, capabilities: [...current.capabilities] };
  }

  disconnect(id: string, detail = '') {
    const current = this.records.get(id);
    if (!current) return null;
    current.status = 'off';
    current.detail = detail || current.detail;
    return { ...current, capabilities: [...current.capabilities] };
  }

  get(id: string) {
    const item = this.records.get(id);
    return item ? { ...item, capabilities: [...item.capabilities] } : null;
  }

  snapshot() {
    return [...this.records.values()]
      .map(item => ({ ...item, capabilities: [...item.capabilities] }))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }
}
