import { describe, expect, it } from 'vitest';
import { applyUniverseUpdates, makeUniverse } from '../lib/dmx';
import { migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import { phaserCycleMs, phaserValueAt, renderPhaserEffect, type PhaserEffect } from './phaser-engine';

function mover(id: string, address: number): PatchedFixture {
  return migratePatchedFixture({
    id,
    name: id,
    profileId: 'generic-moving-head',
    modeId: '14ch-common',
    universe: 1,
    address,
    group: 'Movers',
    selected: true,
    collapsed: false
  }, 0, 1);
}

const base: PhaserEffect = {
  parameter: 'pan',
  waveform: 'sine',
  bpm: 120,
  depth: 100,
  phaseSpread: 100,
  offset: 0
};

describe('phaser engine', () => {
  it('converts musical cycle length to milliseconds', () => {
    expect(phaserCycleMs({ bpm: 120, cycleBeats: 4 })).toBe(2000);
  });

  it('supports forward and reverse travel', () => {
    expect(phaserValueAt({ ...base, waveform: 'saw', direction: 'forward' }, 125, 0)).toBeCloseTo(.25, 4);
    expect(phaserValueAt({ ...base, waveform: 'saw', direction: 'reverse' }, 125, 0)).toBeCloseTo(.75, 4);
  });

  it('uses fixture order to assign distinct phase positions', () => {
    const fixtures = [mover('one', 1), mover('two', 20), mover('three', 40), mover('four', 60)];
    const forward = renderPhaserEffect({ ...base, waveform: 'saw', orderMode: 'forward' }, fixtures, 0);
    const reverse = renderPhaserEffect({ ...base, waveform: 'saw', orderMode: 'reverse' }, fixtures, 0);
    expect(forward.map(([, value]) => value)).toEqual([0, 85, 170, 0]);
    expect(reverse.map(([, value]) => value)).toEqual([0, 170, 85, 0]);
    expect(forward.map(([channel]) => channel)).toEqual([1, 20, 40, 60]);
  });

  it('lets blocks share phase and wings mirror phase', () => {
    const fixtures = [mover('one', 1), mover('two', 20), mover('three', 40), mover('four', 60)];
    const blocked = renderPhaserEffect({ ...base, waveform: 'saw', phaseSpread: 50, order: { mode: 'forward', blocks: 2 } }, fixtures, 0);
    const winged = renderPhaserEffect({ ...base, waveform: 'saw', phaseSpread: 50, order: { mode: 'forward', wings: 2 } }, fixtures, 0);
    expect(blocked.map(([, value]) => value)).toEqual([0, 0, 128, 128]);
    expect(winged.map(([, value]) => value)).toEqual([0, 128, 128, 0]);
  });

  it('can run relative to the current look instead of replacing it', () => {
    const fixture = mover('relative', 1);
    const baseFrame = applyUniverseUpdates(makeUniverse(), [[1, 128]]);
    const updates = renderPhaserEffect({
      ...base,
      waveform: 'sine',
      mode: 'relative',
      depth: 20,
      phaseSpread: 0
    }, [fixture], 250, baseFrame);
    expect(updates[0][1]).toBeGreaterThan(128);
    expect(updates[0][1]).toBeLessThanOrEqual(255);
  });
});
