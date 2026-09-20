import { describe, expect, it } from 'vitest';
import { clampStageElement, isStageElement, makeStageElement } from './stage';

describe('stage design helpers', () => {
  it('creates supported scenery with useful defaults', () => {
    const screen = makeStageElement('led-screen', 0);
    const drape = makeStageElement('drape', 0);
    const truss = makeStageElement('truss', 0);
    expect(screen.label).toContain('LED screen');
    expect(drape.label).toContain('Drape');
    expect(truss.label).toContain('Truss');
    expect(isStageElement(screen)).toBe(true);
    expect(isStageElement(drape)).toBe(true);
    expect(isStageElement(truss)).toBe(true);
  });

  it('places new walls upstage instead of near the audience edge', () => {
    const wall = makeStageElement('back-wall', 0);
    expect(wall.transform?.position.z).toBeGreaterThan(0);
  });

  it('keeps fake-3D coordinates inside the stage', () => {
    const element = clampStageElement({ ...makeStageElement('person', 0), x: 500, y: -4, depth: 220, size: 2 });
    expect(element).toMatchObject({ x: 98, y: 5, depth: 100, size: 10 });
  });
});
