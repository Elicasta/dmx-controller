export type Vec3 = { x: number; y: number; z: number };

export type EulerDegrees = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type FixtureMounting = 'hanging' | 'floor' | 'wall' | 'custom';
export type FixtureOrientation = 'normal' | 'inverted' | 'rotated90' | 'rotated180' | 'custom';

export type FixtureTransform = {
  position: Vec3;
  rotation: EulerDegrees;
};

export type FixtureCalibration = {
  panOffsetDegrees: number;
  tiltOffsetDegrees: number;
  panInvert: boolean;
  tiltInvert: boolean;
  status: 'uncalibrated' | 'partial' | 'calibrated';
  confidence?: number;
  lastCalibratedAt?: string;
  observations?: CalibrationObservation[];
};

export type CalibrationObservation = {
  id: string;
  targetId?: string;
  targetName: string;
  target: Vec3;
  panNormalized: number;
  tiltNormalized: number;
  capturedAt: string;
};

export type StageDimensions = {
  width: number;
  depth: number;
  height: number;
  trimHeight: number;
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
};

export type StageUnit = 'feet' | 'meters';

export type MovementGeometry = {
  panRangeDegrees: number;
  tiltRangeDegrees: number;
  panHomeDegrees: number;
  tiltHomeDegrees: number;
  panInvert: boolean;
  tiltInvert: boolean;
  panDMXMin: number;
  panDMXMax: number;
  tiltDMXMin: number;
  tiltDMXMax: number;
};

export type BeamRay = {
  origin: Vec3;
  direction: Vec3;
  angleDegrees: number;
};

export type MovementDegrees = {
  pan: number;
  tilt: number;
  panNormalized: number;
  tiltNormalized: number;
};

export type MovementNormalized = {
  panNormalized: number;
  tiltNormalized: number;
  reachable: boolean;
};

export const METERS_PER_FOOT = 0.3048;

export const DEFAULT_STAGE_DIMENSIONS: StageDimensions = {
  width: 40 * METERS_PER_FOOT,
  depth: 24 * METERS_PER_FOOT,
  height: 20 * METERS_PER_FOOT,
  trimHeight: 12 * METERS_PER_FOOT,
  roomWidth: 60 * METERS_PER_FOOT,
  roomDepth: 60 * METERS_PER_FOOT,
  roomHeight: 24 * METERS_PER_FOOT
};

export const EMPTY_CALIBRATION: FixtureCalibration = {
  panOffsetDegrees: 0,
  tiltOffsetDegrees: 0,
  panInvert: false,
  tiltInvert: false,
  status: 'uncalibrated'
};

const EPSILON = 1e-9;

function radians(degrees: number) {
  return degrees * Math.PI / 180;
}

export function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function dmx8ToNormalized(value: number, minimum = 0, maximum = 255): number {
  const low = Math.max(0, Math.min(255, minimum));
  const high = Math.max(low + EPSILON, Math.min(255, maximum));
  return clampNormalized((Math.max(low, Math.min(high, value)) - low) / (high - low));
}

export function dmx16ToNormalized(coarse: number, fine: number, minimum = 0, maximum = 255): number {
  const raw = Math.max(0, Math.min(65535, Math.round(coarse) * 256 + Math.round(fine)));
  const low = Math.max(0, Math.min(255, minimum)) * 257;
  const high = Math.max(low + EPSILON, Math.min(255, maximum) * 257);
  return clampNormalized((raw - low) / (high - low));
}

export function normalizedToDmx8(value: number, minimum = 0, maximum = 255): number {
  const low = Math.max(0, Math.min(255, minimum));
  const high = Math.max(low, Math.min(255, maximum));
  return Math.round(low + clampNormalized(value) * (high - low));
}

export function normalizedToDmx16(value: number, minimum = 0, maximum = 255): number {
  const low = Math.max(0, Math.min(255, minimum)) * 257;
  const high = Math.max(low, Math.min(255, maximum) * 257);
  return Math.round(low + clampNormalized(value) * (high - low));
}

