import { describe, expect, it } from 'vitest';
import { semanticFrameFromResolvedOutput } from './lumaviz-direct';
import type { PatchedFixture } from '../lib/fixtures';

const fixture: PatchedFixture = {
  id: 'par-1', name: 'Par 1', profileId: 'generic-rgbw-par', modeId: '5ch-drgbw',
  universe: 1, address: 1, group: 'Wash', selected: false, collapsed: false
};

describe('LumaRig Direct semantic encoder', () => {
  it('encodes the final resolved fixture state instead of raw DMX', () => {
    const dmx = Array(512).fill(0);
    dmx[0] = 128; dmx[1] = 255; dmx[2] = 64; dmx[3] = 16; dmx[4] = 0;
    const result = semanticFrameFromResolvedOutput(42, dmx, [fixture], 1, 'Sunday');
    expect(result.version).toBe(1);
    expect(result.sequence).toBe(42);
    expect(result.showId).toBe('Sunday');
    expect(result.fixtures[0].id).toBe('par-1');
    expect(result.fixtures[0].intensity).toBeCloseTo(128 / 255);
    expect(result.fixtures[0].color).toBe('#ff4010');
  });
});


it('preserves 16-bit pan and tilt precision at non-first patch addresses', () => {
  const moving: PatchedFixture = { ...fixture, profileId: 'generic-moving-head', modeId: '14ch-common', address: 100 };
  const dmx = Array(512).fill(0); dmx[99]=128; dmx[100]=255; dmx[101]=64; dmx[102]=127;
  const state=semanticFrameFromResolvedOutput(1,dmx,[moving],1).fixtures[0];
  expect(state.pan).toBeCloseTo(((128*256+255)/65535-.5)*540,8);
  expect(state.tilt).toBeCloseTo(((64*256+127)/65535-.5)*270,8);
  expect(state.address).toBe(100);
});
