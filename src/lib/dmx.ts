export const DMX_CHANNELS = 512;
export const VISIBLE_CHANNELS = 16;
export type DmxUpdate = readonly [channel: number, value: number];

export function clampDmx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function makeUniverse(): number[] {
  return Array.from({ length: DMX_CHANNELS }, () => 0);
}

export function setUniverseChannel(
  universe: readonly number[],
  channel: number,
  value: number
): number[] {
  if (channel < 1 || channel > DMX_CHANNELS) {
    throw new RangeError(`DMX channel must be 1-${DMX_CHANNELS}`);
  }

  const next = [...universe];
  next[channel - 1] = clampDmx(value);
  return next;
}

export function applyUniverseUpdates(
  universe: readonly number[],
  updates: ReadonlyArray<DmxUpdate>
): number[] {
  return updates.reduce(
    (next, [channel, value]) => setUniverseChannel(next, channel, value),
    [...universe]
  );
}

export function interpolateUniverse(
  from: readonly number[],
  to: readonly number[],
  progress: number
): number[] {
  const amount = Math.max(0, Math.min(1, progress));
  return Array.from({ length: DMX_CHANNELS }, (_, index) => {
    const start = from[index] ?? 0;
    const end = to[index] ?? 0;
    return clampDmx(start + (end - start) * amount);
  });
}
