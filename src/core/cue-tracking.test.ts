import { describe, expect, it } from 'vitest';
import { makeUniverse } from '../lib/dmx';
import { cueChanges, resolveTrackedCueFrame } from './cue-tracking';

describe('cue tracking', () => {
  it('stores only changed channels', () => {
    const a = makeUniverse();
    const b = [...a];
    b[0] = 255;
    b[99] = 42;
    expect(cueChanges(a, b)).toEqual([[1, 255], [100, 42]]);
  });

  it('inherits untouched channels through later cues', () => {
    const frame = resolveTrackedCueFrame([
      { id: '1', changes: [[1, 255], [2, 10]] },
      { id: '2', changes: [[2, 100]] }
    ], 1);
    expect(frame[0]).toBe(255);
    expect(frame[1]).toBe(100);
  });
});
