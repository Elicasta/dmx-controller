import { barMs, type ShowTimeline } from '../lib/show-design';

type MediaTimeline = Pick<ShowTimeline, 'bpm' | 'beatsPerBar' | 'audioOffsetBars' | 'trimInMs' | 'trimOutMs'>;

export function timelineMediaRange(timeline: MediaTimeline, durationMs: number) {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : Number.MAX_SAFE_INTEGER;
  const trimInMs = Math.max(0, Math.min(duration, timeline.trimInMs ?? 0));
  const trimOutMs = Math.max(trimInMs, Math.min(duration, timeline.trimOutMs ?? duration));
  const startMs = timeline.audioOffsetBars * barMs(timeline);
  return { trimInMs, trimOutMs, startMs, endMs: startMs + trimOutMs - trimInMs };
}

/** Include every sample in every channel so short transients and stereo-only hits remain visible. */
export function waveformPeaks(channels: readonly Float32Array[], bins = 1400): number[] {
  const length = channels[0]?.length ?? 0;
  const count = Math.min(length, Math.max(1, Math.floor(bins)));
  return Array.from({ length: count }, (_, bin) => {
    let peak = 0;
    for (let i = Math.floor(bin * length / count); i < Math.floor((bin + 1) * length / count); i++) {
      for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i] ?? 0));
    }
    return Math.min(1, peak);
  });
}

/** Magnitudes avoid phase cancellation while retaining transients from either stereo channel. */
export function tempoSamples(channels: readonly Float32Array[]): Float32Array {
  const samples = new Float32Array(channels[0]?.length ?? 0);
  for (let i = 0; i < samples.length; i++) {
    for (const channel of channels) samples[i] = Math.max(samples[i], Math.abs(channel[i] ?? 0));
  }
  return samples;
}
