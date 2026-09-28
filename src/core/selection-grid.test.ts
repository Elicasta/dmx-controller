import { describe, expect, it } from 'vitest';
import { makeSelectionGrid, moveFixtureInSelectionGrid, normalizeSelectionGrid, selectionGridOrder } from './selection-grid';

describe('selection grid', () => {
  it('persists a two-dimensional row layout and derives deterministic order', () => {
    const grid = makeSelectionGrid(['a', 'b', 'c', 'd'], 2);
    expect(grid).toMatchObject({ rows: 2, columns: 2, traversal: 'row' });
    expect(selectionGridOrder(grid, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('supports column and snake traversals without changing fixture identity', () => {
    const rowGrid = makeSelectionGrid(['a', 'b', 'c', 'd'], 2);
    expect(selectionGridOrder({ ...rowGrid, traversal: 'column' }, ['a', 'b', 'c', 'd'])).toEqual(['a', 'c', 'b', 'd']);
    expect(selectionGridOrder({ ...rowGrid, traversal: 'snake-row' }, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'd', 'c']);
  });

  it('reconciles deleted and newly added fixtures while keeping saved cells', () => {
    const grid = makeSelectionGrid(['a', 'b', 'c'], 2);
    const next = normalizeSelectionGrid(grid, ['a', 'c', 'd']);
    expect(next.cells.map((cell) => cell.fixtureId).sort()).toEqual(['a', 'c', 'd']);
    expect(next.cells.find((cell) => cell.fixtureId === 'a')).toMatchObject({ row: 0, column: 0 });
  });

  it('swaps fixtures when a move targets an occupied cell', () => {
    const grid = makeSelectionGrid(['a', 'b', 'c', 'd'], 2);
    const moved = moveFixtureInSelectionGrid(grid, ['a', 'b', 'c', 'd'], 'a', 1, 1);
    expect(moved.cells.find((cell) => cell.fixtureId === 'a')).toMatchObject({ row: 1, column: 1 });
    expect(moved.cells.find((cell) => cell.fixtureId === 'd')).toMatchObject({ row: 0, column: 0 });
  });
});
