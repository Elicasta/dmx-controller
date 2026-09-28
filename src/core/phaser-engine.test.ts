import { describe, expect, it } from 'vitest';
import { applyUniverseUpdates, makeUniverse } from '../lib/dmx';
import { DEFAULT_PATCH, migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import { phaserCycleMs, phaserStepValue, phaserValueAt, renderPhaserEffect, renderPhaserProgram, type PhaserEffect } from './phaser-engine';

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

  it('uses fixture order to assign distinct 16-bit phase positions', () => {
    const fixtures = [mover('one', 1), mover('two', 20), mover('three', 40), mover('four', 60)];
    const forward = renderPhaserEffect({ ...base, waveform: 'saw', orderMode: 'forward' }, fixtures, 0);
    const reverse = renderPhaserEffect({ ...base, waveform: 'saw', orderMode: 'reverse' }, fixtures, 0);
    expect(forward.filter(([channel]) => [1, 20, 40, 60].includes(channel)).map(([, value]) => value)).toEqual([0, 85, 170, 0]);
    expect(reverse.filter(([channel]) => [1, 20, 40, 60].includes(channel)).map(([, value]) => value)).toEqual([0, 170, 85, 0]);
    expect(forward.map(([channel]) => channel)).toEqual([1, 2, 20, 21, 40, 41, 60, 61]);
  });

  it('lets blocks share phase and wings mirror phase', () => {
    const fixtures = [mover('one', 1), mover('two', 20), mover('three', 40), mover('four', 60)];
    const blocked = renderPhaserEffect({ ...base, waveform: 'saw', phaseSpread: 50, order: { mode: 'forward', blocks: 2 } }, fixtures, 0);
    const winged = renderPhaserEffect({ ...base, waveform: 'saw', phaseSpread: 50, order: { mode: 'forward', wings: 2 } }, fixtures, 0);
    expect(blocked.filter(([channel]) => [1, 20, 40, 60].includes(channel)).map(([, value]) => value)).toEqual([0, 0, 128, 128]);
    expect(winged.filter(([channel]) => [1, 20, 40, 60].includes(channel)).map(([, value]) => value)).toEqual([0, 128, 128, 0]);
  });

  it('renders paired Pan/Tilt motion through fine channels', () => {
    const fixture = mover('paired', 1);
    const updates = renderPhaserProgram({
      bpm: 120,
      phaseSpread: 0,
      cycleBeats: 1,
      lanes: [
        { parameter: 'pan', waveform: 'sine', depth: 40, offset: 0, mode: 'relative' },
        { parameter: 'tilt', waveform: 'sine', depth: 40, offset: 0, phaseOffset: .25, mode: 'relative' }
      ]
    }, [fixture], 125, makeUniverse());
    expect(updates.map(([channel]) => channel)).toEqual([1, 2, 3, 4]);
    expect(updates[0][1]).not.toBe(updates[2][1]);
  });

  it('does not let unsupported fixtures consume movement phase slots', () => {
    const first = mover('first-mover', 20);
    const second = mover('second-mover', 40);
    const par = { ...DEFAULT_PATCH[0], id: 'par-between', address: 100, selected: true };
    const updates = renderPhaserEffect({
      ...base,
      waveform: 'saw',
      phaseSpread: 50
    }, [first, par, second], 0);
    expect(updates.filter(([channel]) => [20, 40].includes(channel)).map(([, value]) => value)).toEqual([0, 128]);
  });

  it('does not rewrite Tilt when a phaser only owns Pan', () => {
    const fixture = mover('pan-only', 1);
    const updates = renderPhaserEffect({ ...base, phaseSpread: 0 }, [fixture], 125, makeUniverse());
    expect(updates.map(([channel]) => channel)).toEqual([1, 2]);
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
  it('renders weighted step recipes with hold and transition regions', () => {
    const steps = [
      { value: 0, width: 1, transition: 50 },
      { value: 100, width: 1, transition: 0 }
    ];
    expect(phaserStepValue(steps, 0)).toBe(0);
    expect(phaserStepValue(steps, .125)).toBe(0);
    expect(phaserStepValue(steps, .375)).toBeCloseTo(.5, 4);
    expect(phaserStepValue(steps, .6)).toBe(1);
  });

  it('applies step acceleration and deceleration without changing endpoints', () => {
    const linear = [
      { value: 0, transition: 100 },
      { value: 100, transition: 100 }
    ];
    const eased = [
      { value: 0, transition: 100, acceleration: 100, deceleration: 100 },
      { value: 100, transition: 100, acceleration: 100, deceleration: 100 }
    ];
    expect(phaserStepValue(eased, 0)).toBe(0);
    expect(phaserStepValue(eased, .25)).toBeCloseTo(.5, 4);
    expect(phaserStepValue(eased, .125)).toBeLessThan(phaserStepValue(linear, .125));
  });

  it('renders independent multi-attribute step lanes in one program', () => {
    const fixture = mover('multi-lane', 1);
    const updates = renderPhaserProgram({
      bpm: 120,
      phaseSpread: 0,
      cycleBeats: 1,
      lanes: [
        { parameter: 'pan', waveform: 'sine', depth: 40, offset: 0, mode: 'relative' },
        { parameter: 'dimmer', waveform: 'step', depth: 100, offset: 0, steps: [
          { value: 100, width: 1, transition: 0 },
          { value: 0, width: 1, transition: 0 }
        ] }
      ]
    }, [fixture], 0, makeUniverse());
    expect(updates.map(([channel]) => channel)).toEqual([9, 1, 2]);
    expect(updates.find(([channel]) => channel === 9)?.[1]).toBe(255);
  });

});
