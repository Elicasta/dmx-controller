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
    expect(result.fixtures[0]).toMatchObject({ universe: 1, address: 1, profileId: 'generic-rgbw-par', modeId: '5ch-drgbw' });
    expect(result.fixtures[0].intensity).toBeCloseTo(128 / 255);
    expect(result.fixtures[0].color).toBe('#ff4010');
  });
});
