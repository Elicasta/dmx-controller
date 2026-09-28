import { applyUniverseUpdates, clampDmx, makeUniverse, type DmxUpdate } from '../lib/dmx';
import { findMode, type FixtureParameter, type PatchedFixture } from '../lib/fixtures';

export type CueTimingFamily = 'intensity' | 'color' | 'position' | 'beam';
export type CueTransition = 'linear' | 'ease-in' | 'ease-out' | 's-curve';

export type CueAttributeTiming = {
  fadeMs?: number;
  delayMs?: number;
};

export type CueTimingMap = Partial<Record<CueTimingFamily, CueAttributeTiming>>;

export type TrackableCue = {
  universe?: readonly number[];
  changes?: ReadonlyArray<DmxUpdate>;
  tracking?: boolean;
};

export type CueTransitionOptions = {
  from: readonly number[];
  target: readonly number[];
  elapsedMs: number;
  fadeInMs: number;
  fadeOutMs?: number;
  transition?: CueTransition;
  timing?: CueTimingMap;
  channelFamilies?: ReadonlyMap<number, CueTimingFamily>;
};

const COLOR_PARAMETERS = new Set<FixtureParameter>([
  'red', 'green', 'blue', 'white', 'amber', 'uv', 'colorWheel'
]);

const POSITION_PARAMETERS = new Set<FixtureParameter>([
  'pan', 'panFine', 'tilt', 'tiltFine', 'movementSpeed'
]);

const BEAM_PARAMETERS = new Set<FixtureParameter>([
  'strobe', 'gobo', 'focus', 'prism', 'zoom', 'iris',
  'goboRotate', 'prismRotate', 'macro'
]);

function safeTime(value: number | undefined, fallback = 0): number {
  return Math.max(0, Math.min(60_000, Math.round(Number.isFinite(value) ? Number(value) : fallback)));
}

export function cueFamilyForParameter(parameter: FixtureParameter | undefined): CueTimingFamily | null {
  if (!parameter) return null;
  if (parameter === 'dimmer') return 'intensity';
  if (COLOR_PARAMETERS.has(parameter)) return 'color';
  if (POSITION_PARAMETERS.has(parameter)) return 'position';
  if (BEAM_PARAMETERS.has(parameter)) return 'beam';
  return null;
}

export function buildCueChannelFamilies(
  patch: readonly PatchedFixture[]
): Map<number, CueTimingFamily> {
  const result = new Map<number, CueTimingFamily>();
  for (const fixture of patch) {
    const mode = findMode(fixture);
    if (!mode) continue;
    for (const channel of mode.channels) {
      const family = cueFamilyForParameter(channel.parameter);
      if (!family) continue;
      const absoluteChannel = fixture.address + channel.offset;
      if (absoluteChannel >= 1 && absoluteChannel <= 512) result.set(absoluteChannel, family);
    }
  }
  return result;
}

export function cueTransitionProgress(transition: CueTransition = 's-curve', progress: number): number {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (transition === 'linear') return p;
  if (transition === 'ease-in') return p * p * p;
  if (transition === 'ease-out') return 1 - Math.pow(1 - p, 3);
  return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function cueChanges(previous: readonly number[], next: readonly number[]): DmxUpdate[] {
  const changes: DmxUpdate[] = [];
  for (let index = 0; index < 512; index += 1) {
    const before = clampDmx(previous[index] ?? 0);
    const after = clampDmx(next[index] ?? 0);
    if (before !== after) changes.push([index + 1, after]);
  }
  return changes;
}

export function resolveCueFrame(
  cues: readonly TrackableCue[],
  targetIndex: number,
  initialFrame: readonly number[] = makeUniverse()
): number[] {
  const last = Math.min(Math.max(-1, Math.floor(targetIndex)), cues.length - 1);
  let frame = Array.from({ length: 512 }, (_, index) => clampDmx(initialFrame[index] ?? 0));

  for (let index = 0; index <= last; index += 1) {
    const cue = cues[index];
    if (cue.tracking && cue.changes) {
      frame = applyUniverseUpdates(frame, cue.changes);
    } else if (cue.universe?.length === 512) {
      frame = Array.from({ length: 512 }, (_, channel) => clampDmx(cue.universe?.[channel] ?? 0));
    } else if (cue.changes) {
      frame = applyUniverseUpdates(frame, cue.changes);
    }
  }

  return frame;
}

function channelTiming(
  options: CueTransitionOptions,
  channel: number,
  start: number,
  end: number
): { delayMs: number; fadeMs: number } {
  const family = options.channelFamilies?.get(channel);
  const timing = family ? options.timing?.[family] : undefined;
  const delayMs = safeTime(timing?.delayMs, 0);

  if (timing?.fadeMs !== undefined) {
    return { delayMs, fadeMs: safeTime(timing.fadeMs) };
  }

  const fallingIntensity = family === 'intensity' && end < start;
  return {
    delayMs,
    fadeMs: safeTime(fallingIntensity ? options.fadeOutMs : options.fadeInMs, options.fadeInMs)
  };
}

export function cueTransitionDuration(options: Omit<CueTransitionOptions, 'elapsedMs'>): number {
  let duration = 0;
  for (let index = 0; index < 512; index += 1) {
    const start = clampDmx(options.from[index] ?? 0);
    const end = clampDmx(options.target[index] ?? 0);
    if (start === end) continue;
    const timing = channelTiming({ ...options, elapsedMs: 0 }, index + 1, start, end);
    duration = Math.max(duration, timing.delayMs + timing.fadeMs);
  }
  return duration;
}

export function renderCueTransitionFrame(
  options: CueTransitionOptions
): { frame: number[]; done: boolean; durationMs: number } {
  const elapsed = Math.max(0, Number.isFinite(options.elapsedMs) ? options.elapsedMs : 0);
  const durationMs = cueTransitionDuration(options);

  const frame = Array.from({ length: 512 }, (_, index) => {
    const start = clampDmx(options.from[index] ?? 0);
    const end = clampDmx(options.target[index] ?? 0);
    if (start === end) return end;

    const { delayMs, fadeMs } = channelTiming(options, index + 1, start, end);
    if (elapsed < delayMs) return start;
    if (fadeMs === 0) return end;

    const raw = Math.max(0, Math.min(1, (elapsed - delayMs) / fadeMs));
    const amount = cueTransitionProgress(options.transition, raw);
    return clampDmx(start + (end - start) * amount);
  });

  return { frame, done: elapsed >= durationMs, durationMs };
}
