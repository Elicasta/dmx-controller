import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGE_DIMENSIONS } from './geometry';
import { projectStagePoint, unprojectStagePoint, type StageView } from './stage-projection';

describe('stage engineering views', () => {
  it('uses the same world coordinates in top, front, and side projections', () => {
    const point = { x: 0, y: DEFAULT_STAGE_DIMENSIONS.height / 2, z: DEFAULT_STAGE_DIMENSIONS.depth / 2 };
    expect(projectStagePoint(point, DEFAULT_STAGE_DIMENSIONS, 'top')).toEqual({ x: 500, y: 280 });
    expect(projectStagePoint(point, DEFAULT_STAGE_DIMENSIONS, 'front')).toEqual({ x: 500, y: 280 });
    expect(projectStagePoint(point, DEFAULT_STAGE_DIMENSIONS, 'side')).toEqual({ x: 500, y: 280 });
  });

  it.each(['top', 'front', 'side', 'perspective'] as StageView[])('round-trips a dragged point in %s view', (view) => {
    const original = { x: 1.8, y: 2.6, z: 3.4 };
    const projected = projectStagePoint(original, DEFAULT_STAGE_DIMENSIONS, view);
    const restored = unprojectStagePoint(projected, DEFAULT_STAGE_DIMENSIONS, view, original);
    expect(restored.x).toBeCloseTo(original.x, 6);
    expect(restored.y).toBeCloseTo(original.y, 6);
    expect(restored.z).toBeCloseTo(original.z, 6);
  });

  it('keeps upstage above downstage in plan view', () => {
    const downstage = projectStagePoint({ x: 0, y: 0, z: 0 }, DEFAULT_STAGE_DIMENSIONS, 'top');
    const upstage = projectStagePoint({ x: 0, y: 0, z: DEFAULT_STAGE_DIMENSIONS.depth }, DEFAULT_STAGE_DIMENSIONS, 'top');
    expect(upstage.y).toBeLessThan(downstage.y);
  });

  it('preserves the hidden axis while editing orthographic views', () => {
    const preserved = { x: 1, y: 3, z: 4 };
    expect(unprojectStagePoint({ x: 500, y: 280 }, DEFAULT_STAGE_DIMENSIONS, 'top', preserved).y).toBeCloseTo(3, 8);
    expect(unprojectStagePoint({ x: 500, y: 280 }, DEFAULT_STAGE_DIMENSIONS, 'front', preserved).z).toBeCloseTo(4, 8);
    expect(unprojectStagePoint({ x: 500, y: 280 }, DEFAULT_STAGE_DIMENSIONS, 'side', preserved).x).toBeCloseTo(1, 8);
  });
});
