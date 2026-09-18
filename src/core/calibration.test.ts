import { describe, expect, it } from 'vitest';
import { makeUniverse } from '../lib/dmx';
import { migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import type { CalibrationObservation, FixtureCalibration, Vec3 } from './geometry';
import { solveFixtureCalibration } from './calibration';
import { aimFixtureAtTarget } from './fixture-geometry';

function fixture(calibration: FixtureCalibration): PatchedFixture {
  return migratePatchedFixture({
    id: 'calibration-mover',
    name: 'Calibration mover',
    profileId: 'generic-moving-head',
    modeId: '14ch-common',
    universe: 1,
    address: 1,
    group: 'Test',
    selected: true,
    collapsed: false,
    transform: { position: { x: 0, y: 5, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } },
    mounting: 'hanging',
    orientation: 'normal',
    calibration
  }, 0, 1);
}

describe('fixture calibration solver', () => {
  it.each([
    { name: 'normal axes', panInvert: false, tiltInvert: false, panOffsetDegrees: 6.4, tiltOffsetDegrees: -2.8 },
    { name: 'reversed pan', panInvert: true, tiltInvert: false, panOffsetDegrees: 7.2, tiltOffsetDegrees: -3.5 },
    { name: 'reversed tilt', panInvert: false, tiltInvert: true, panOffsetDegrees: -4.1, tiltOffsetDegrees: 5.6 },
    { name: 'both reversed', panInvert: true, tiltInvert: true, panOffsetDegrees: 3.7, tiltOffsetDegrees: -6.2 }
  ])('recovers offsets for $name', ({ panInvert, tiltInvert, panOffsetDegrees, tiltOffsetDegrees }) => {
    const expected: FixtureCalibration = {
      panOffsetDegrees,
      tiltOffsetDegrees,
      panInvert,
      tiltInvert,
      status: 'calibrated'
    };
    const calibratedFixture = fixture(expected);
    const targets: Vec3[] = [
      { x: 0, y: 1, z: -4 },
      { x: -3, y: 1.5, z: 2 },
      { x: 4, y: .8, z: 5 }
    ];
    const observations = targets.map((target, index): CalibrationObservation => {
      const solution = aimFixtureAtTarget(makeUniverse(), calibratedFixture, target, 0, 1);
      expect(solution?.reachable).toBe(true);
      return {
        id: `observation-${index}`,
        targetName: `Target ${index + 1}`,
        target,
        panNormalized: solution!.panNormalized,
        tiltNormalized: solution!.tiltNormalized,
        capturedAt: new Date(0).toISOString()
      };
    });
    const solved = solveFixtureCalibration(fixture({ ...expected, panOffsetDegrees: 0, tiltOffsetDegrees: 0, panInvert: false, tiltInvert: false }), observations, 0, 1);
    expect(solved).not.toBeNull();
    expect(solved?.panInvert).toBe(panInvert);
    expect(solved?.tiltInvert).toBe(tiltInvert);
    expect(solved?.panOffsetDegrees).toBeCloseTo(expected.panOffsetDegrees, 5);
    expect(solved?.tiltOffsetDegrees).toBeCloseTo(expected.tiltOffsetDegrees, 5);
    expect(solved?.status).toBe('calibrated');
    expect(solved?.confidence).toBeGreaterThan(.8);
  });

  it('keeps a single observation partial and persists its evidence', () => {
    const target = { x: 1, y: 1, z: -4 };
    const solution = aimFixtureAtTarget(makeUniverse(), fixture({
      panOffsetDegrees: 2,
      tiltOffsetDegrees: -1,
      panInvert: false,
      tiltInvert: false,
      status: 'calibrated'
    }), target, 0, 1);
    const observation: CalibrationObservation = {
      id: 'single-observation',
      targetName: 'Center',
      target,
      panNormalized: solution!.panNormalized,
      tiltNormalized: solution!.tiltNormalized,
      capturedAt: new Date(0).toISOString()
    };
    const solved = solveFixtureCalibration(fixture({
      panOffsetDegrees: 0,
      tiltOffsetDegrees: 0,
      panInvert: false,
      tiltInvert: false,
      status: 'uncalibrated'
    }), [observation], 0, 1);
    expect(solved?.status).toBe('partial');
    expect(solved?.observations).toEqual([observation]);
  });
});
