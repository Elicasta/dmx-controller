export type ConnectionKind =
  | 'dmx'
  | 'visualizer'
  | 'lumastudio'
  | 'lumalive'
  | 'ableton'
  | 'midi-input'
  | 'midi-output';

export type ConnectionState = 'offline' | 'ready' | 'connecting' | 'connected' | 'error';

export type ManagedConnection = {
  kind: ConnectionKind;
  label: string;
  state: ConnectionState;
  detail?: string;
  lastMessage?: string;
  latencyMs?: number;
  updatedAt: number;
};

export type ConnectionMap = Record<ConnectionKind, ManagedConnection>;

export function makeConnection(kind: ConnectionKind, label: string, state: ConnectionState = 'offline'): ManagedConnection {
  return { kind, label, state, updatedAt: Date.now() };
}

export function makeConnectionMap(): ConnectionMap {
  return {
    dmx: makeConnection('dmx', 'DMX Output', 'ready'),
    visualizer: makeConnection('visualizer', 'Visualizer', 'ready'),
    lumastudio: makeConnection('lumastudio', 'LumaStudio', 'ready'),
    lumalive: makeConnection('lumalive', 'LumaLive', 'ready'),
    ableton: makeConnection('ableton', 'Ableton Live', 'ready'),
    'midi-input': makeConnection('midi-input', 'MIDI Input', 'offline'),
    'midi-output': makeConnection('midi-output', 'MIDI Output', 'offline')
  };
}

export function updateConnection(map: ConnectionMap, kind: ConnectionKind, update: Partial<Omit<ManagedConnection, 'kind' | 'label'>>): ConnectionMap {
  return {
    ...map,
    [kind]: {
      ...map[kind],
      ...update,
      kind,
      updatedAt: Date.now()
    }
  };
}

export function connectionHealthy(connection: ManagedConnection) {
  return connection.state === 'connected' || connection.state === 'ready';
}
