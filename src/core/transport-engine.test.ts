import { describe, expect, it } from 'vitest';
import { advanceTransport, makeTransportSnapshot, musicalPosition, updateTransport } from './transport-engine';

describe('transport engine', () => {
  it('maps time into musical position', () => {
    expect(musicalPosition(0, 120, 4)).toEqual({ bar: 1, beat: 1, phase: 0 });
    expect(musicalPosition(2500, 120, 4)).toEqual({ bar: 2, beat: 2, phase: 0 });
  });

  it('keeps one timebase while changing source', () => {
    const local = makeTransportSnapshot({ bpm: 130, positionMs: 1000, source: 'internal' });
    const ableton = updateTransport(local, { source: 'ableton', playing: true, positionMs: 1200 });
    expect(ableton.source).toBe('ableton');
    expect(ableton.bpm).toBe(130);
    expect(ableton.positionMs).toBe(1200);
  });

  it('advances only while playing', () => {
    const stopped = makeTransportSnapshot({ playing: false, positionMs: 400 });
    expect(advanceTransport(stopped, 100).positionMs).toBe(400);
    const playing = makeTransportSnapshot({ playing: true, positionMs: 400 });
    expect(advanceTransport(playing, 100).positionMs).toBe(500);
  });
});
