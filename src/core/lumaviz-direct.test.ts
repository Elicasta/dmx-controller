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

it('maps a no-dimmer RGBWAUV fixture without scaling its separate emitters',()=>{
  const direct:PatchedFixture={...fixture,profileId:'adj-mega-hex-par',modeId:'6ch-direct',address:50,universe:2};
  const dmx=Array(512).fill(0); dmx[49]=64; dmx[50]=32; dmx[51]=16; dmx[52]=200; dmx[53]=70; dmx[54]=30;
  const state=semanticFrameFromResolvedOutput(1,dmx,[direct],2).fixtures[0];
  expect(state.intensity).toBe(1);
  expect(state.color).toBe('#402010');
  expect(state.emitters?.amber).toBeCloseTo(200/255);
  expect(state.emitters?.white).toBeCloseTo(70/255);
});
it('keeps a wheel fixture neutral when its wheel slots are unverified',()=>{
  const moving:PatchedFixture={...fixture,profileId:'generic-moving-head',modeId:'14ch-common',address:100,universe:2};
  const dmx=Array(512).fill(0);dmx[99]=128;dmx[100]=255;dmx[101]=64;dmx[102]=127;dmx[106]=128;dmx[107]=200;
  const state=semanticFrameFromResolvedOutput(1,dmx,[moving],2).fixtures[0];
  expect(state.pan).toBeCloseTo(((128*256+255)/65535-.5)*540,7);
  expect(state.tilt).toBeCloseTo(((64*256+127)/65535-.5)*270,7);
  expect(state.strobeHz).toBeCloseTo(128/255*20);
  expect(state.intensity).toBeCloseTo(200/255);
  expect(state.color).toBe('#ffffff');
});
