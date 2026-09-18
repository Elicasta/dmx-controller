import { describe, expect, it } from 'vitest';
import { clampDmx, makeUniverse, setUniverseChannel } from './dmx';

describe('DMX helpers', () => {
  it('clamps values to a DMX byte', () => {
    expect(clampDmx(-2)).toBe(0);
    expect(clampDmx(127.6)).toBe(128);
    expect(clampDmx(900)).toBe(255);
  });

  it('creates a 512-channel zeroed universe', () => {
    const universe = makeUniverse();
    expect(universe).toHaveLength(512);
    expect(universe.every((value) => value === 0)).toBe(true);
  });

  it('uses human-friendly one-based channel numbers', () => {
    const universe = setUniverseChannel(makeUniverse(), 1, 255);
    expect(universe[0]).toBe(255);
    expect(universe[1]).toBe(0);
  });
});
