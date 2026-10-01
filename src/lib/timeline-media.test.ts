import { describe, expect, it } from 'vitest';
import { EMPTY_TIMELINE, isShowTimeline } from './show-design';
import { mediaWindow, mediaPosition, steppedBar } from './timeline-media';
import { buildWaveform, displayPeaks, peakWindow } from './media-waveform';
describe('timeline media boundaries', () => {
  it('keeps legacy media untrimmed and maps delayed, trimmed playback to source time', () => {
    expect(mediaWindow(EMPTY_TIMELINE, 10000)).toEqual({ startMs: 0, endMs: 10000, durationMs: 10000 });
    const window = mediaWindow({ ...EMPTY_TIMELINE, audioTrimInMs: 2000, audioTrimOutMs: 8000 }, 10000);
    expect(mediaPosition(999, 1000, window)).toBeNull();
    expect(mediaPosition(1000, 1000, window)).toBe(2000);
    expect(mediaPosition(6999, 1000, window)).toBe(7999);
    expect(mediaPosition(7000, 1000, window)).toBeNull();
  });
  it('clamps saved trim to relinked source duration', () => {
    expect(mediaWindow({ ...EMPTY_TIMELINE, audioTrimInMs: 2000, audioTrimOutMs: 8000 }, 3000).durationMs).toBe(1000);
    expect(mediaWindow({ ...EMPTY_TIMELINE, audioTrimInMs: 5000 }, 3000).durationMs).toBe(0);
    expect(mediaWindow(EMPTY_TIMELINE, NaN).durationMs).toBe(0);
  });
  it('rejects invalid trim checkpoints while retaining backward compatibility', () => {
    expect(isShowTimeline(EMPTY_TIMELINE)).toBe(true);
    expect(isShowTimeline({ ...EMPTY_TIMELINE, audioTrimInMs: 2000, audioTrimOutMs: 8000 })).toBe(true);
    for (const trim of [{ audioTrimInMs: -1 }, { audioTrimOutMs: Infinity }, { audioTrimInMs: 2, audioTrimOutMs: 1 }, { audioTrimInMs: 2, audioTrimOutMs: 2 }])
      expect(isShowTimeline({ ...EMPTY_TIMELINE, ...trim })).toBe(false);
  });
  it('steps beats in any time signature and whole bars without going negative', () => {
    expect(steppedBar(0, -1, 4)).toBe(0);
    expect(steppedBar(1, 1, 4)).toBe(1.25);
    expect(steppedBar(1, -1, 3)).toBeCloseTo(2 / 3);
    expect(steppedBar(1.5, 1, 4, true)).toBe(2.5);
  });
});
describe('waveform accuracy', () => {
  it('captures right-channel and final-sample transients without subsampling', async () => {
    const left = new Float32Array(1000), right = new Float32Array(1000);
    right[17] = -0.9; right[999] = 0.7;
    const wave = await buildWaveform({ duration: 1, length: 1000, numberOfChannels: 2, getChannelData: i => i ? right : left });
    expect(wave.peaks).toHaveLength(100);
    expect(Math.max(...wave.peaks)).toBeCloseTo(0.9);
    expect(wave.peaks[99]).toBeCloseTo(0.7);
    expect(displayPeaks(wave, 0, 1000, 10)[0]).toBeCloseTo(0.9);
    expect(displayPeaks(wave, 0, 500, 10).every(p => p < 0.95)).toBe(true);
  });
  it('retains strongest transients while slicing trimmed waveform and limits render cost', () => {
    const wave = { version: 1 as const, durationMs: 1000, peaks: [0.1, 0.2, 0.9, 0.1, 0.4, 1, 0, 0.3, 0.2, 0] };
    expect(displayPeaks(wave, 200, 600, 2)).toEqual([0.9, 1]);
    expect(displayPeaks(wave, 1000, 1000, 100)).toEqual([]);
    expect(peakWindow([new Float32Array([NaN, Infinity, -2])], 0, 3)).toBe(1);
  });
});
