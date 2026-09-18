import {
  angularDistanceDegrees,
  calculateBeamRay,
  dmx16ToNormalized,
  dmx8ToNormalized,
  EMPTY_CALIBRATION,
  movementDegreesToNormalized,
  normalize,
  normalizedToDmx16,
  normalizedToDmx8,
  normalizedToMovementDegrees,
  splitDmx16,
  subtract,
  worldDirectionToFixtureLocal,
  type BeamRay,
  type MovementDegrees,
  type StageDimensions,
  type Vec3
} from './geometry';
import {
  findProfile,
  fixtureParameterUpdate,
  fixtureTransform,
  parameterChannel,
  readFixtureParameter,
  type PatchedFixture
} from '../lib/fixtures';
import type { DmxUpdate } from '../lib/dmx';

export type FixtureGeometryState = {
  movement: MovementDegrees;
  beam: BeamRay;
  movementCapable: boolean;
};

export type FixtureAimSolution = {
  fixtureId: string;
  target: Vec3;
  panDegrees: number;
  tiltDegrees: number;
  panNormalized: number;
  tiltNormalized: number;
  reachable: boolean;
  angularErrorDegrees: number;
  updates: DmxUpdate[];
};

function movementNormalized(
  universe: readonly number[],
  fixture: PatchedFixture,
  coarse: 'pan' | 'tilt',
  fine: 'panFine' | 'tiltFine',
  minimum: number,
  maximum: number
): number {
  const coarseValue = readFixtureParameter(universe, fixture, coarse);
  return parameterChannel(fixture, fine)
    ? dmx16ToNormalized(coarseValue, readFixtureParameter(universe, fixture, fine), minimum, maximum)
    : dmx8ToNormalized(coarseValue, minimum, maximum);
}

export function fixtureGeometryState(
  universe: readonly number[],
  fixture: PatchedFixture,
  index: number,
  total: number,
  dimensions?: StageDimensions
): FixtureGeometryState {
  const profile = findProfile(fixture.profileId);
  const geometry = profile?.movement;
  const movementCapable = Boolean(geometry && parameterChannel(fixture, 'pan') && parameterChannel(fixture, 'tilt'));
  const panNormalized = geometry
    ? movementNormalized(universe, fixture, 'pan', 'panFine', geometry.panDMXMin, geometry.panDMXMax)
    : 0.5;
  const tiltNormalized = geometry
    ? movementNormalized(universe, fixture, 'tilt', 'tiltFine', geometry.tiltDMXMin, geometry.tiltDMXMax)
    : 0.5;
  const movement = geometry
    ? normalizedToMovementDegrees(panNormalized, tiltNormalized, geometry, fixture.calibration ?? EMPTY_CALIBRATION)
    : { pan: 0, tilt: 0, panNormalized, tiltNormalized };
  const zoom = parameterChannel(fixture, 'zoom') ? readFixtureParameter(universe, fixture, 'zoom') / 255 : 0;
  const beamAngle = profile?.optics
    ? profile.optics.beamAngleMinDegrees + zoom * (profile.optics.beamAngleMaxDegrees - profile.optics.beamAngleMinDegrees)
    : profile?.category === 'Bar' ? 45 : profile?.category === 'Par' ? 24 : 12;
  const beam = calculateBeamRay({
    transform: fixtureTransform(fixture, index, total, dimensions),
    mounting: fixture.mounting ?? 'hanging',
    orientation: fixture.orientation ?? 'normal',
    panDegrees: movement.pan,
    tiltDegrees: movement.tilt,
    angleDegrees: beamAngle,
    lensOffset: profile?.optics?.lensOffsetMeters
  });
  return { movement, beam, movementCapable };
}

function movementCandidates(localDirection: Vec3, current: MovementDegrees): Array<{ pan: number; tilt: number }> {
  const direction = normalize(localDirection);
  const tiltMagnitude = Math.acos(Math.max(-1, Math.min(1, -direction.y))) * 180 / Math.PI;
  const tiltBases = tiltMagnitude < 1e-7 ? [0] : [tiltMagnitude, -tiltMagnitude];
  const candidates: Array<{ pan: number; tilt: number }> = [];

  tiltBases.forEach((tiltBase) => {
    const tiltRadians = tiltBase * Math.PI / 180;
    const sine = Math.sin(tiltRadians);
    const panBase = Math.abs(sine) < 1e-7
      ? current.pan
      : Math.atan2(-direction.x / sine, -direction.z / sine) * 180 / Math.PI;
    for (let tiltTurn = -1; tiltTurn <= 1; tiltTurn += 1) {
      for (let panTurn = -2; panTurn <= 2; panTurn += 1) {
        candidates.push({ pan: panBase + panTurn * 360, tilt: tiltBase + tiltTurn * 360 });
      }
    }
  });
  return candidates;
}

