export type TransportSource =
  | 'local'
  | 'timeline'
  | 'tracks'
  | 'midi'
  | 'studio'
  | 'ableton'
  | 'lumalive'
  | 'propresenter';

export type TransportState = {
  source: TransportSource;
  playing: boolean;
  positionMs: number;
  bpm: number;
  revision: number;
  updatedAt: number;
};

export type TransportUpdate = {
  source: TransportSource;
  playing?: boolean;
  positionMs?: number;
  bpm?: number;
  claim?: boolean;
  release?: boolean;
};

export type TransportApplyResult = {
  accepted: boolean;
  state: TransportState;
  previousSource: TransportSource;
  reason?: 'lower-priority' | 'leased';
};

const SOURCE_PRIORITY: Record<TransportSource, number> = {
  local: 100,
  timeline: 90,
  ableton: 85,
  lumalive: 85,
  studio: 80,
  midi: 75,
  propresenter: 70,
  tracks: 60,
};

const clampBpm = (value: number) => Math.max(20, Math.min(300, Number.isFinite(value) ? value : 120));
const clampPosition = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export class TransportEngine {
  private current: TransportState;
  private leaseSource: TransportSource | null = null;
  private leaseUntil = 0;

  constructor(initial?: Partial<TransportState>, private readonly leaseMs = 1500) {
    this.current = {
      source: initial?.source ?? 'local',
      playing: initial?.playing ?? false,
      positionMs: clampPosition(initial?.positionMs ?? 0),
      bpm: clampBpm(initial?.bpm ?? 120),
      revision: initial?.revision ?? 0,
      updatedAt: initial?.updatedAt ?? 0,
    };
  }

  snapshot(): TransportState {
    return { ...this.current };
  }

  activeSource(now = performance.now()) {
    return this.leaseSource && now <= this.leaseUntil ? this.leaseSource : null;
  }

  apply(update: TransportUpdate, now = performance.now()): TransportApplyResult {
    const previousSource = this.current.source;
    const active = this.activeSource(now);
    const sameSource = active === update.source || this.current.source === update.source;
    const incomingPriority = SOURCE_PRIORITY[update.source];
    const activePriority = active ? SOURCE_PRIORITY[active] : -1;
    const explicitLocal = update.source === 'local';
    const mayTakeAuthority = explicitLocal
      || sameSource
      || !active
      || (Boolean(update.claim) && incomingPriority >= activePriority);

    if (!mayTakeAuthority) {
      return {
        accepted: false,
        state: this.snapshot(),
        previousSource,
        reason: incomingPriority < activePriority ? 'lower-priority' : 'leased',
      };
    }

    const nextPlaying = update.playing ?? this.current.playing;
    this.current = {
      source: update.source,
      playing: nextPlaying,
      positionMs: update.positionMs == null ? this.current.positionMs : clampPosition(update.positionMs),
      bpm: update.bpm == null ? this.current.bpm : clampBpm(update.bpm),
      revision: this.current.revision + 1,
      updatedAt: now,
    };

    if (update.release || (update.playing === false && update.source === this.leaseSource)) {
      this.leaseSource = null;
      this.leaseUntil = 0;
    } else if (update.claim || nextPlaying || sameSource) {
      this.leaseSource = update.source;
      this.leaseUntil = now + this.leaseMs;
    }

    return { accepted: true, state: this.snapshot(), previousSource };
  }

  advance(source: TransportSource, deltaMs: number, bpm?: number, now = performance.now()) {
    const active = this.activeSource(now);
    if (active && active !== source) {
      return {
        accepted: false,
        state: this.snapshot(),
        previousSource: this.current.source,
        reason: 'leased' as const,
      };
    }
    return this.apply({
      source,
      playing: true,
      positionMs: this.current.positionMs + Math.max(0, deltaMs),
      bpm,
      claim: true,
    }, now);
  }

  forceLocal(state: Partial<Pick<TransportState, 'playing' | 'positionMs' | 'bpm'>>, now = performance.now()) {
    return this.apply({ source: 'local', ...state, claim: true }, now);
  }
}
