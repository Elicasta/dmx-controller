import type { DmxUpdate } from '../lib/dmx';
import {
  fixtureParameterUpdate,
  readFixtureParameter,
  type FixtureParameter,
  type PatchedFixture
} from '../lib/fixtures';
import {
  fixturePhasePositions,
  type FixtureOrderMode,
  type FixtureOrderSpec
} from './fixture-order';

export type PhaserWaveform = 'sine' | 'triangle' | 'square' | 'saw' | 'reverse-saw' | 'step';
export type PhaserDirection = 'forward' | 'reverse';
export type PhaserMode = 'absolute' | 'relative';

export type PhaserEffect = {
  parameter: FixtureParameter;
  waveform: PhaserWaveform;
  bpm: number;
  depth: number;
  phaseSpread: number;
  offset: number;
  orderMode?: FixtureOrderMode;
  order?: FixtureOrderSpec;
  direction?: PhaserDirection;
  cycleBeats?: number;
  mode?: PhaserMode;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
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

export function phaserCycleMs(effect: Pick<PhaserEffect, 'bpm' | 'cycleBeats'>): number {
  const bpm = Math.max(20, Math.min(300, Number.isFinite(effect.bpm) ? effect.bpm : 120));
  const cycleBeats = Math.max(.125, Math.min(32, Number.isFinite(effect.cycleBeats) ? Number(effect.cycleBeats) : 1));
  return (60000 / bpm) * cycleBeats;
}

export function phaserValueAt(effect: PhaserEffect, elapsedMs: number, fixturePhase = 0): number {
  const cycleMs = phaserCycleMs(effect);
  const elapsedPhase = (Math.max(0, elapsedMs) % cycleMs) / cycleMs;
  const travel = effect.direction === 'reverse' ? 1 - elapsedPhase : elapsedPhase;
  const spread = Math.max(0, Math.min(2, effect.phaseSpread / 100));
  return phaserWaveValue(effect.waveform, travel + clamp01(fixturePhase) * spread);
}

function absoluteValue(effect: PhaserEffect, wave: number): number {
  return clamp01(effect.offset / 100 + wave * effect.depth / 100) * 255;
}

function relativeValue(effect: PhaserEffect, wave: number, baseValue: number): number {
  const bipolar = wave * 2 - 1;
  const offset = effect.offset / 100 * 255;
  const excursion = bipolar * Math.max(0, Math.min(100, effect.depth)) / 100 * 127.5;
  return Math.max(0, Math.min(255, baseValue + offset + excursion));
}

export function renderPhaserEffect(
  effect: PhaserEffect,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  baseUniverse?: readonly number[]
): DmxUpdate[] {
  const active = fixtures.filter((fixture) => fixture.selected);
  if (!active.length) return [];

  const orderSpec = effect.order ?? { mode: effect.orderMode ?? 'forward' };
  const phases = fixturePhasePositions(active.length, orderSpec);

  return active.flatMap((fixture, index) => {
    const wave = phaserValueAt(effect, elapsedMs, phases[index]);
    const base = baseUniverse ? readFixtureParameter(baseUniverse, fixture, effect.parameter) : 0;
    const value = effect.mode === 'relative'
      ? relativeValue(effect, wave, base)
      : absoluteValue(effect, wave);
    const update = fixtureParameterUpdate(fixture, effect.parameter, value);
    return update ? [update] : [];
  });
}