export function fixtureTargetMovementCandidates(
  universe: readonly number[],
  fixture: PatchedFixture,
  target: Vec3,
  index: number,
  total: number,
  dimensions?: StageDimensions
): Array<{ pan: number; tilt: number }> | null {
  const profile = findProfile(fixture.profileId);
  if (!profile?.movement || !parameterChannel(fixture, 'pan') || !parameterChannel(fixture, 'tilt')) return null;
  const current = fixtureGeometryState(universe, fixture, index, total, dimensions);
  const transform = fixtureTransform(fixture, index, total, dimensions);
  const origin = current.beam.origin;
  if (Math.hypot(target.x - origin.x, target.y - origin.y, target.z - origin.z) < 1e-6) return null;
  const targetDirection = normalize(subtract(target, origin));
  const localDirection = worldDirectionToFixtureLocal({
    direction: targetDirection,
    transform,
    mounting: fixture.mounting ?? 'hanging',
    orientation: fixture.orientation ?? 'normal'
  });
  return movementCandidates(localDirection, current.movement);
}

export function fixtureMovementUpdates(
  fixture: PatchedFixture,
  panNormalized: number,
  tiltNormalized: number
): DmxUpdate[] {
  const geometry = findProfile(fixture.profileId)?.movement;
  if (!geometry) return [];
  const updates: DmxUpdate[] = [];
  const panFine = parameterChannel(fixture, 'panFine');
  const tiltFine = parameterChannel(fixture, 'tiltFine');

  if (panFine) {
    const split = splitDmx16(normalizedToDmx16(panNormalized, geometry.panDMXMin, geometry.panDMXMax));
    const coarse = fixtureParameterUpdate(fixture, 'pan', split.coarse);
    const fine = fixtureParameterUpdate(fixture, 'panFine', split.fine);
    if (coarse) updates.push(coarse);
    if (fine) updates.push(fine);
  } else {
    const update = fixtureParameterUpdate(fixture, 'pan', normalizedToDmx8(panNormalized, geometry.panDMXMin, geometry.panDMXMax));
    if (update) updates.push(update);
  }

  if (tiltFine) {
    const split = splitDmx16(normalizedToDmx16(tiltNormalized, geometry.tiltDMXMin, geometry.tiltDMXMax));
    const coarse = fixtureParameterUpdate(fixture, 'tilt', split.coarse);
    const fine = fixtureParameterUpdate(fixture, 'tiltFine', split.fine);
    if (coarse) updates.push(coarse);
    if (fine) updates.push(fine);
  } else {
    const update = fixtureParameterUpdate(fixture, 'tilt', normalizedToDmx8(tiltNormalized, geometry.tiltDMXMin, geometry.tiltDMXMax));
    if (update) updates.push(update);
  }
  return updates;
}

export function aimFixtureAtTarget(
  universe: readonly number[],
  fixture: PatchedFixture,
  target: Vec3,
  index: number,
  total: number,
  dimensions?: StageDimensions
): FixtureAimSolution | null {
  const profile = findProfile(fixture.profileId);
  const geometry = profile?.movement;
  if (!geometry || !parameterChannel(fixture, 'pan') || !parameterChannel(fixture, 'tilt')) return null;
  const current = fixtureGeometryState(universe, fixture, index, total, dimensions);
  const transform = fixtureTransform(fixture, index, total, dimensions);
  const origin = current.beam.origin;
  if (Math.hypot(target.x - origin.x, target.y - origin.y, target.z - origin.z) < 1e-6) return null;
  const targetDirection = normalize(subtract(target, origin));
  const calibration = fixture.calibration ?? EMPTY_CALIBRATION;
  const targetCandidates = fixtureTargetMovementCandidates(universe, fixture, target, index, total, dimensions);
  if (!targetCandidates) return null;

  const candidates = targetCandidates.map((candidate) => {
    const normalized = movementDegreesToNormalized(candidate.pan, candidate.tilt, geometry, calibration);
    const resolved = normalizedToMovementDegrees(normalized.panNormalized, normalized.tiltNormalized, geometry, calibration);
    const beam = calculateBeamRay({
      transform,
      mounting: fixture.mounting ?? 'hanging',
      orientation: fixture.orientation ?? 'normal',
      panDegrees: resolved.pan,
      tiltDegrees: resolved.tilt,
      angleDegrees: current.beam.angleDegrees,
      lensOffset: profile?.optics?.lensOffsetMeters
    });
    const angularErrorDegrees = angularDistanceDegrees(beam.direction, targetDirection);
    const travel = Math.abs(normalized.panNormalized - current.movement.panNormalized)
      + Math.abs(normalized.tiltNormalized - current.movement.tiltNormalized);
    return { candidate, normalized, angularErrorDegrees, travel };
  }).sort((left, right) => {
    if (left.normalized.reachable !== right.normalized.reachable) return left.normalized.reachable ? -1 : 1;
    return (left.angularErrorDegrees * 1000 + left.travel) - (right.angularErrorDegrees * 1000 + right.travel);
  });

  const best = candidates[0];
  if (!best) return null;
  const resolved = normalizedToMovementDegrees(best.normalized.panNormalized, best.normalized.tiltNormalized, geometry, calibration);
  return {
    fixtureId: fixture.id,
    target,
    panDegrees: resolved.pan,
    tiltDegrees: resolved.tilt,
    panNormalized: best.normalized.panNormalized,
    tiltNormalized: best.normalized.tiltNormalized,
    reachable: best.normalized.reachable && best.angularErrorDegrees < 0.1,
    angularErrorDegrees: best.angularErrorDegrees,
    updates: fixtureMovementUpdates(fixture, best.normalized.panNormalized, best.normalized.tiltNormalized)
  };
}
