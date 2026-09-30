import { describe, expect, it } from 'vitest';
import { normalizePanelOrder, reorderPanelIds } from './DraggablePanelDeck';

describe('draggable programmer panel layout', () => {
  const defaults = ['intensity', 'color', 'position', 'beam', 'gobo', 'fx'];

  it('moves a panel before the drop target without losing panels', () => {
    expect(reorderPanelIds(defaults, 'color', 'gobo')).toEqual([
      'intensity', 'position', 'beam', 'color', 'gobo', 'fx',
    ]);
  });

  it('keeps a stable order when the drag target is invalid or unchanged', () => {
    expect(reorderPanelIds(defaults, 'color', 'color')).toEqual(defaults);
    expect(reorderPanelIds(defaults, 'missing', 'color')).toEqual(defaults);
  });

  it('restores saved order while adding new panels and removing stale ids', () => {
    expect(normalizePanelOrder(
      ['fx', 'color', 'old-panel', 'intensity', 'color'],
      defaults,
    )).toEqual(['fx', 'color', 'intensity', 'position', 'beam', 'gobo']);
  });
});