export function splitDmx16(value: number): { coarse: number; fine: number } {
  const safe = Math.max(0, Math.min(65535, Math.round(value)));
  return { coarse: safe >> 8, fine: safe & 255 };
}

export function normalizedToMovementDegrees(
  panNormalized: number,
  tiltNormalized: number,
  geometry: MovementGeometry,
  calibration: FixtureCalibration = EMPTY_CALIBRATION
): MovementDegrees {
  const effectivePan = geometry.panInvert !== calibration.panInvert
    ? 1 - clampNormalized(panNormalized)
    : clampNormalized(panNormalized);
  const effectiveTilt = geometry.tiltInvert !== calibration.tiltInvert
    ? 1 - clampNormalized(tiltNormalized)
    : clampNormalized(tiltNormalized);
  return {
    panNormalized: clampNormalized(panNormalized),
    tiltNormalized: clampNormalized(tiltNormalized),
    pan: geometry.panHomeDegrees + (effectivePan - 0.5) * geometry.panRangeDegrees + calibration.panOffsetDegrees,
    tilt: geometry.tiltHomeDegrees + (effectiveTilt - 0.5) * geometry.tiltRangeDegrees + calibration.tiltOffsetDegrees
  };
}

export function movementDegreesToNormalized(
  panDegrees: number,
  tiltDegrees: number,
  geometry: MovementGeometry,
  calibration: FixtureCalibration = EMPTY_CALIBRATION
): MovementNormalized {
  const panEffective = (panDegrees - geometry.panHomeDegrees - calibration.panOffsetDegrees) / geometry.panRangeDegrees + 0.5;
  const tiltEffective = (tiltDegrees - geometry.tiltHomeDegrees - calibration.tiltOffsetDegrees) / geometry.tiltRangeDegrees + 0.5;
  const panNormalized = geometry.panInvert !== calibration.panInvert ? 1 - panEffective : panEffective;
  const tiltNormalized = geometry.tiltInvert !== calibration.tiltInvert ? 1 - tiltEffective : tiltEffective;
  const reachable = panNormalized >= -EPSILON && panNormalized <= 1 + EPSILON
    && tiltNormalized >= -EPSILON && tiltNormalized <= 1 + EPSILON;
  return {
    panNormalized: clampNormalized(panNormalized),
    tiltNormalized: clampNormalized(tiltNormalized),
    reachable
  };
}

