export type FixtureOrderMode =
  | 'forward'
  | 'reverse'
  | 'center-out'
  | 'outside-in'
  | 'odd-even'
  | 'even-odd'
  | 'mirror-pairs';

export type FixtureOrderSpec = {
  mode?: FixtureOrderMode;
  /** Contiguous fixtures that should behave as one phasing unit. */
  blocks?: number;
  /** Interleaves the selection into N sub-groups before phasing. */
  groups?: number;
  /** Splits the selection into mirrored/opposed phasing wings. */
  wings?: number;
  /** Circularly shifts selection order before phase assignment. */
  shift?: number;
};

function safeCount(count: number): number {
  return Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const numeric = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  return Math.max(min, Math.min(max, numeric));
}

function baseOrder(count: number, mode: FixtureOrderMode): number[] {
  const indices = Array.from({ length: safeCount(count) }, (_, index) => index);
  if (mode === 'reverse') return indices.reverse();

  if (mode === 'center-out' || mode === 'outside-in') {
    const center = (indices.length - 1) / 2;
    const sorted = [...indices].sort((left, right) => {
      const distance = Math.abs(left - center) - Math.abs(right - center);
      if (Math.abs(distance) > 1e-9) return distance;
      return left - right;
    });
    return mode === 'center-out' ? sorted : sorted.reverse();
  }

  if (mode === 'odd-even') {
    return [...indices.filter((index) => index % 2 === 0), ...indices.filter((index) => index % 2 === 1)];
  }

  if (mode === 'even-odd') {
    return [...indices.filter((index) => index % 2 === 1), ...indices.filter((index) => index % 2 === 0)];
  }

  if (mode === 'mirror-pairs') {
    const result: number[] = [];
    let left = 0;
    let right = indices.length - 1;
    while (left <= right) {
      result.push(left);
      if (right !== left) result.push(right);
      left += 1;
      right -= 1;
    }
    return result;
  }

  return indices;
}

function rotate<T>(items: readonly T[], shift: number): T[] {
  if (!items.length) return [];
  const offset = ((Math.round(shift) % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function interleaveGroups(order: readonly number[], groups: number): number[] {
  const groupCount = clampInteger(groups, 1, 1, Math.max(1, order.length));
  if (groupCount === 1 || order.length < 2) return [...order];

  const result: number[] = [];
  for (let group = 0; group < groupCount; group += 1) {
    for (let index = group; index < order.length; index += groupCount) {
      result.push(order[index]);
    }
  }
  return result;
}

/**
 * Returns the deterministic fixture traversal order. Blocks and wings affect phase
 * assignment rather than traversal because multiple fixtures can intentionally share
 * the same phase.
 */
export function fixtureOrderIndices(
  count: number,
  spec: FixtureOrderSpec | FixtureOrderMode = 'forward'
): number[] {
  const safe = safeCount(count);
  const normalized: FixtureOrderSpec = typeof spec === 'string' ? { mode: spec } : spec;
  let order = baseOrder(safe, normalized.mode ?? 'forward');
  order = interleaveGroups(order, normalized.groups ?? 1);
  order = rotate(order, normalized.shift ?? 0);
  return order;
}

function blockPhaseRanks(count: number, blockSize: number, wings: number): number[] {
  if (count <= 0) return [];
  const safeBlock = clampInteger(blockSize, 1, 1, count);
  const blockCount = Math.ceil(count / safeBlock);
  if (blockCount <= 1) return Array(count).fill(0);

  const safeWings = clampInteger(wings, 1, 1, blockCount);
  if (safeWings === 1) {
    return Array.from({ length: count }, (_, rank) => (
      Math.floor(rank / safeBlock) / Math.max(1, blockCount - 1)
    ));
  }

  const phases = Array(count).fill(0);
  const wingSize = Math.ceil(blockCount / safeWings);

  for (let block = 0; block < blockCount; block += 1) {
    const wing = Math.min(safeWings - 1, Math.floor(block / wingSize));
    const firstBlock = wing * wingSize;
    const blocksInWing = Math.min(wingSize, blockCount - firstBlock);
    const localBlock = block - firstBlock;
    const denominator = Math.max(1, blocksInWing - 1);
    const localPhase = localBlock / denominator;
    const phase = wing % 2 === 0 ? localPhase : 1 - localPhase;

    const firstFixture = block * safeBlock;
    for (let offset = 0; offset < safeBlock && firstFixture + offset < count; offset += 1) {
      phases[firstFixture + offset] = phase;
    }
  }

  return phases;
}

export function fixturePhasePositions(
  count: number,
  spec: FixtureOrderSpec | FixtureOrderMode = 'forward'
): number[] {
  const safe = safeCount(count);
  if (safe <= 0) return [];
  if (safe === 1) return [0];

  const normalized: FixtureOrderSpec = typeof spec === 'string' ? { mode: spec } : spec;
  if ((normalized.mode ?? 'forward') === 'mirror-pairs'
      && normalized.wings === undefined
      && normalized.blocks === undefined
      && (normalized.groups ?? 1) === 1
      && (normalized.shift ?? 0) === 0) {
    const maxTier = Math.max(1, Math.ceil(safe / 2) - 1);
    return Array.from({ length: safe }, (_, index) => (
      Math.min(index, safe - 1 - index) / maxTier
    ));
  }

  const order = fixtureOrderIndices(safe, normalized);

  // Explicit wings can create repeated/opposed phase ramps across one selection.
  const implicitWings = 1;

  const orderedPhases = blockPhaseRanks(
    safe,
    normalized.blocks ?? 1,
    normalized.wings ?? implicitWings
  );

  const phaseByFixture = Array(safe).fill(0);
  order.forEach((fixtureIndex, rank) => {
    phaseByFixture[fixtureIndex] = orderedPhases[rank] ?? 0;
  });
  return phaseByFixture;
}

export function orderFixtures<T>(
  items: readonly T[],
  spec: FixtureOrderSpec | FixtureOrderMode = 'forward'
): T[] {
  return fixtureOrderIndices(items.length, spec).map((index) => items[index]);
}
