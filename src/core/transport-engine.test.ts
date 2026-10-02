import { describe, expect, it } from 'vitest';
import { TransportEngine } from './transport-engine';

describe('TransportEngine', () => {
  it('gives local controls immediate authority', () => {
    const engine = new TransportEngine({ bpm: 120 }, 1500);
    expect(engine.apply({ source: 'midi', playing: true, bpm: 128, claim: true }, 100).accepted).toBe(true);
    const local = engine.forceLocal({ playing: false, positionMs: 2000 }, 200);
    expect(local.accepted).toBe(true);
    expect(local.state).toMatchObject({ source: 'local', playing: false, positionMs: 2000 });
  });

  it('prevents a lower-priority source from stealing an active lease', () => {
    const engine = new TransportEngine({}, 1500);
    engine.apply({ source: 'ableton', playing: true, positionMs: 1000, bpm: 132, claim: true }, 100);
    const midi = engine.apply({ source: 'midi', playing: true, positionMs: 2000, bpm: 120, claim: true }, 200);
    expect(midi.accepted).toBe(false);
    expect(midi.state.source).toBe('ableton');
    expect(midi.state.positionMs).toBe(1000);
  });

  it('lets another source claim transport after the lease expires', () => {
    const engine = new TransportEngine({}, 1000);
    engine.apply({ source: 'studio', playing: true, positionMs: 500, bpm: 110, claim: true }, 100);
    const midi = engine.apply({ source: 'midi', playing: true, positionMs: 900, bpm: 118, claim: true }, 1200);
    expect(midi.accepted).toBe(true);
    expect(midi.state.source).toBe('midi');
  });

  it('advances a claimed clock without allowing negative positions or invalid bpm', () => {
    const engine = new TransportEngine({ positionMs: 0, bpm: 120 }, 1500);
    const result = engine.advance('midi', 20.833, 900, 100);
    expect(result.accepted).toBe(true);
    expect(result.state.positionMs).toBeCloseTo(20.833, 3);
    expect(result.state.bpm).toBe(300);
  });
});
