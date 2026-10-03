import { renderColorPhaser } from '../core/color-phaser';
import type { FixtureSelectionGrid, GridPhaseMode } from '../core/selection-grid';
import { clampDmx, type DmxUpdate } from './dmx';
import { phaserWaveValue, renderPhaserProgram, type PhaserDirection, type PhaserLane, type PhaserMode, type PhaserStep } from '../core/phaser-engine';
import type { FixtureOrderMode } from '../core/fixture-order';
import {
  fixtureColorUpdates,
  fixtureParameterUpdate,
  type FixtureParameter,
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

export type EffectWaveform = 'sine' | 'triangle' | 'square' | 'saw' | 'reverse-saw' | 'step';
export type EffectParameter = 'dimmer' | 'pan' | 'tilt' | 'uv';
export type CustomEffectParameter = EffectParameter | 'position' | 'color';
export type MotionShape = 'circle' | 'figure-eight' | 'diagonal' | 'pan-sweep' | 'tilt-sweep';
export type CustomEffectLane = {
  parameter: FixtureParameter;
  waveform: EffectWaveform;
  depth: number;
  offset: number;
  phaseOffset?: number;
  rateMultiplier?: number;
  mode?: PhaserMode;
  steps?: PhaserStep[];
};

export type EffectPreset = {
  id: EffectId;
  name: string;
  description: string;
  defaultBpm: number;
  momentary?: boolean;
};

export type CustomEffectStepTrigger = {
  step: number;
  name: string;
  effect: CustomEffect;
};

export type CustomEffect = {
  stepTriggers?: CustomEffectStepTrigger[];
  gridPhaseMode?: GridPhaseMode;
  colorPalette?: string[];
  colorBlend?: 'step' | 'smooth';
  id: string;
  name: string;
  parameter: CustomEffectParameter;
  waveform: EffectWaveform;
  motionShape?: MotionShape;
  bpm: number;
  depth: number;
  phaseSpread: number;
  offset: number;
  orderMode?: FixtureOrderMode;
  blocks?: number;
  groups?: number;
  wings?: number;
  shift?: number;
  direction?: PhaserDirection;
  cycleBeats?: number;
  mode?: PhaserMode;
  steps?: PhaserStep[];
  lanes?: CustomEffectLane[];
};

export const EFFECT_SHAPES: Record<EffectId, { waveform: EffectWaveform; parameter: EffectParameter; phaseSpread: number }> = {
  pulse: { waveform: 'sine', parameter: 'dimmer', phaseSpread: 0 },
  strobe: { waveform: 'square', parameter: 'dimmer', phaseSpread: 0 },
  chase: { waveform: 'step', parameter: 'dimmer', phaseSpread: 100 },
  rainbow: { waveform: 'saw', parameter: 'dimmer', phaseSpread: 100 },
  wave: { waveform: 'sine', parameter: 'dimmer', phaseSpread: 100 },
  'color-chase': { waveform: 'step', parameter: 'dimmer', phaseSpread: 100 },
  sparkle: { waveform: 'step', parameter: 'dimmer', phaseSpread: 100 },
  lightning: { waveform: 'step', parameter: 'dimmer', phaseSpread: 0 },
  'uv-pulse': { waveform: 'sine', parameter: 'uv', phaseSpread: 0 },
  sweep: { waveform: 'sine', parameter: 'pan', phaseSpread: 100 },
  bump: { waveform: 'square', parameter: 'dimmer', phaseSpread: 0 },
  blinder: { waveform: 'square', parameter: 'dimmer', phaseSpread: 0 },
  finale: { waveform: 'step', parameter: 'dimmer', phaseSpread: 100 }
};

export function effectWaveValue(waveform: EffectWaveform, phase: number): number {
  return phaserWaveValue(waveform, phase);
}

export function motionShapeLanes(
  shape: MotionShape,
  effect: Pick<CustomEffect, 'waveform' | 'depth' | 'offset' | 'mode' | 'steps'>
): PhaserLane[] {
  const common = {
    waveform: effect.waveform,
    depth: effect.depth,
    offset: effect.offset,
    mode: effect.mode ?? 'relative',
    steps: effect.steps
  } as const;

  if (shape === 'pan-sweep') return [{ ...common, parameter: 'pan' }];
  if (shape === 'tilt-sweep') return [{ ...common, parameter: 'tilt' }];
  if (shape === 'diagonal') {
    return [
      { ...common, parameter: 'pan' },
      { ...common, parameter: 'tilt' }
    ];
  }
  if (shape === 'figure-eight') {
    return [
      { ...common, parameter: 'pan' },
      { ...common, parameter: 'tilt', phaseOffset: .25, rateMultiplier: 2 }
    ];
  }
  return [
    { ...common, parameter: 'pan' },
    { ...common, parameter: 'tilt', phaseOffset: .25 }
  ];
}

export function renderCustomEffect(
  effect: CustomEffect,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  baseUniverse?: readonly number[],
  selectionGrid?: FixtureSelectionGrid
): DmxUpdate[] {
  const timing = {
    selectionGrid,
    gridPhaseMode: effect.gridPhaseMode,
    bpm: effect.bpm,
    phaseSpread: effect.phaseSpread,
    orderMode: effect.orderMode ?? 'forward',
    order: {
      mode: effect.orderMode ?? 'forward',
      blocks: effect.blocks ?? 1,
      groups: effect.groups ?? 1,
      wings: effect.wings ?? 1,
      shift: effect.shift ?? 0
    },
    direction: effect.direction ?? 'forward',
    cycleBeats: effect.cycleBeats ?? 1
  } as const;

  const primaryLanes: PhaserLane[] = effect.parameter === 'color' ? [] : effect.parameter === 'position'
    ? motionShapeLanes(effect.motionShape ?? 'circle', {
        waveform: effect.waveform,
        depth: effect.depth,
        offset: effect.offset,
        mode: effect.mode ?? 'relative',
        steps: effect.steps
      })
    : [{
        parameter: effect.parameter,
        waveform: effect.waveform,
        depth: effect.depth,
        offset: effect.offset,
        mode: effect.mode ?? 'absolute',
        steps: effect.steps
      }];

  const updates = [...(effect.parameter === 'color' ? renderColorPhaser(effect, fixtures, elapsedMs, selectionGrid) : []), ...renderPhaserProgram({
    ...timing,
    lanes: [...primaryLanes, ...(effect.lanes ?? [])]
  }, fixtures, elapsedMs, baseUniverse)];

  const triggerCount=Math.max(
    effect.steps?.length ?? 0,
    effect.colorPalette?.length ?? 0,
    ...(effect.lanes ?? []).map(lane=>lane.steps?.length ?? 0)
  );
  if(triggerCount && effect.stepTriggers?.length){
    const cycleMs=60000/Math.max(20,effect.bpm)*Math.max(.0625,effect.cycleBeats ?? 1);
    const cyclePosition=((elapsedMs%cycleMs)+cycleMs)%cycleMs;
    const step=Math.min(triggerCount-1,Math.floor(cyclePosition/cycleMs*triggerCount));
    const trigger=effect.stepTriggers.find(item=>item.step===step);
    if(trigger){
      const stepMs=cycleMs/triggerCount;
      const localMs=cyclePosition-step*stepMs;
      const triggerEffect={...trigger.effect,stepTriggers:undefined};
      const merged=new Map<number,number>(updates);
      renderCustomEffect(triggerEffect,fixtures,localMs,baseUniverse,selectionGrid).forEach(([channel,value])=>merged.set(channel,value));
      return [...merged.entries()];
    }
  }
  return updates;
}

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
    return renderPhaserProgram({
      bpm,
      phaseSpread: 100,
      cycleBeats: 1,
      lanes: [
        { parameter: 'pan', waveform: 'sine', depth: 100, offset: 0, mode: 'absolute' },
        { parameter: 'tilt', waveform: 'sine', depth: 100, offset: 0, phaseOffset: .25, mode: 'absolute' }
      ]
    }, active, elapsedMs);
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
