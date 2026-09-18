import { clampDmx, type DmxUpdate } from './dmx';
import {
  fixtureColorUpdates,
  fixtureParameterUpdate,
  type PatchedFixture
} from './fixtures';

export type EffectId =
  | 'pulse'
  | 'strobe'
  | 'chase'
  | 'rainbow'
  | 'wave'
  | 'color-chase'
  | 'sparkle'
  | 'lightning'
  | 'uv-pulse'
  | 'sweep'
  | 'bump'
  | 'blinder'
  | 'finale';

export type EffectPreset = {
  id: EffectId;
  name: string;
  description: string;
  defaultBpm: number;
  momentary?: boolean;
};

export const EFFECT_PRESETS: ReadonlyArray<EffectPreset> = [
  { id: 'pulse', name: 'Pulse', description: 'Smooth intensity breathing', defaultBpm: 80 },
  { id: 'strobe', name: 'Strobe', description: 'Software dimmer strobe', defaultBpm: 150 },
  { id: 'chase', name: 'Chase', description: 'Steps across selected lights', defaultBpm: 120 },
  { id: 'rainbow', name: 'Rainbow', description: 'Color wheel across RGB lights', defaultBpm: 60 },
  { id: 'wave', name: 'Dimmer Wave', description: 'Smooth intensity wave across lights', defaultBpm: 100 },
  { id: 'color-chase', name: 'Color Chase', description: 'Beat-stepped color movement', defaultBpm: 120 },
  { id: 'sparkle', name: 'Sparkle', description: 'Random-looking individual flashes', defaultBpm: 128 },
  { id: 'lightning', name: 'Lightning', description: 'Irregular full-stage white bursts', defaultBpm: 96 },
  { id: 'uv-pulse', name: 'UV Pulse', description: 'Blacklight pulse on UV fixtures', defaultBpm: 80 },
  { id: 'sweep', name: 'Moving Sweep', description: 'Pan and tilt sweep for movers', defaultBpm: 72 },
  { id: 'bump', name: 'Bump', description: 'Hold for an intensity punch', defaultBpm: 120, momentary: true },
  { id: 'blinder', name: 'Blinder', description: 'Hold for a full-white crowd hit', defaultBpm: 120, momentary: true },
  { id: 'finale', name: 'Finale', description: 'Eight-beat finish sequence', defaultBpm: 128 }
];

function hsvToRgb(hue: number, saturation = 1, value = 1): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const c = value * saturation;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = value - c;
  const [red, green, blue] = h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
      : h < 180 ? [0, c, x]
        : h < 240 ? [0, x, c]
          : h < 300 ? [x, 0, c]
            : [c, 0, x];
  return [red, green, blue].map((channel) => clampDmx((channel + m) * 255)) as [number, number, number];
}

