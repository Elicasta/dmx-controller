import { describe, expect, it } from 'vitest';
import {
  calculateBeamRay,
  dmx16ToNormalized,
  dmx8ToNormalized,
  normalizedToDmx16,
  normalizedToDmx8,
  normalizedToMovementDegrees,
  splitDmx16,
  type MovementGeometry
} from './geometry';

const movement: MovementGeometry = {
  panRangeDegrees: 540,
  tiltRangeDegrees: 270,
  panHomeDegrees: 0,
  tiltHomeDegrees: 0,
  panInvert: false,
  tiltInvert: false,
  panDMXMin: 0,
  panDMXMax: 255,
  tiltDMXMin: 0,
  tiltDMXMax: 255
};

describe('DMX movement conversion', () => {
  it('converts normalized values to 8-bit endpoints and midpoint', () => {
    expect(normalizedToDmx8(0)).toBe(0);
    expect(normalizedToDmx8(0.5)).toBe(128);
    expect(normalizedToDmx8(1)).toBe(255);
    expect(dmx8ToNormalized(0)).toBe(0);
    expect(dmx8ToNormalized(255)).toBe(1);
  });

  it('converts normalized values to 16-bit coarse and fine channels', () => {
    expect(splitDmx16(normalizedToDmx16(0))).toEqual({ coarse: 0, fine: 0 });
    expect(splitDmx16(normalizedToDmx16(0.5))).toEqual({ coarse: 128, fine: 0 });
    expect(splitDmx16(normalizedToDmx16(1))).toEqual({ coarse: 255, fine: 255 });
    expect(dmx16ToNormalized(255, 255)).toBe(1);
  });

  it('applies range, profile inversion, and fixture calibration deterministically', () => {
    expect(normalizedToMovementDegrees(0.5, 0.5, movement)).toMatchObject({ pan: 0, tilt: 0 });
    expect(normalizedToMovementDegrees(1, 1, movement)).toMatchObject({ pan: 270, tilt: 135 });
    expect(normalizedToMovementDegrees(1, 1, { ...movement, panInvert: true }, {
      panOffsetDegrees: 7,
      tiltOffsetDegrees: -3,
      panInvert: false,
      tiltInvert: true,
      status: 'calibrated'
    })).toMatchObject({ pan: -263, tilt: -138 });
  });
});

describe('forward fixture geometry', () => {
  const transform = {
    position: { x: 2, y: 4, z: 1 },
    rotation: { yaw: 0, pitch: 0, roll: 0 }
  };

  it('uses the fixture lens position as the ray origin', () => {
    const ray = calculateBeamRay({ transform, mounting: 'hanging', orientation: 'normal', panDegrees: 0, tiltDegrees: 0 });
    expect(ray.origin).toEqual(transform.position);
    expect(ray.direction.x).toBeCloseTo(0, 8);
    expect(ray.direction.y).toBeCloseTo(-1, 8);
    expect(ray.direction.z).toBeCloseTo(0, 8);
  });

  it('keeps the beam attached to the transformed lens and preserves beam/field optics', () => {
    const ray = calculateBeamRay({
      transform: { ...transform, rotation: { yaw: 90, pitch: 0, roll: 0 } },
      mounting: 'hanging',
      orientation: 'normal',
      panDegrees: 0,
      tiltDegrees: 0,
      lensOffset: { x: 0, y: -.2, z: .3 },
      angleDegrees: 12,
      fieldAngleDegrees: 18
    });
    expect(ray.origin.x).toBeCloseTo(2.3, 8);
    expect(ray.origin.y).toBeCloseTo(3.8, 8);
    expect(ray.origin.z).toBeCloseTo(1, 8);
    expect(ray.angleDegrees).toBe(12);
    expect(ray.fieldAngleDegrees).toBe(18);
  });

  it('rotates tilt and pan in fixture-local space before world rotation', () => {
    const tilted = calculateBeamRay({ transform, mounting: 'hanging', orientation: 'normal', panDegrees: 0, tiltDegrees: 90 });
    expect(tilted.direction.z).toBeCloseTo(-1, 8);
    const panned = calculateBeamRay({ transform, mounting: 'hanging', orientation: 'normal', panDegrees: 90, tiltDegrees: 90 });
    expect(panned.direction.x).toBeCloseTo(-1, 8);
  });

  it('supports floor and inverted mounting transforms', () => {
    const floor = calculateBeamRay({ transform, mounting: 'floor', orientation: 'normal', panDegrees: 0, tiltDegrees: 0 });
    expect(floor.direction.y).toBeCloseTo(1, 8);
    const inverted = calculateBeamRay({ transform, mounting: 'hanging', orientation: 'inverted', panDegrees: 0, tiltDegrees: 0 });
    expect(inverted.direction.y).toBeCloseTo(1, 8);
  });
});
