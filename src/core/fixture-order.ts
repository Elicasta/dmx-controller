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
  blocks?: number;
  groups?: number;
  wings?: number;
  shift?: number;
};

function safeCount(count: number): number {
  return Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
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
  if (mode === 'odd-even') return [...indices.filter((i) => i % 2 === 0), ...indices.filter((i) => i % 2 === 1)];
  if (mode === 'even-odd') return [...indices.filter((i) => i % 2 === 1), ...indices.filter((i) => i % 2 === 0)];
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

function applyBlocks(order: readonly number[], blocks: number): number[] {
  const size = Math.max(1, Math.floor(blocks));
  if (size === 1) return [...order];
  const result: number[] = [];
  for (let index = 0; index < order.length; index += size) {
    result.push(...order.slice(index, index + size));
  }
  return result;
}

function applyGroups(order: readonly number[], groups: number): number[] {
  const groupCount = Math.max(1, Math.min(order.length || 1, Math.floor(groups)));
  if (groupCount === 1 || !order.length) return [...order];
  const result: number[] = [];
  for (let group = 0; group < groupCount; group += 1) {
    for (let index = group; index < order.length; index += groupCount) result.push(order[index]);
  }
  return result;
}

function applyWings(order: readonly number[], wings: number): number[] {
  const wingCount = Math.max(1, Math.floor(wings));
  if (wingCount === 1 || order.length < 2) return [...order];
  const wingSize = Math.ceil(order.length / wingCount);
  const result: number[] = [];
  for (let wing = 0; wing < wingCount; wing += 1) {
    const section = order.slice(wing * wingSize, (wing + 1) * wingSize);
    result.push(...(wing % 2 === 0 ? section : [...section].reverse()));
  }
  return result;
}

export function fixtureOrderIndices(count: number, spec: FixtureOrderSpec | FixtureOrderMode = 'forward'): number[] {
  const normalized: FixtureOrderSpec = typeof spec === 'string' ? { mode: spec } : spec;
  const mode = normalized.mode ?? 'forward';
  let order = baseOrder(count, mode);
  order = applyBlocks(order, normalized.blocks ?? 1);
  order = applyGroups(order, normalized.groups ?? 1);
  order = applyWings(order, normalized.wings ?? 1);
  order = rotate(order, normalized.shift ?? 0);
  return order;
}

export function fixturePhasePositions(count: number, spec: FixtureOrderSpec | FixtureOrderMode = 'forward'): number[] {
  const safe = safeCount(count);
  if (safe <= 0) return [];
  if (safe === 1) return [0];

  const normalized: FixtureOrderSpec = typeof spec === 'string' ? { mode: spec } : spec;
  const mode = normalized.mode ?? 'forward';

  if (mode === 'mirror-pairs'
      && (normalized.blocks ?? 1) === 1
      && (normalized.groups ?? 1) === 1
      && (normalized.wings ?? 1) === 1
      && (normalized.shift ?? 0) === 0) {
    const maxTier = Math.max(1, Math.ceil(safe / 2) - 1);
    return Array.from({ length: safe }, (_, index) => Math.min(index, safe - 1 - index) / maxTier);
  }

  const ordered = rotate(baseOrder(safe, mode), normalized.shift ?? 0);
  const rankByFixture = Array(safe).fill(0);
  ordered.forEach((fixtureIndex, rank) => { rankByFixture[fixtureIndex] = rank; });

  const blockSize = Math.max(1, Math.floor(normalized.blocks ?? 1));
  const blockCount = Math.max(1, Math.ceil(safe / blockSize));
  const groupCount = Math.max(1, Math.min(blockCount, Math.floor(normalized.groups ?? 1)));
  const wingCount = Math.max(1, Math.min(blockCount, Math.floor(normalized.wings ?? 1)));

  const phaseByFixture = rankByFixture.map((rank) => {
    const block = Math.floor(rank / blockSize);

    if (groupCount > 1) {
      const groupSlot = block % groupCount;
      return groupCount === 1 ? 0 : groupSlot / (groupCount - 1);
    }

    if (wingCount > 1) {
      const wingSize = Math.ceil(blockCount / wingCount);
      const wing = Math.min(wingCount - 1, Math.floor(block / wingSize));
      const local = block % wingSize;
      const actualSize = Math.min(wingSize, blockCount - wing * wingSize);
      const mirrored = wing % 2 === 0 ? local : Math.max(0, actualSize - 1 - local);
      return actualSize <= 1 ? 0 : mirrored / (actualSize - 1);
    }

    return blockCount <= 1 ? 0 : block / (blockCount - 1);
  });

  return phaseByFixture;
}

export function orderFixtures<T>(items: readonly T[], spec: FixtureOrderSpec | FixtureOrderMode = 'forward'): T[] {
  return fixtureOrderIndices(items.length, spec).map((index) => items[index]);
}
