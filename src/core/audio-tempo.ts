export type TempoEstimate = {
  bpm: number;
  beatMs: number;
  firstBeatMs: number;
  confidence: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Lightweight offline tempo estimator for timeline alignment.
 *
 * It intentionally returns a suggestion rather than silently changing the show.
 * The timeline can apply the BPM and phase, while the operator keeps the final
 * say over musical downbeats.
 */
export function estimateTempoFromSamples(
  samples: Float32Array,
  sampleRate: number,
  minBpm = 60,
  maxBpm = 200
): TempoEstimate | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < sampleRate * 2) return null;

  const hop = Math.max(64, Math.round(sampleRate * .01));
  const frameCount = Math.floor(samples.length / hop);
  if (frameCount < 80) return null;

  const energy = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hop;
    const end = Math.min(samples.length, start + hop);
    let total = 0;
    for (let index = start; index < end; index += 1) {
      const value = samples[index];
      total += value * value;
    }
    energy[frame] = Math.sqrt(total / Math.max(1, end - start));
  }

  const novelty = new Float32Array(frameCount);
  let noveltyEnergy = 0;
  for (let frame = 1; frame < frameCount; frame += 1) {
    let localAverage = 0;
    let localCount = 0;
    for (let prior = Math.max(0, frame - 10); prior < frame; prior += 1) {
      localAverage += energy[prior];
      localCount += 1;
    }
    localAverage /= Math.max(1, localCount);
    const rise = Math.max(0, energy[frame] - localAverage * .82);
    novelty[frame] = rise;
    noveltyEnergy += rise * rise;
  }
  if (noveltyEnergy <= 1e-8) return null;

  const secondsPerFrame = hop / sampleRate;

  const maxNovelty = novelty.reduce((max, value) => Math.max(max, value), 0);
  const peakThreshold = maxNovelty * .22;
  const peakFrames: number[] = [];
  const minimumPeakGap = Math.max(2, Math.round((60 / maxBpm) / secondsPerFrame * .55));
  let lastPeak = -minimumPeakGap;
  for (let frame = 2; frame < frameCount - 2; frame += 1) {
    const value = novelty[frame];
    if (value < peakThreshold) continue;
    if (value < novelty[frame - 1] || value < novelty[frame + 1] || value < novelty[frame - 2] || value < novelty[frame + 2]) continue;
    if (frame - lastPeak < minimumPeakGap) {
      if (peakFrames.length && value > novelty[peakFrames[peakFrames.length - 1]]) {
        peakFrames[peakFrames.length - 1] = frame;
        lastPeak = frame;
      }
      continue;
    }
    peakFrames.push(frame);
    lastPeak = frame;
  }

  const intervals = peakFrames
    .slice(1)
    .map((frame, index) => (frame - peakFrames[index]) * secondsPerFrame)
    .filter((seconds) => seconds >= .18 && seconds <= 1.5);
  let preferredBpm: number | null = null;
  let intervalConsistency = 0;
  if (intervals.length >= 3) {
    const medianInterval = median(intervals);
    preferredBpm = 60 / medianInterval;
    while (preferredBpm < 80) preferredBpm *= 2;
    while (preferredBpm > 180) preferredBpm /= 2;
    const deviations = intervals.map((value) => Math.abs(value - medianInterval));
    const relativeDeviation = median(deviations) / Math.max(.001, medianInterval);
    intervalConsistency = clamp(1 - relativeDeviation / .2, 0, 1);
  }

  const candidates: Array<{ bpm: number; lag: number; score: number }> = [];
  for (let bpm = Math.ceil(minBpm); bpm <= Math.floor(maxBpm); bpm += 1) {
    const lag = Math.max(1, Math.round((60 / bpm) / secondsPerFrame));
    let score = 0;
    let leftPower = 0;
    let rightPower = 0;
    for (let frame = lag; frame < frameCount; frame += 1) {
      const left = novelty[frame];
      const right = novelty[frame - lag];
      score += left * right;
      leftPower += left * left;
      rightPower += right * right;
    }
    const normalized = score / Math.sqrt(Math.max(1e-12, leftPower * rightPower));
    // Reward a stable half-time relationship without forcing a specific genre.
    const doubleLag = lag * 2;
    let halfScore = 0;
    if (doubleLag < frameCount) {
      let halfLeft = 0;
      let halfRight = 0;
      for (let frame = doubleLag; frame < frameCount; frame += 1) {
        const left = novelty[frame];
        const right = novelty[frame - doubleLag];
        halfScore += left * right;
        halfLeft += left * left;
        halfRight += right * right;
      }
      halfScore /= Math.sqrt(Math.max(1e-12, halfLeft * halfRight));
    }
    const preferredBoost = preferredBpm === null
      ? 0
      : Math.exp(-Math.pow((bpm - preferredBpm) / 5, 2)) * .34;
    const tempoPrior = Math.exp(-Math.pow((bpm - 120) / 75, 2)) * .025;
    candidates.push({ bpm, lag, score: normalized + halfScore * .08 + preferredBoost + tempoPrior });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  let best = candidates[0];

  if (preferredBpm !== null) {
    const preferredRounded = Math.round(preferredBpm);
    const preferred = candidates.find((candidate) => candidate.bpm === preferredRounded)
      ?? candidates.reduce((nearest, candidate) =>
        Math.abs(candidate.bpm - preferredBpm!) < Math.abs(nearest.bpm - preferredBpm!) ? candidate : nearest
      );
    if (intervalConsistency >= .72 || preferred.score >= best.score * .82) best = preferred;
  }

  const phaseScores = Array.from({ length: best.lag }, () => 0);
  if (!peakFrames.length) {
    for (let phase = 0; phase < best.lag; phase += 1) {
      for (let frame = phase; frame < frameCount; frame += best.lag) phaseScores[phase] += novelty[frame];
    }
  }
  const bestPhase = peakFrames.length
    ? Math.round(((peakFrames[0] * secondsPerFrame * 1000) % (60000 / best.bpm)) / (secondsPerFrame * 1000)) % best.lag
    : phaseScores.reduce((winner, score, index) => score > phaseScores[winner] ? index : winner, 0);

  const baseline = median(candidates.map((candidate) => candidate.score));
  const confidence = clamp((best.score - baseline) / Math.max(.08, 1 - baseline), 0, 1);
  const beatMs = 60000 / best.bpm;

  return {
    bpm: Math.round(best.bpm),
    beatMs,
    firstBeatMs: bestPhase * secondsPerFrame * 1000,
    confidence
  };
}

export function beatSnapStep(beatsPerBar: number, division: 'bar' | 'beat' | 'half-beat' | 'quarter-beat' | 'free') {
  const safeBeats = Math.max(1, Math.round(beatsPerBar));
  if (division === 'bar') return 1;
  if (division === 'beat') return 1 / safeBeats;
  if (division === 'half-beat') return 1 / safeBeats / 2;
  if (division === 'quarter-beat') return 1 / safeBeats / 4;
  return 1 / safeBeats / 16;
}
