export type SelectionGridTraversal = 'row' | 'column' | 'snake-row' | 'snake-column';

export type SelectionGridCell = {
  fixtureId: string;
  row: number;
  column: number;
};

export type FixtureSelectionGrid = {
  rows: number;
  columns: number;
  traversal: SelectionGridTraversal;
  cells: SelectionGridCell[];
};

function clampWhole(value: number, fallback: number, min: number, max: number): number {
  const numeric = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, numeric));
}

function firstFreeCell(used: Set<string>, rows: number, columns: number): { row: number; column: number } {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!used.has(`${row}:${column}`)) return { row, column };
    }
  }
  return { row: rows - 1, column: columns - 1 };
}

export function makeSelectionGrid(
  fixtureIds: readonly string[],
  columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, fixtureIds.length))))
): FixtureSelectionGrid {
  const safeColumns = clampWhole(columns, 1, 1, 32);
  const rows = Math.max(1, Math.ceil(Math.max(1, fixtureIds.length) / safeColumns));
  return {
    rows,
    columns: safeColumns,
    traversal: 'row',
    cells: fixtureIds.map((fixtureId, index) => ({
      fixtureId,
      row: Math.floor(index / safeColumns),
      column: index % safeColumns
    }))
  };
}

export function normalizeSelectionGrid(
  grid: FixtureSelectionGrid | undefined,
  fixtureIds: readonly string[]
): FixtureSelectionGrid {
  const uniqueIds = [...new Set(fixtureIds.filter((id) => typeof id === 'string' && id.length > 0))];
  const fallback = makeSelectionGrid(uniqueIds);
  const requestedColumns = clampWhole(grid?.columns ?? fallback.columns, fallback.columns, 1, 32);
  const requestedRows = clampWhole(grid?.rows ?? fallback.rows, fallback.rows, 1, 32);
  const minimumRows = Math.ceil(Math.max(1, uniqueIds.length) / requestedColumns);
  const rows = Math.max(requestedRows, minimumRows);
  const columns = requestedColumns;
  const traversal: SelectionGridTraversal = ['row', 'column', 'snake-row', 'snake-column'].includes(grid?.traversal ?? '')
    ? grid!.traversal
    : 'row';

  const validIds = new Set(uniqueIds);
  const seenIds = new Set<string>();
  const usedCells = new Set<string>();
  const cells: SelectionGridCell[] = [];

  for (const cell of grid?.cells ?? []) {
    if (!validIds.has(cell.fixtureId) || seenIds.has(cell.fixtureId)) continue;
    const row = clampWhole(cell.row, 0, 0, rows - 1);
    const column = clampWhole(cell.column, 0, 0, columns - 1);
    const key = `${row}:${column}`;
    if (usedCells.has(key)) continue;
    seenIds.add(cell.fixtureId);
    usedCells.add(key);
    cells.push({ fixtureId: cell.fixtureId, row, column });
  }

  for (const fixtureId of uniqueIds) {
    if (seenIds.has(fixtureId)) continue;
    const next = firstFreeCell(usedCells, rows, columns);
    const key = `${next.row}:${next.column}`;
    usedCells.add(key);
    seenIds.add(fixtureId);
    cells.push({ fixtureId, ...next });
  }

  return { rows, columns, traversal, cells };
}

function traversalRank(cell: SelectionGridCell, grid: FixtureSelectionGrid): [number, number] {
  if (grid.traversal === 'column') return [cell.column, cell.row];
  if (grid.traversal === 'snake-row') {
    return [cell.row, cell.row % 2 === 0 ? cell.column : grid.columns - 1 - cell.column];
  }
  if (grid.traversal === 'snake-column') {
    return [cell.column, cell.column % 2 === 0 ? cell.row : grid.rows - 1 - cell.row];
  }
  return [cell.row, cell.column];
}

export function selectionGridOrder(
  grid: FixtureSelectionGrid | undefined,
  fixtureIds: readonly string[]
): string[] {
  const normalized = normalizeSelectionGrid(grid, fixtureIds);
  return [...normalized.cells]
    .sort((left, right) => {
      const [leftMajor, leftMinor] = traversalRank(left, normalized);
      const [rightMajor, rightMinor] = traversalRank(right, normalized);
      return leftMajor - rightMajor || leftMinor - rightMinor || left.fixtureId.localeCompare(right.fixtureId);
    })
    .map((cell) => cell.fixtureId);
}

export function moveFixtureInSelectionGrid(
  grid: FixtureSelectionGrid,
  fixtureIds: readonly string[],
  fixtureId: string,
  row: number,
  column: number
): FixtureSelectionGrid {
  const normalized = normalizeSelectionGrid(grid, fixtureIds);
  const source = normalized.cells.find((cell) => cell.fixtureId === fixtureId);
  if (!source) return normalized;

  const targetRow = clampWhole(row, source.row, 0, normalized.rows - 1);
  const targetColumn = clampWhole(column, source.column, 0, normalized.columns - 1);
  const occupant = normalized.cells.find((cell) => (
    cell.fixtureId !== fixtureId && cell.row === targetRow && cell.column === targetColumn
  ));

  return {
    ...normalized,
    cells: normalized.cells.map((cell) => {
      if (cell.fixtureId === fixtureId) return { ...cell, row: targetRow, column: targetColumn };
      if (occupant && cell.fixtureId === occupant.fixtureId) return { ...cell, row: source.row, column: source.column };
      return cell;
    })
  };
}

export type GridPhaseMode = 'selection' | 'rows' | 'columns' | 'across-rows' | 'across-columns';

/** Spatial phases follow fixture identity, independent of selection array order. */
export function selectionGridPhases(grid: FixtureSelectionGrid | undefined, ids: readonly string[], mode: GridPhaseMode): number[] {
  const normalized = normalizeSelectionGrid(grid, ids);
  const axis = mode === 'rows' || mode === 'across-columns' ? 'row' : 'column';
  if (mode === 'selection') {
    const order = selectionGridOrder(normalized, ids);
    return ids.map(id => order.indexOf(id) / Math.max(1, order.length));
  }
  const coordinates = [...new Set(normalized.cells.map(cell => cell[axis]))].sort((a,b) => a-b);
  return ids.map(id => {
    const cell = normalized.cells.find(cell => cell.fixtureId === id);
    return cell ? coordinates.indexOf(cell[axis]) / Math.max(1, coordinates.length) : 0;
  });
}
