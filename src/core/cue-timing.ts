import { clampDmx } from '../lib/dmx';
import { findMode, type FixtureParameter, type PatchedFixture } from '../lib/fixtures';
import type { CueTimingCurve, CueTimingFamily, CueTimingRule, ShowCue } from '../lib/show';

export type ChannelTiming = {
  fadeMs: number;
  delayMs: number;
  curve: CueTimingCurve;
};

const FAMILY_PARAMETERS: Record<CueTimingFamily, ReadonlySet<FixtureParameter>> = {
  intensity: new Set<FixtureParameter>(['dimmer']),
  color: new Set<FixtureParameter>(['red', 'green', 'blue', 'white', 'amber', 'uv', 'colorWheel']),
  position: new Set<FixtureParameter>(['pan', 'panFine', 'tilt', 'tiltFine', 'movementSpeed']),
  beam: new Set<FixtureParameter>(['strobe', 'gobo', 'focus', 'prism', 'zoom', 'iris', 'goboRotate', 'prismRotate', 'macro'])
};

function sanitizeTiming(rule: CueTimingRule): ChannelTiming {
  return {
    fadeMs: Math.max(0, Math.min(60000, Math.round(rule.fadeMs))),
    delayMs: Math.max(0, Math.min(60000, Math.round(rule.delayMs))),
    curve: rule.curve
  };
}

export function fixtureFamilyChannels(
  fixture: PatchedFixture,
  family: CueTimingFamily
): number[] {
  const parameters = FAMILY_PARAMETERS[family];
  const mode = findMode(fixture);
  if (!mode) return [];
  return mode.channels
    .filter((channel) => channel.parameter && parameters.has(channel.parameter))
    .map((channel) => fixture.address + channel.offset)
    .filter((channel) => channel >= 1 && channel <= 512);
}

export function cueChannelTimings(
  cue: ShowCue,
  patch: readonly PatchedFixture[]
): Map<number, ChannelTiming> {
  const result = new Map<number, ChannelTiming>();
  for (const rule of cue.timing ?? []) {
    const timing = sanitizeTiming(rule);
    for (const fixture of patch) {
      for (const channel of fixtureFamilyChannels(fixture, rule.family)) {
        result.set(channel, timing);
      }
    }
  }
  return result;
}

export function cueIntensityChannels(patch: readonly PatchedFixture[]): Set<number> {
  const channels = new Set<number>();
  for (const fixture of patch) {
    fixtureFamilyChannels(fixture, 'intensity').forEach((channel) => channels.add(channel));
  }
  return channels;
}

function easedProgress(curve: CueTimingCurve, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (curve === 'snap') return p >= 1 ? 1 : 0;
  if (curve === 'linear') return p;
  return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function cuePlaybackDuration(
  cue: ShowCue,
  from: readonly number[],
  target: readonly number[],
  patch: readonly PatchedFixture[]
): number {
  const overrides = cueChannelTimings(cue, patch);
  const intensityChannels = cueIntensityChannels(patch);
  let duration = 0;

  for (let index = 0; index < 512; index += 1) {
    if (clampDmx(from[index] ?? 0) === clampDmx(target[index] ?? 0)) continue;
    const channel = index + 1;
    const override = overrides.get(channel);
    const defaultFade = intensityChannels.has(channel) && (target[index] ?? 0) < (from[index] ?? 0)
      ? cue.fadeOutMs ?? cue.fadeMs
      : cue.fadeMs;
    duration = Math.max(duration, (override?.delayMs ?? 0) + (override?.fadeMs ?? defaultFade));
  }

  return duration;
}

export function renderCueTimedFrame(
  cue: ShowCue,
  from: readonly number[],
  target: readonly number[],
  elapsedMs: number,
  patch: readonly PatchedFixture[]
): number[] {
  const overrides = cueChannelTimings(cue, patch);
  const intensityChannels = cueIntensityChannels(patch);

  return Array.from({ length: 512 }, (_, index) => {
    const start = clampDmx(from[index] ?? 0);
    const end = clampDmx(target[index] ?? 0);
    if (start === end) return end;

    const channel = index + 1;
    const override = overrides.get(channel);
    const defaultFade = intensityChannels.has(channel) && end < start
      ? cue.fadeOutMs ?? cue.fadeMs
      : cue.fadeMs;
    const fadeMs = Math.max(0, override?.fadeMs ?? defaultFade);
    const delayMs = Math.max(0, override?.delayMs ?? 0);
    const curve = override?.curve ?? 'ease';

    if (elapsedMs < delayMs) return start;
    if (fadeMs === 0 || curve === 'snap') return end;

    const progress = easedProgress(curve, (elapsedMs - delayMs) / fadeMs);
    return clampDmx(start + (end - start) * progress);
  });
}
