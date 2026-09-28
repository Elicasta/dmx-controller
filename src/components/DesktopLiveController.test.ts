import { describe, expect, it } from 'vitest';
import { emptyLiveAssignment, liveSlotKey, sanitizeLiveAssignments } from './DesktopLiveController';

describe('desktop live controller assignments', () => {
  it('keeps pages and surface modes in separate slots', () => {
    expect(liveSlotKey('faders', 2, 3)).toBe('faders:2:3');
    expect(liveSlotKey('busk', 2, 3)).toBe('busk:2:3');
  });

  it('rejects unsafe assignments and preserves valid controls', () => {
    const result = sanitizeLiveAssignments({
      'faders:1:0': { id: 'front', kind: 'group', targetId: 'front', label: 'Front', color: '#55e98d' },
      'faders:1:1': { id: 'bad', kind: 'unknown', label: 'Bad' },
      'faders:1:2': { id: 'bad-color', kind: 'look', label: 'Bad color', color: 'red' }
    });
    expect(result['faders:1:0']).toMatchObject({ kind: 'group', label: 'Front' });
    expect(result['faders:1:1']).toBeUndefined();
    expect(result['faders:1:2']).toBeUndefined();
  });

  it('makes a predictable empty assignment', () => {
    expect(emptyLiveAssignment('busk:4:31')).toEqual({ id: 'busk:4:31', kind: 'empty', label: 'EMPTY' });
  });
});
