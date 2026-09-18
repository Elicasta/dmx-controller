import { describe, expect, it } from 'vitest';
import { applyUniverseUpdates, makeUniverse } from '../lib/dmx';
import { migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import { angularDistanceDegrees, normalize, subtract, type Vec3 } from './geometry';
import { aimFixtureAtTarget, fixtureGeometryState } from './fixture-geometry';

function mover(overrides: Partial<PatchedFixture> = {}): PatchedFixture {
  return migratePatchedFixture({
    id: 'mover-roundtrip',
    name: 'Round-trip mover',
    profileId: 'generic-moving-head',
    modeId: '14ch-common',
    universe: 1,
    address: 1,
    group: 'Test',
    selected: true,
    collapsed: false,
    transform: {
      position: { x: 0, y: 5, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 }
    },
    mounting: 'hanging',
    orientation: 'normal',
    ...overrides
  }, 0, 1);
}

function verifyRoundTrip(fixture: PatchedFixture, target: Vec3) {
  const initial = makeUniverse();
  const solution = aimFixtureAtTarget(initial, fixture, target, 0, 1);
  expect(solution).not.toBeNull();
  expect(solution?.reachable).toBe(true);
  const frame = applyUniverseUpdates(initial, solution?.updates ?? []);
  const resolved = fixtureGeometryState(frame, fixture, 0, 1);
  const targetDirection = normalize(subtract(target, resolved.beam.origin));
  expect(angularDistanceDegrees(resolved.beam.direction, targetDirection)).toBeLessThan(0.02);
}

describe('inverse fixture aiming', () => {
  it('round-trips a target through 16-bit Pan/Tilt and forward geometry', () => {
    verifyRoundTrip(mover(), { x: 2.5, y: 0, z: -3 });
  });

  it('round-trips floor, inverted, and rotated fixture installations', () => {
    verifyRoundTrip(mover({ mounting: 'floor' }), { x: 2, y: 8, z: 3 });
    verifyRoundTrip(mover({ orientation: 'inverted' }), { x: -2, y: 8, z: -2 });
    verifyRoundTrip(mover({ transform: {
      position: { x: 1, y: 5, z: 2 },
      rotation: { yaw: 32, pitch: -11, roll: 18 }
    } }), { x: -2, y: 0.5, z: -4 });
  });

  it('includes calibration offsets and axis inversion in the round trip', () => {
    verifyRoundTrip(mover({ calibration: {
      panOffsetDegrees: 7.2,
      tiltOffsetDegrees: -3.5,
      panInvert: true,
      tiltInvert: false,
      status: 'calibrated'
    } }), { x: 3, y: 1, z: 4 });
  });

  it('reports a target outside the physical tilt range without pretending it is exact', () => {
    const fixture = mover();
    const solution = aimFixtureAtTarget(makeUniverse(), fixture, { x: 0, y: 10, z: 0 }, 0, 1);
    expect(solution).not.toBeNull();
    expect(solution?.reachable).toBe(false);
    expect(solution?.angularErrorDegrees).toBeGreaterThan(1);
  });
});
