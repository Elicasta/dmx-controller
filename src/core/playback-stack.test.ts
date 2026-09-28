import { describe, expect, it } from 'vitest';
import { makeUniverse } from '../lib/dmx';
import { resolvePlaybackStack } from './playback-stack';

describe('playback stack', () => {
  it('lets higher-priority LTP layers win', () => {
    const frame = resolvePlaybackStack(makeUniverse(), [
      { id: 'cue', priority: 10, mode: 'ltp', values: new Map([[1, 80]]) },
      { id: 'busk', priority: 20, mode: 'ltp', values: new Map([[1, 200]]) }
    ]);
    expect(frame[0]).toBe(200);
  });

  it('uses HTP for intensity channels', () => {
    const frame = resolvePlaybackStack(makeUniverse(), [
      { id: 'cue', priority: 10, mode: 'ltp', values: new Map([[5, 220]]) },
      { id: 'override', priority: 20, mode: 'ltp', values: new Map([[5, 100]]) }
    ], new Set([5]));
    expect(frame[4]).toBe(220);
  });
});
