import { describe, expect, it } from 'vitest';
import { STAGE_WAREHOUSE, clampStageElement, isStageElement, makeStageElement, makeStageWarehouseElement } from './stage';

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

  it('creates every warehouse object with physical dimensions', () => {
    for (const item of STAGE_WAREHOUSE) {
      const element = makeStageWarehouseElement(item.id, 0);
      expect(isStageElement(element)).toBe(true);
      expect(element.dimensions?.x).toBeGreaterThan(0);
      expect(element.dimensions?.y).toBeGreaterThan(0);
      expect(element.dimensions?.z).toBeGreaterThan(0);
    }
  });

  it('validates persistent screen framing without accepting unsafe transforms', () => {
    const screen = makeStageElement('led-screen', 0);
    const framed = {
      ...screen,
      mediaSource: {
        kind: 'timeline' as const,
        sourceName: 'Timeline video',
        fit: 'cover' as const,
        scale: 1.5,
        offsetX: .2,
        offsetY: -.25
      }
    };
    expect(isStageElement(framed)).toBe(true);
    expect(isStageElement({ ...framed, mediaSource: { ...framed.mediaSource, scale: 4.1 } })).toBe(false);
    expect(isStageElement({ ...framed, mediaSource: { ...framed.mediaSource, offsetY: -1.1 } })).toBe(false);
  });

  it('creates independent warehouse instances', () => {
    const first = makeStageWarehouseElement('screen-16x9', 0);
    const second = makeStageWarehouseElement('screen-16x9', 1);
    expect(first.id).not.toBe(second.id);
    expect(first.dimensions).not.toBe(second.dimensions);
  });
});
