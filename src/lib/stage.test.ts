import { describe, expect, it } from 'vitest';
import { clampStageElement, isStageElement, makeStageElement } from './stage';

describe('stage design helpers', () => {
  it('creates supported scenery with useful defaults', () => {
    const screen = makeStageElement('led-screen', 0);
    expect(screen.label).toContain('LED screen');
    expect(isStageElement(screen)).toBe(true);
  });

  it('keeps fake-3D coordinates inside the stage', () => {
    const element = clampStageElement({ ...makeStageElement('person', 0), x: 500, y: -4, depth: 220, size: 2 });
    expect(element).toMatchObject({ x: 98, y: 5, depth: 100, size: 10 });
  });
});
