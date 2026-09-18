import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGE_DIMENSIONS, type BeamRay } from './geometry';
import { intersectBeamWithStage } from './beam-intersection';

function ray(direction: BeamRay['direction']): BeamRay {
  return { origin: { x: 0, y: 5, z: 0 }, direction, angleDegrees: 12 };
}

describe('beam intersection', () => {
  it('terminates a downward beam on the floor', () => {
    const hit = intersectBeamWithStage(ray({ x: 0, y: -1, z: 0 }), DEFAULT_STAGE_DIMENSIONS);
    expect(hit?.surface).toBe('floor');
    expect(hit?.point).toEqual({ x: 0, y: 0, z: 0 });
    expect(hit?.distance).toBeCloseTo(5, 8);
  });

  it('terminates an upstage beam on the back wall', () => {
    const hit = intersectBeamWithStage(ray({ x: 0, y: 0, z: 1 }), DEFAULT_STAGE_DIMENSIONS);
    expect(hit?.surface).toBe('back-wall');
    expect(hit?.point.z).toBeCloseTo(DEFAULT_STAGE_DIMENSIONS.depth, 8);
  });

  it('chooses the nearest bounded surface for a diagonal ray', () => {
    const hit = intersectBeamWithStage(ray({ x: 1, y: -.2, z: 0 }), DEFAULT_STAGE_DIMENSIONS);
    expect(hit?.surface).toBe('right-wall');
    expect(hit?.point.x).toBeCloseTo(DEFAULT_STAGE_DIMENSIONS.roomWidth / 2, 8);
    expect(hit?.point.y).toBeGreaterThan(0);
  });

  it('uses the audience-side room boundary for a downstage beam', () => {
    const hit = intersectBeamWithStage(ray({ x: 0, y: 0, z: -1 }), DEFAULT_STAGE_DIMENSIONS);
    expect(hit?.surface).toBe('front-wall');
    expect(hit?.point.z).toBeCloseTo(-DEFAULT_STAGE_DIMENSIONS.roomDepth, 8);
  });
});
