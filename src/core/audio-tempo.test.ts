import { describe, expect, it } from 'vitest';
import { beatSnapStep, estimateTempoFromSamples } from './audio-tempo';

function pulseTrack(bpm: number, seconds: number, sampleRate: number, phaseMs = 0) {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  const beatSamples = Math.round((60 / bpm) * sampleRate);
  const phaseSamples = Math.round(phaseMs / 1000 * sampleRate);
  for (let start = phaseSamples; start < samples.length; start += beatSamples) {
    for (let offset = 0; offset < Math.min(32, beatSamples / 4) && start + offset < samples.length; offset += 1) {
      samples[start + offset] += Math.exp(-offset / 6);
    }
  }
  return samples;
}

describe('audio tempo analysis', () => {
  it('estimates a steady 120 BPM pulse track', () => {
    const sampleRate = 2000;
    const result = estimateTempoFromSamples(pulseTrack(120, 20, sampleRate, 120), sampleRate);
    expect(result).not.toBeNull();
    expect(result!.bpm).toBeGreaterThanOrEqual(118);
    expect(result!.bpm).toBeLessThanOrEqual(122);
    expect(result!.beatMs).toBeCloseTo(500, -1);
  });

  it('finds the recurring beat phase', () => {
    const sampleRate = 2000;
    const result = estimateTempoFromSamples(pulseTrack(100, 24, sampleRate, 150), sampleRate);
    expect(result).not.toBeNull();
    const phase = result!.firstBeatMs % result!.beatMs;
    expect(Math.min(Math.abs(phase - 150), Math.abs((phase + result!.beatMs) - 150))).toBeLessThan(80);
  });

  it('maps musical snap divisions into bar units', () => {
    expect(beatSnapStep(4, 'bar')).toBe(1);
    expect(beatSnapStep(4, 'beat')).toBe(.25);
    expect(beatSnapStep(4, 'half-beat')).toBe(.125);
    expect(beatSnapStep(4, 'quarter-beat')).toBe(.0625);
  });
});
