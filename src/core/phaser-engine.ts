import { selectionGridPhases, type FixtureSelectionGrid, type GridPhaseMode } from './selection-grid';
import type { DmxUpdate } from '../lib/dmx';
import {
  fixtureParameterUpdate,
  parameterChannel,
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
  selectionGrid?: FixtureSelectionGrid;
  gridPhaseMode?: GridPhaseMode;
  bpm: number;
  phaseSpread: number;
  orderMode?: FixtureOrderMode;
  order?: FixtureOrderSpec;
  direction?: PhaserDirection;
  cycleBeats?: number;
};

export type PhaserStep = {
  /** Normalized step value expressed as 0..100 percent. */
  value: number;
  /** Relative duration weight for this step. */
  width?: number;
  /** Percent of this step spent transitioning toward the next step. */
  transition?: number;
  /** Ease-in amount for the transition, 0..100. */
  acceleration?: number;
  /** Ease-out amount for the transition, 0..100. */
  deceleration?: number;
};

export type PhaserLane = {
  parameter: FixtureParameter;
  waveform: PhaserWaveform;
  depth: number;
  offset: number;
  phaseOffset?: number;
  rateMultiplier?: number;
  mode?: PhaserMode;
  /** Optional explicit step recipe. When present it replaces waveform sampling for this lane. */
  steps?: readonly PhaserStep[];
};

export type PhaserEffect = PhaserTiming & PhaserLane;

export type PhaserProgram = PhaserTiming & {
  lanes: readonly PhaserLane[];
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampPercent(value: number | undefined, fallback = 0): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : fallback));
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

function stepTransitionCurve(progress: number, acceleration = 0, deceleration = 0): number {
  const t = clamp01(progress);
  const accelPower = 1 + clampPercent(acceleration) / 100 * 3;
  const decelPower = 1 + clampPercent(deceleration) / 100 * 3;
  if (t <= .5) return .5 * Math.pow(t * 2, accelPower);
  return 1 - .5 * Math.pow((1 - t) * 2, decelPower);
}

export function phaserStepValue(steps: readonly PhaserStep[], phase: number): number {
  if (!steps.length) return 0;
  if (steps.length === 1) return clampPercent(steps[0].value) / 100;

  const safeSteps = steps.map((step) => ({
    value: clampPercent(step.value) / 100,
    width: Math.max(.01, Math.min(1000, Number.isFinite(step.width) ? Number(step.width) : 1)),
    transition: clampPercent(step.transition),
    acceleration: clampPercent(step.acceleration),
    deceleration: clampPercent(step.deceleration)
  }));
  const totalWidth = safeSteps.reduce((sum, step) => sum + step.width, 0);
  const wrapped = ((phase % 1) + 1) % 1;
  const position = wrapped * totalWidth;

  let cursor = 0;
  for (let index = 0; index < safeSteps.length; index += 1) {
    const step = safeSteps[index];
    const end = cursor + step.width;
    if (position < end || index === safeSteps.length - 1) {
      const local = Math.max(0, Math.min(1, (position - cursor) / step.width));
      const transitionFraction = step.transition / 100;
      if (transitionFraction <= 0) return step.value;
      const transitionStart = 1 - transitionFraction;
      if (local <= transitionStart) return step.value;
      const next = safeSteps[(index + 1) % safeSteps.length];
      const linearProgress = (local - transitionStart) / transitionFraction;
      const curved = stepTransitionCurve(linearProgress, step.acceleration, step.deceleration);
      return step.value + (next.value - step.value) * curved;
    }
    cursor = end;
  }

  return safeSteps[safeSteps.length - 1].value;
}

export function phaserCycleMs(effect: Pick<PhaserTiming, 'bpm' | 'cycleBeats'>): number {
  const bpm = Math.max(20, Math.min(300, Number.isFinite(effect.bpm) ? effect.bpm : 120));
  const cycleBeats = Math.max(.0625, Math.min(32, Number.isFinite(effect.cycleBeats) ? Number(effect.cycleBeats) : 1));
  return (60000 / bpm) * cycleBeats;
}

function elapsedPhaseAt(effect: PhaserTiming, elapsedMs: number, rateMultiplier = 1): number {
  const cycleMs = phaserCycleMs(effect);
  const raw = (Math.max(0, elapsedMs) / cycleMs) * clampRate(rateMultiplier);
  return effect.direction === 'reverse' ? 1 - raw : raw;
}

function lanePhaseAt(
  timing: PhaserTiming,
  lane: Pick<PhaserLane, 'phaseOffset' | 'rateMultiplier'>,
  elapsedMs: number,
  fixturePhase: number
): number {
  const travel = elapsedPhaseAt(timing, elapsedMs, lane.rateMultiplier);
  const spread = Math.max(0, Math.min(2, timing.phaseSpread / 100));
  return travel
    + clamp01(fixturePhase) * spread
    + (Number.isFinite(lane.phaseOffset) ? Number(lane.phaseOffset) : 0);
}

export function phaserValueAt(effect: PhaserEffect, elapsedMs: number, fixturePhase = 0): number {
  const phase = lanePhaseAt(effect, effect, elapsedMs, fixturePhase);
  return effect.steps?.length
    ? phaserStepValue(effect.steps, phase)
    : phaserWaveValue(effect.waveform, phase);
}

export function phaserLaneValueAt(
  timing: PhaserTiming,
  lane: PhaserLane,
  elapsedMs: number,
  fixturePhase = 0
): number {
  const phase = lanePhaseAt(timing, lane, elapsedMs, fixturePhase);
  return lane.steps?.length
    ? phaserStepValue(lane.steps, phase)
    : phaserWaveValue(lane.waveform, phase);
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
  if (!program.lanes.length) return [];
  const active = fixtures.filter((fixture) => (
    fixture.selected
    && program.lanes.some((lane) => parameterChannel(fixture, lane.parameter) !== null)
  ));
  if (!active.length) return [];

  const orderSpec = program.order ?? { mode: program.orderMode ?? 'forward' };
  const phases = program.gridPhaseMode && program.gridPhaseMode !== 'selection'
    ? selectionGridPhases(program.selectionGrid, active.map(f => f.id), program.gridPhaseMode)
    : fixturePhasePositions(active.length, orderSpec);

  return active.flatMap((fixture, index) => {
    const phase = phases[index];
    const movement = movementBase(baseUniverse, fixture, index, active.length);
    let pan = movement.pan;
    let tilt = movement.tilt;
    let hasPan = false;
    let hasTilt = false;
    const updates: DmxUpdate[] = [];

    for (const lane of program.lanes) {
      const wave = phaserLaneValueAt(program, lane, elapsedMs, phase);

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
      const movementUpdates = fixtureMovementUpdates(fixture, pan, tilt);
      const panChannels = new Set([
        parameterChannel(fixture, 'pan'),
        parameterChannel(fixture, 'panFine')
      ].filter((channel): channel is number => channel !== null));
      const tiltChannels = new Set([
        parameterChannel(fixture, 'tilt'),
        parameterChannel(fixture, 'tiltFine')
      ].filter((channel): channel is number => channel !== null));
      updates.push(...movementUpdates.filter(([channel]) => (
        (hasPan && panChannels.has(channel)) || (hasTilt && tiltChannels.has(channel))
      )));
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
    selectionGrid: effect.selectionGrid,
    gridPhaseMode: effect.gridPhaseMode,
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
      mode: effect.mode,
      steps: effect.steps
    }]
  }, fixtures, elapsedMs, baseUniverse);
}