export function renderEffect(
  effect: EffectId,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  bpm: number,
  depth: number
): DmxUpdate[] {
  const targets = fixtures.filter((fixture) => fixture.selected);
  const active = targets;
  if (active.length === 0) return [];
  const beatMs = 60000 / Math.max(20, bpm);
  const phase = (elapsedMs % beatMs) / beatMs;
  const normalizedDepth = Math.max(0, Math.min(1, depth));

  if (effect === 'rainbow') {
    return active.flatMap((fixture, index) => (
      fixtureColorUpdates(fixture, hsvToRgb(phase * 360 + index * (360 / active.length)))
    ));
  }

  if (effect === 'color-chase') {
    const step = Math.floor(elapsedMs / (beatMs / 2));
    return active.flatMap((fixture, index) => (
      fixtureColorUpdates(fixture, hsvToRgb((step * 60 + index * (360 / active.length)) % 360))
    ));
  }

  if (effect === 'blinder') {
    return active.flatMap((fixture) => {
      const dimmer = fixtureParameterUpdate(fixture, 'dimmer', 255);
      return [...fixtureColorUpdates(fixture, [255, 255, 255]), ...(dimmer ? [dimmer] : [])];
    });
  }


  if (effect === 'bump') {
    return active.flatMap((fixture) => {
      const dimmer = fixtureParameterUpdate(fixture, 'dimmer', 255);
      return dimmer ? [dimmer] : [];
    });
  }

  if (effect === 'sparkle') {
    const sparkleStep = Math.floor(elapsedMs / Math.max(24, beatMs / 8));
    const litIndex = (sparkleStep * 7 + 3) % active.length;
    return active.flatMap((fixture, index) => {
      const dimmer = fixtureParameterUpdate(fixture, 'dimmer', index === litIndex ? 255 : 255 * (1 - normalizedDepth));
      return [...fixtureColorUpdates(fixture, [255, 255, 255]), ...(dimmer ? [dimmer] : [])];
    });
  }

  if (effect === 'lightning') {
    const burst = Math.floor(phase * 16);
    const on = [0, 1, 4, 9, 10, 11].includes(burst);
    return active.flatMap((fixture) => {
      const dimmer = fixtureParameterUpdate(fixture, 'dimmer', on ? 255 : 255 * (1 - normalizedDepth));
      return [...fixtureColorUpdates(fixture, [235, 242, 255]), ...(dimmer ? [dimmer] : [])];
    });
  }

  if (effect === 'uv-pulse') {
    const wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const level = 255 * ((1 - normalizedDepth) + wave * normalizedDepth);
    return active.flatMap((fixture) => {
      const uv = fixtureParameterUpdate(fixture, 'uv', level);
      const dimmer = fixtureParameterUpdate(fixture, 'dimmer', level);
      return [uv, dimmer].filter((update): update is DmxUpdate => Boolean(update));
    });
  }

  if (effect === 'sweep') {
    return active.flatMap((fixture, index) => {
      const offset = index / active.length;
      const pan = fixtureParameterUpdate(fixture, 'pan', ((Math.sin((phase + offset) * Math.PI * 2) + 1) / 2) * 255);
      const tilt = fixtureParameterUpdate(fixture, 'tilt', ((Math.cos((phase + offset * .5) * Math.PI * 2) + 1) / 2) * 255);
      return [pan, tilt].filter((update): update is DmxUpdate => Boolean(update));
    });
  }

  if (effect === 'finale') {
    const beat = Math.floor(elapsedMs / beatMs);
    const quarterBeat = (elapsedMs % (beatMs / 4)) / (beatMs / 4);
    const flashOn = quarterBeat < .38;
    return active.flatMap((fixture, index) => {
      const color = hsvToRgb(beat * 48 + index * (360 / active.length), 1, 1);
      const dimmer = fixtureParameterUpdate(
        fixture,
        'dimmer',
        flashOn && ((beat + index) % Math.max(1, Math.min(active.length, 3)) === 0 || beat >= 6) ? 255 : 0
      );
      return [...fixtureColorUpdates(fixture, color), ...(dimmer ? [dimmer] : [])];
    });
  }

  return active.flatMap((fixture, index) => {
    let level = 255;
    if (effect === 'pulse') {
      const wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      level = 255 * ((1 - normalizedDepth) + wave * normalizedDepth);
    } else if (effect === 'strobe') {
      const flashesPerBeat = 4;
      const local = (phase * flashesPerBeat) % 1;
      level = local < .22 ? 255 : 255 * (1 - normalizedDepth);
    } else if (effect === 'chase') {
      const current = Math.floor(phase * active.length) % active.length;
      level = index === current ? 255 : 255 * (1 - normalizedDepth);
    } else if (effect === 'wave') {
      const shifted = (phase + index / active.length) % 1;
      const wave = (Math.sin(shifted * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      level = 255 * ((1 - normalizedDepth) + wave * normalizedDepth);
    }
    const update = fixtureParameterUpdate(fixture, 'dimmer', level);
    return update ? [update] : [];
  });
}