export function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  if (length < EPSILON) return { x: 0, y: -1, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

export function add(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

export function subtract(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

export function dot(left: Vec3, right: Vec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function angularDistanceDegrees(left: Vec3, right: Vec3): number {
  const cosine = Math.max(-1, Math.min(1, dot(normalize(left), normalize(right))));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function scale(vector: Vec3, amount: number): Vec3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

export function distance(left: Vec3, right: Vec3): number {
  return magnitude({ x: left.x - right.x, y: left.y - right.y, z: left.z - right.z });
}

export function rotateX(vector: Vec3, degrees: number): Vec3 {
  const angle = radians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x,
    y: vector.y * cosine - vector.z * sine,
    z: vector.y * sine + vector.z * cosine
  };
}

export function rotateY(vector: Vec3, degrees: number): Vec3 {
  const angle = radians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x * cosine + vector.z * sine,
    y: vector.y,
    z: -vector.x * sine + vector.z * cosine
  };
}

export function rotateZ(vector: Vec3, degrees: number): Vec3 {
  const angle = radians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
    z: vector.z
  };
}

export function rotateEuler(vector: Vec3, rotation: EulerDegrees): Vec3 {
  return rotateZ(rotateX(rotateY(vector, rotation.yaw), rotation.pitch), rotation.roll);
}

export function inverseRotateEuler(vector: Vec3, rotation: EulerDegrees): Vec3 {
  return rotateY(rotateX(rotateZ(vector, -rotation.roll), -rotation.pitch), -rotation.yaw);
}

function mountingRotation(mounting: FixtureMounting): EulerDegrees {
  if (mounting === 'floor') return { yaw: 0, pitch: 180, roll: 0 };
  if (mounting === 'wall') return { yaw: 0, pitch: -90, roll: 0 };
  return { yaw: 0, pitch: 0, roll: 0 };
}

function orientationRotation(orientation: FixtureOrientation): EulerDegrees {
  if (orientation === 'inverted') return { yaw: 0, pitch: 180, roll: 0 };
  if (orientation === 'rotated90') return { yaw: 0, pitch: 0, roll: 90 };
  if (orientation === 'rotated180') return { yaw: 0, pitch: 0, roll: 180 };
  return { yaw: 0, pitch: 0, roll: 0 };
}

export function worldDirectionToFixtureLocal(input: {
  direction: Vec3;
  transform: FixtureTransform;
  mounting: FixtureMounting;
  orientation: FixtureOrientation;
}): Vec3 {
  const mount = mountingRotation(input.mounting);
  const orientation = orientationRotation(input.orientation);
  let direction = inverseRotateEuler(normalize(input.direction), input.transform.rotation);
  direction = inverseRotateEuler(direction, mount);
  direction = inverseRotateEuler(direction, orientation);
  return normalize(direction);
}

export function calculateBeamRay(input: {
  transform: FixtureTransform;
  mounting: FixtureMounting;
  orientation: FixtureOrientation;
  panDegrees: number;
  tiltDegrees: number;
  angleDegrees?: number;
  lensOffset?: Vec3;
}): BeamRay {
  const mount = mountingRotation(input.mounting);
  const orientation = orientationRotation(input.orientation);
  let direction: Vec3 = { x: 0, y: -1, z: 0 };
  direction = rotateX(direction, input.tiltDegrees);
  direction = rotateY(direction, input.panDegrees);
  direction = rotateEuler(direction, orientation);
  direction = rotateEuler(direction, mount);
  direction = rotateEuler(direction, input.transform.rotation);

  const localLens = input.lensOffset ?? { x: 0, y: 0, z: 0 };
  const lensOffset = rotateEuler(rotateEuler(rotateEuler(localLens, orientation), mount), input.transform.rotation);
  return {
    origin: add(input.transform.position, lensOffset),
    direction: normalize(direction),
    angleDegrees: Math.max(0.1, input.angleDegrees ?? 12)
  };
}

export function pointAlongRay(ray: BeamRay, distanceMeters: number): Vec3 {
  return add(ray.origin, scale(ray.direction, distanceMeters));
}

export function legacyFixtureTransform(
  input: { stageX?: number; stageY?: number; stageDepth?: number; stageDirection?: number },
  index: number,
  total: number,
  dimensions: StageDimensions = DEFAULT_STAGE_DIMENSIONS
): FixtureTransform {
  const fallbackX = ((index + 1) / (total + 1)) * 100;
  const xPercent = Math.max(0, Math.min(100, input.stageX ?? fallbackX));
  const yPercent = Math.max(0, Math.min(100, input.stageY ?? 14));
  const zPercent = Math.max(0, Math.min(100, input.stageDepth ?? 35));
  const legacyVerticalOffset = (14 - yPercent) / 100 * dimensions.height;
  return {
    position: {
      x: (xPercent / 100 - 0.5) * dimensions.width,
      y: Math.max(0, Math.min(dimensions.height, dimensions.trimHeight + legacyVerticalOffset)),
      z: zPercent / 100 * dimensions.depth
    },
    rotation: {
      yaw: Math.max(-180, Math.min(180, input.stageDirection ?? 0)),
      pitch: 0,
      roll: 0
    }
  };
}

export function metersToDisplay(value: number, unit: StageUnit): number {
  return unit === 'feet' ? value / METERS_PER_FOOT : value;
}

export function displayToMeters(value: number, unit: StageUnit): number {
  return unit === 'feet' ? value * METERS_PER_FOOT : value;
}
