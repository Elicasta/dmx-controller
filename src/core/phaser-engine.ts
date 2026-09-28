import type { DmxUpdate } from '../lib/dmx';
import {
  fixtureParameterUpdate,
  readFixtureParameter,
  type FixtureParameter,
  type PatchedFixture
} from '../lib/fixtures';
import { fixtureGeometryState, fixtureMovementUpdates } from './fixture-geometry';
import {
  fixturePhasePositions,
  type FixtureOrderMode,
  type FixtureOrderSpec
} from './fixture-order';

export type PhaserWaveform = 'sine' | 'triangle' | 'square' | 'saw' | 'reverse-saw' | 'step';
export type PhaserDirection = 'forward' | 'reverse';
export type PhaserMode = 'absolute' | 'relative';

export type PhaserTiming = {
  bpm: number;
  phaseSpread: number;
  orderMode?: FixtureOrderMode;
  order?: FixtureOrderSpec;
  direction?: PhaserDirection;
  cycleBeats?: number;
};

export type PhaserLane = {
  parameter: FixtureParameter;
  waveform: PhaserWaveform;
  depth: number;
  offset: number;
  phaseOffset?: number;
  rateMultiplier?: number;
  mode?: PhaserMode;
};

export type PhaserEffect = PhaserTiming & PhaserLane;

export type PhaserProgram = PhaserTiming & {
  lanes: readonly PhaserLane[];
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampRate(value: number | undefined): number {
  return Math.max(.125, Math.min(8, Number.isFinite(value) ? Number(value) : 1));
}

export function phaserWaveValue(waveform: PhaserWaveform, phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (waveform === 'sine') return (Math.sin(p * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  if (waveform === 'triangle') return 1 - Math.abs(p * 2 - 1);
  if (waveform === 'square') return p < .5 ? 1 : 0;
  if (waveform === 'saw') return p;
  if (waveform === 'reverse-saw') return 1 - p;
  return p < .18 ? 1 : 0;
}

export function phaserCycleMs(effect: Pick<PhaserTiming, 'bpm' | 'cycleBeats'>): number {
  const bpm = Math.max(20, Math.min(300, Number.isFinite(effect.bpm) ? effect.bpm : 120));
  const cycleBeats = Math.max(.125, Math.min(32, Number.isFinite(effect.cycleBeats) ? Number(effect.cycleBeats) : 1));
  return (60000 / bpm) * cycleBeats;
}

function elapsedPhaseAt(effect: PhaserTiming, elapsedMs: number, rateMultiplier = 1): number {
  const cycleMs = phaserCycleMs(effect);
  const raw = (Math.max(0, elapsedMs) / cycleMs) * clampRate(rateMultiplier);
  return effect.direction === 'reverse' ? 1 - raw : raw;
}

export function phaserValueAt(effect: PhaserEffect, elapsedMs: number, fixturePhase = 0): number {
  const travel = elapsedPhaseAt(effect, elapsedMs, effect.rateMultiplier);
  const spread = Math.max(0, Math.min(2, effect.phaseSpread / 100));
  return phaserWaveValue(
    effect.waveform,
    travel + clamp01(fixturePhase) * spread + (Number.isFinite(effect.phaseOffset) ? Number(effect.phaseOffset) : 0)
  );
}

function normalizedLaneValue(lane: PhaserLane, wave: number, baseNormalized: number): number {
  const depth = Math.max(0, Math.min(100, Number.isFinite(lane.depth) ? lane.depth : 100)) / 100;
  const offset = Math.max(-1, Math.min(1, Number.isFinite(lane.offset) ? lane.offset / 100 : 0));
  if (lane.mode === 'relative') {
    const bipolar = wave * 2 - 1;
    return clamp01(baseNormalized + offset + bipolar * depth * .5);
  }
  return clamp01(offset + wave * depth);
}

function baseParameterNormalized(
  universe: readonly number[] | undefined,
  fixture: PatchedFixture,
  parameter: FixtureParameter
): number {
  if (!universe) return parameter === 'pan' || parameter === 'tilt' ? .5 : 0;
  return clamp01(readFixtureParameter(universe, fixture, parameter) / 255);
}

function movementBase(
  universe: readonly number[] | undefined,
  fixture: PatchedFixture,
  fixtureIndex: number,
  total: number
): { pan: number; tilt: number } {
  if (!universe) return { pan: .5, tilt: .5 };
  const state = fixtureGeometryState(universe, fixture, fixtureIndex, total);
  return {
    pan: state.movement.panNormalized,
    tilt: state.movement.tiltNormalized
  };
}

export function renderPhaserProgram(
  program: PhaserProgram,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  baseUniverse?: readonly number[]
): DmxUpdate[] {
  const active = fixtures.filter((fixture) => fixture.selected);
  if (!active.length || !program.lanes.length) return [];

  const orderSpec = program.order ?? { mode: program.orderMode ?? 'forward' };
  const phases = fixturePhasePositions(active.length, orderSpec);

  return active.flatMap((fixture, index) => {
    const phase = phases[index];
    const movement = movementBase(baseUniverse, fixture, index, active.length);
    let pan = movement.pan;
    let tilt = movement.tilt;
    let hasPan = false;
    let hasTilt = false;
    const updates: DmxUpdate[] = [];

    for (const lane of program.lanes) {
      const wave = phaserValueAt({ ...program, ...lane }, elapsedMs, phase);

      if (lane.parameter === 'pan') {
        pan = normalizedLaneValue(lane, wave, movement.pan);
        hasPan = true;
        continue;
      }
      if (lane.parameter === 'tilt') {
        tilt = normalizedLaneValue(lane, wave, movement.tilt);
        hasTilt = true;
        continue;
      }

      const base = baseParameterNormalized(baseUniverse, fixture, lane.parameter);
      const value = normalizedLaneValue(lane, wave, base) * 255;
      const update = fixtureParameterUpdate(fixture, lane.parameter, value);
      if (update) updates.push(update);
    }

    if (hasPan || hasTilt) {
      updates.push(...fixtureMovementUpdates(fixture, pan, tilt));
    }

    return updates;
  });
}

export function renderPhaserEffect(
  effect: PhaserEffect,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  baseUniverse?: readonly number[]
): DmxUpdate[] {
  return renderPhaserProgram({
    bpm: effect.bpm,
    phaseSpread: effect.phaseSpread,
    orderMode: effect.orderMode,
    order: effect.order,
    direction: effect.direction,
    cycleBeats: effect.cycleBeats,
    lanes: [{
      parameter: effect.parameter,
      waveform: effect.waveform,
      depth: effect.depth,
      offset: effect.offset,
      phaseOffset: effect.phaseOffset,
      rateMultiplier: effect.rateMultiplier,
      mode: effect.mode
    }]
  }, fixtures, elapsedMs, baseUniverse);
}
