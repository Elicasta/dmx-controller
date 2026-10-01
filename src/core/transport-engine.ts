export type TransportSource = 'internal' | 'lumalive' | 'ableton' | 'midi';

export type TransportSnapshot = {
  playing: boolean;
  bpm: number;
  positionMs: number;
  bar: number;
  beat: number;
  phase: number;
  beatsPerBar: number;
  source: TransportSource;
  song?: string;
  section?: string;
  updatedAt: number;
};

export type TransportUpdate = Partial<Pick<
  TransportSnapshot,
  'playing' | 'bpm' | 'positionMs' | 'beatsPerBar' | 'source' | 'song' | 'section'
>>;

export function clampTransportBpm(value: number) {
  return Math.max(20, Math.min(300, Number.isFinite(value) ? value : 120));
}

export function musicalPosition(positionMs: number, bpm: number, beatsPerBar = 4) {
  const safeBpm = clampTransportBpm(bpm);
  const safeBeatsPerBar = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
  const beatMs = 60000 / safeBpm;
  const absoluteBeat = Math.max(0, positionMs) / beatMs;
  const wholeBeat = Math.floor(absoluteBeat);
  return {
    bar: Math.floor(wholeBeat / safeBeatsPerBar) + 1,
    beat: wholeBeat % safeBeatsPerBar + 1,
    phase: absoluteBeat - wholeBeat
  };
}

export function makeTransportSnapshot(update: TransportUpdate = {}): TransportSnapshot {
  const bpm = clampTransportBpm(update.bpm ?? 120);
  const beatsPerBar = Math.max(1, Math.min(12, Math.round(update.beatsPerBar ?? 4)));
  const positionMs = Math.max(0, update.positionMs ?? 0);
  return {
    playing: Boolean(update.playing),
    bpm,
    positionMs,
    beatsPerBar,
    source: update.source ?? 'internal',
    song: update.song,
    section: update.section,
    updatedAt: Date.now(),
    ...musicalPosition(positionMs, bpm, beatsPerBar)
  };
}

export function updateTransport(current: TransportSnapshot, update: TransportUpdate, now = Date.now()): TransportSnapshot {
  const bpm = clampTransportBpm(update.bpm ?? current.bpm);
  const beatsPerBar = Math.max(1, Math.min(12, Math.round(update.beatsPerBar ?? current.beatsPerBar)));
  const positionMs = Math.max(0, Number.isFinite(update.positionMs) ? Number(update.positionMs) : current.positionMs);
  return {
    ...current,
    ...update,
    bpm,
    beatsPerBar,
    positionMs,
    updatedAt: now,
    ...musicalPosition(positionMs, bpm, beatsPerBar)
  };
}

export function advanceTransport(current: TransportSnapshot, elapsedMs: number, now = Date.now()): TransportSnapshot {
  if (!current.playing || elapsedMs <= 0) return { ...current, updatedAt: now };
  return updateTransport(current, { positionMs: current.positionMs + elapsedMs }, now);
}

export function transportSourceLabel(source: TransportSource) {
  if (source === 'lumalive') return 'LumaLive';
  if (source === 'ableton') return 'Ableton Live';
  if (source === 'midi') return 'MIDI Clock';
  return 'Internal';
}
