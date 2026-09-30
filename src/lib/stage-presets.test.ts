import { describe, expect, it } from 'vitest';
import { isStageElement } from './stage';
import { STAGE_PRESETS, getStagePreset, instantiateStagePreset } from './stage-presets';

describe('stage presets', () => {
  it('keeps church and Apostolic Day as separate scenes', () => {
    const church = getStagePreset('cornerstone-main-sanctuary');
    const apostolic = getStagePreset('apostolic-day-2026');

    const churchIds = new Set(church.elements.map((element) => element.id));
    const apostolicIds = new Set(apostolic.elements.map((element) => element.id));

    expect([...churchIds].every((id) => id.startsWith('cornerstone-main-sanctuary:'))).toBe(true);
    expect([...apostolicIds].every((id) => id.startsWith('apostolic-day-2026:'))).toBe(true);
    expect([...churchIds].some((id) => apostolicIds.has(id))).toBe(false);
    expect(church.elements).not.toBe(apostolic.elements);
  });

  it('ships only valid stage elements', () => {
    for (const preset of STAGE_PRESETS) {
      expect(preset.elements.length).toBeGreaterThan(0);
      expect(preset.elements.every(isStageElement)).toBe(true);
      expect(new Set(preset.elements.map((element) => element.id)).size).toBe(preset.elements.length);
    }
  });

  it('prewires the main screens for ProPresenter input', () => {
    const churchScreens = getStagePreset('cornerstone-main-sanctuary').elements.filter((element) => element.type === 'led-screen');
    const apostolicScreens = getStagePreset('apostolic-day-2026').elements.filter((element) => element.type === 'led-screen');

    expect(churchScreens).toHaveLength(3);
    expect(churchScreens.every((screen) => screen.mediaSource?.kind === 'ndi')).toBe(true);
    expect(apostolicScreens).toHaveLength(1);
    expect(apostolicScreens[0].mediaSource).toMatchObject({ kind: 'ndi', sourceName: 'ProPresenter' });
  });

  it('returns cloned preset state so edits do not leak across reloads', () => {
    const first = instantiateStagePreset('apostolic-day-2026');
    first.elements[0].label = 'Edited locally';

    const second = instantiateStagePreset('apostolic-day-2026');
    expect(second.elements[0].label).not.toBe('Edited locally');
  });
});
