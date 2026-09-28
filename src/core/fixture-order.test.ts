import { describe, expect, it } from 'vitest';
import { fixtureOrderIndices, fixturePhasePositions, orderFixtures } from './fixture-order';

describe('fixture ordering', () => {
  it('supports forward and reverse', () => {
    expect(fixtureOrderIndices(5, 'forward')).toEqual([0, 1, 2, 3, 4]);
    expect(fixtureOrderIndices(5, 'reverse')).toEqual([4, 3, 2, 1, 0]);
  });

  it('supports center-out and outside-in', () => {
    expect(fixtureOrderIndices(6, 'center-out')).toEqual([2, 3, 1, 4, 0, 5]);
    expect(fixtureOrderIndices(6, 'outside-in')).toEqual([5, 0, 4, 1, 3, 2]);
  });

  it('supports odd/even banks and mirror pairs', () => {
    expect(fixtureOrderIndices(6, 'odd-even')).toEqual([0, 2, 4, 1, 3, 5]);
    expect(fixtureOrderIndices(4, 'mirror-pairs')).toEqual([0, 3, 1, 2]);
    expect(fixturePhasePositions(6, 'mirror-pairs')).toEqual([0, .5, 1, 1, .5, 0]);
  });

  it('supports shift and group transformations', () => {
    expect(fixtureOrderIndices(6, { mode: 'forward', groups: 2 })).toEqual([0, 2, 4, 1, 3, 5]);
    expect(fixtureOrderIndices(5, { mode: 'forward', shift: 2 })).toEqual([2, 3, 4, 0, 1]);
  });

  it('reorders arbitrary values', () => {
    expect(orderFixtures(['a', 'b', 'c', 'd'], 'mirror-pairs')).toEqual(['a', 'd', 'b', 'c']);
  });
});
