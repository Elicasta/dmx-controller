import { describe, expect, it } from 'vitest';
import { groupColorPalettes } from './ColorPaletteLibrary';

describe('color palette folders', () => {
  it('sorts named folders and leaves unfiled colors last', () => {
    const grouped = groupColorPalettes([
      { id: '1', name: 'White', color: '#ffffff', folder: '' },
      { id: '2', name: 'Blue', color: '#0000ff', folder: 'Songs' },
      { id: '3', name: 'Amber', color: '#ffaa00', folder: 'Washes' }
    ]);
    expect(grouped.map(([folder]) => folder)).toEqual(['Songs', 'Washes', 'Unfiled']);
  });
});
