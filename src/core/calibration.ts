import { applyUniverseUpdates, makeUniverse } from '../lib/dmx';
import { findProfile, type PatchedFixture } from '../lib/fixtures';
import {
  angularDistanceDegrees,
  EMPTY_CALIBRATION,
  normalize,
  normalizedToMovementDegrees,
  subtract,
  type CalibrationObservation,
  type FixtureCalibration,
  type StageDimensions
} from './geometry';
import { fixtureGeometryState, fixtureMovementUpdates, fixtureTargetMovementCandidates } from './fixture-geometry';

function circularDifference(target: number, actual: number): number {
  let difference = target - actual;
  while (difference > 180) difference -= 360;
  while (difference < -180) difference += 360;
  return difference;
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function solveFixtureCalibration(
  fixture: PatchedFixture,
  observations: readonly CalibrationObservation[],
  index: number,
  total: number,
  dimensions?: StageDimensions
): FixtureCalibration | null {
  const geometry = findProfile(fixture.profileId)?.movement;
  if (!geometry || observations.length === 0) return null;
  const uncalibratedFixture: PatchedFixture = { ...fixture, calibration: { ...EMPTY_CALIBRATION } };
  const evidence = observations.map((observation) => {
    const frame = applyUniverseUpdates(makeUniverse(), fixtureMovementUpdates(
      uncalibratedFixture,
      observation.panNormalized,
      observation.tiltNormalized
    ));
    const candidates = fixtureTargetMovementCandidates(frame, uncalibratedFixture, observation.target, index, total, dimensions);
    return candidates?.length ? { observation, frame, candidates } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!evidence.length) return null;

  const candidates: Array<{ calibration: FixtureCalibration; error: number }> = [];
  for (const panInvert of [false, true]) {
    for (const tiltInvert of [false, true]) {
      const baseCalibration: FixtureCalibration = {
        ...EMPTY_CALIBRATION,
        panInvert,
        tiltInvert
      };
      const offsets = evidence.map(({ observation, candidates: targetCandidates }) => {
        const base = normalizedToMovementDegrees(
          observation.panNormalized,
          observation.tiltNormalized,
          geometry,
          baseCalibration
        );
        return targetCandidates.map((target) => ({
          pan: circularDifference(target.pan, base.pan),
          tilt: circularDifference(target.tilt, base.tilt)
        })).sort((left, right) => (Math.abs(left.pan) + Math.abs(left.tilt)) - (Math.abs(right.pan) + Math.abs(right.tilt)))[0];
      });
      const panOffsetDegrees = average(offsets.map((offset) => offset.pan));
      const tiltOffsetDegrees = average(offsets.map((offset) => offset.tilt));
      const residuals = offsets.flatMap((offset) => [
        circularDifference(offset.pan, panOffsetDegrees),
        circularDifference(offset.tilt, tiltOffsetDegrees)
      ]);
      const rms = Math.sqrt(average(residuals.map((residual) => residual * residual)));
      const candidateCalibration: FixtureCalibration = {
        panOffsetDegrees,
        tiltOffsetDegrees,
        panInvert,
        tiltInvert,
        status: evidence.length >= 2 ? 'calibrated' : 'partial',
        confidence: 0,
        lastCalibratedAt: new Date().toISOString(),
        observations: [...observations]
      };
      const calibratedFixture: PatchedFixture = { ...fixture, calibration: candidateCalibration };
      const beamErrors = evidence.map(({ observation, frame }) => {
        const state = fixtureGeometryState(frame, calibratedFixture, index, total, dimensions);
        const targetDirection = normalize(subtract(observation.target, state.beam.origin));
        return angularDistanceDegrees(state.beam.direction, targetDirection);
      });
      const beamRms = Math.sqrt(average(beamErrors.map((error) => error * error)));
      const confidence = Math.max(0, Math.min(1, (evidence.length / 3) * Math.exp(-(beamRms + rms * .1) / 8)));
      candidateCalibration.confidence = confidence;
      candidates.push({
        error: beamRms * 100 + rms,
        calibration: candidateCalibration
      });
    }
  }

  return candidates.sort((left, right) => left.error - right.error)[0]?.calibration ?? null;
}
