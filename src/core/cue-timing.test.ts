import { describe, expect, it } from 'vitest';
import { makeUniverse } from '../lib/dmx';
import { migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import type { ShowCue } from '../lib/show';
import { cueChannelTimings, cuePlaybackDuration, renderCueTimedFrame } from './cue-timing';

function mover(): PatchedFixture {
  return migratePatchedFixture({
    id: 'm1',
    name: 'Mover 1',
    profileId: 'generic-moving-head',
    modeId: '14ch-common',
    universe: 1,
    address: 1,
    group: 'Movers',
    selected: true,
    collapsed: false
  }, 0, 1);
}

function cue(): ShowCue {
  return {
    id: 'cue-1',
    number: 1,
    name: 'Split timing',
    fadeMs: 1000,
    fadeOutMs: 400,
    values: { red: 0, green: 0, blue: 0, uv: 0, dimmer: 0 },
    timing: [
      { family: 'position', fadeMs: 4000, delayMs: 0, curve: 'linear' },
      { family: 'beam', fadeMs: 0, delayMs: 250, curve: 'snap' }
    ]
  };
}

describe('cue family timing', () => {
  it('maps semantic fixture families to DMX channels', () => {
    const timing = cueChannelTimings(cue(), [mover()]);
    expect(timing.get(1)?.fadeMs).toBe(4000);
    expect(timing.get(2)?.fadeMs).toBe(4000);
    expect(timing.get(8)?.delayMs).toBe(250);
  });

  it('lets position glide while beam waits and snaps', () => {
    const from = makeUniverse();
    const target = makeUniverse();
    target[0] = 255; // pan
    target[7] = 255; // strobe

    const mid = renderCueTimedFrame(cue(), from, target, 1000, [mover()]);
    expect(mid[0]).toBeGreaterThan(0);
    expect(mid[0]).toBeLessThan(255);
    expect(mid[7]).toBe(255);
    expect(cuePlaybackDuration(cue(), from, target, [mover()])).toBe(4000);
  });

  it('does not extend snap timing by an unused fade duration', () => {
    const from = makeUniverse();
    const target = makeUniverse();
    target[7] = 255;
    const snapCue = cue();
    snapCue.timing = [{ family: 'beam', fadeMs: 5000, delayMs: 250, curve: 'snap' }];
    expect(cuePlaybackDuration(snapCue, from, target, [mover()])).toBe(250);
  });

  it('uses fade-out timing when intensity falls', () => {
    const from = makeUniverse();
    const target = makeUniverse();
    from[8] = 255; // dimmer at address 1 + offset 8
    const frame = renderCueTimedFrame(cue(), from, target, 200, [mover()]);
    expect(frame[8]).toBeGreaterThan(0);
    expect(frame[8]).toBeLessThan(255);
  });
});
