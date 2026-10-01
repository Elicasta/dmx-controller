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
    candidates.push({ bpm, lag, score: normalized + halfScore * .16 });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  let best = candidates[0];

  // Prefer the musical double-time interpretation when it is nearly as strong.
  const double = candidates.find((candidate) => Math.abs(candidate.bpm - best.bpm * 2) <= 1);
  if (best.bpm < 82 && double && double.score >= best.score * .88) best = double;
  const half = candidates.find((candidate) => Math.abs(candidate.bpm - best.bpm / 2) <= 1);
  if (best.bpm > 176 && half && half.score >= best.score * .92) best = half;

  const phaseScores = Array.from({ length: best.lag }, () => 0);
  for (let phase = 0; phase < best.lag; phase += 1) {
    let score = 0;
    for (let frame = phase; frame < frameCount; frame += best.lag) {
      const center = novelty[frame];
      const before = frame > 0 ? novelty[frame - 1] : 0;
      const after = frame + 1 < frameCount ? novelty[frame + 1] : 0;
      score += center + Math.max(before, after) * .35;
    }
    phaseScores[phase] = score;
  }
  const bestPhase = phaseScores.reduce((winner, score, index) => score > phaseScores[winner] ? index : winner, 0);

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
