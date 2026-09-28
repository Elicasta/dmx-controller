import { describe, expect, it } from 'vitest';
import { makeUniverse } from '../lib/dmx';
import { DEFAULT_PATCH, migratePatchedFixture } from '../lib/fixtures';
import {
  buildCueChannelFamilies,
  cueChanges,
  cueTransitionDuration,
  cueTransitionProgress,
  renderCueTransitionFrame,
  resolveCueFrame
} from './cue-engine';

describe('cue engine', () => {
  it('resolves tracked changes through a cue stack', () => {
    const base = makeUniverse();
    base[0] = 10;
    const cues = [
      { universe: base },
      { tracking: true, changes: [[1, 100] as const, [5, 200] as const] },
      { tracking: true, changes: [[1, 150] as const] }
    ];
    const resolved = resolveCueFrame(cues, 2);
    expect(resolved[0]).toBe(150);
    expect(resolved[4]).toBe(200);
  });

  it('diffs only channels that changed', () => {
    const before = makeUniverse();
    const after = [...before];
    after[0] = 255;
    after[20] = 42;
    expect(cueChanges(before, after)).toEqual([[1, 255], [21, 42]]);
  });

  it('maps fixture parameters into timing families', () => {
    const mover = migratePatchedFixture({
      id: 'm', name: 'Mover', profileId: 'generic-moving-head', modeId: '14ch-common',
      address: 20, group: 'Movers', selected: true, collapsed: false
    }, 0, 1);
    const families = buildCueChannelFamilies([DEFAULT_PATCH[0], mover]);
    expect(families.get(5)).toBe('intensity');
    expect(families.get(20)).toBe('position');
    expect(families.get(22)).toBe('position');
    expect(families.get(25)).toBe('color');
    expect(families.get(27)).toBe('beam');
  });

  it('supports linear, ease-in, ease-out, and s-curve transitions', () => {
    expect(cueTransitionProgress('linear', .25)).toBeCloseTo(.25);
    expect(cueTransitionProgress('ease-in', .5)).toBeCloseTo(.125);
    expect(cueTransitionProgress('ease-out', .5)).toBeCloseTo(.875);
    expect(cueTransitionProgress('s-curve', .5)).toBeCloseTo(.5);
  });

  it('uses per-family fade and delay without slowing unrelated attributes', () => {
    const from = makeUniverse();
    const target = makeUniverse();
    target[0] = 255;
    target[1] = 255;
    const channelFamilies = new Map([[1, 'color' as const], [2, 'position' as const]]);
    const timing = {
      color: { fadeMs: 1000, delayMs: 0 },
      position: { fadeMs: 2000, delayMs: 500 }
    };
    const half = renderCueTransitionFrame({
      from, target, elapsedMs: 500, fadeInMs: 1000, transition: 'linear', timing, channelFamilies
    });
    expect(half.frame[0]).toBe(128);
    expect(half.frame[1]).toBe(0);
    expect(half.done).toBe(false);
    expect(half.durationMs).toBe(2500);
  });

  it('uses Fade Out for falling intensity unless intensity timing overrides it', () => {
    const from = makeUniverse();
    const target = makeUniverse();
    from[4] = 255;
    const channelFamilies = new Map([[5, 'intensity' as const]]);
    const frame = renderCueTransitionFrame({
      from, target, elapsedMs: 1000, fadeInMs: 500, fadeOutMs: 2000,
      transition: 'linear', channelFamilies
    });
    expect(frame.frame[4]).toBe(128);
    expect(cueTransitionDuration({
      from, target, fadeInMs: 500, fadeOutMs: 2000, transition: 'linear', channelFamilies
    })).toBe(2000);
  });
});
