import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PATCH,
  fixtureEndAddress,
  fixtureStagePosition,
  fixtureParameterUpdate,
  isPatchedFixture,
  patchCollision,
  validatePatch,
  type PatchedFixture
} from './fixtures';

describe('fixture patch helpers', () => {
  it('maps the verified Mega Par mode onto DMX channels', () => {
    const fixture = DEFAULT_PATCH[0];
    expect(fixtureEndAddress(fixture)).toBe(5);
    expect(fixtureParameterUpdate(fixture, 'red', 260)).toEqual([1, 255]);
    expect(fixtureParameterUpdate(fixture, 'dimmer', 128)).toEqual([5, 128]);
  });

  it('detects address collisions', () => {
    const candidate: PatchedFixture = { ...DEFAULT_PATCH[0], id: 'two', address: 5 };
    expect(patchCollision(candidate, DEFAULT_PATCH)?.id).toBe(DEFAULT_PATCH[0].id);
    expect(validatePatch(candidate, DEFAULT_PATCH)).toContain('overlap');
  });

  it('allows adjacent fixtures and blocks universe overflow', () => {
    const adjacent: PatchedFixture = { ...DEFAULT_PATCH[0], id: 'two', address: 6 };
    expect(validatePatch(adjacent, DEFAULT_PATCH)).toBeNull();
    expect(validatePatch({ ...adjacent, address: 510 }, DEFAULT_PATCH)).toContain('channel 512');
  });

  it('keeps stage positions inside the visible design area', () => {
    expect(fixtureStagePosition({ ...DEFAULT_PATCH[0], stageX: 200, stageY: -4, stageDepth: 500, stageDirection: -200 }, 0, 1)).toEqual({ x: 95, y: 5, depth: 100, direction: -90 });
  });

  it('validates persisted fixture calibration observations', () => {
    const calibration = {
      panOffsetDegrees: 2.5,
      tiltOffsetDegrees: -1.25,
      panInvert: false,
      tiltInvert: true,
      status: 'calibrated' as const,
      confidence: .92,
      lastCalibratedAt: new Date(0).toISOString(),
      observations: [{
        id: 'observation-1',
        targetId: 'target-center-stage',
        targetName: 'Center Stage',
        target: { x: 0, y: 1.2, z: 3 },
        panNormalized: .4,
        tiltNormalized: .6,
        capturedAt: new Date(0).toISOString()
      }]
    };
    expect(isPatchedFixture({ ...DEFAULT_PATCH[0], calibration })).toBe(true);
    expect(isPatchedFixture({
      ...DEFAULT_PATCH[0],
      calibration: { ...calibration, observations: [{ ...calibration.observations[0], target: { x: Number.NaN, y: 1, z: 2 } }] }
    })).toBe(false);
  });
});
