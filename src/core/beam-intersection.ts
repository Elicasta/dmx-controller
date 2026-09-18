import { add, normalize, scale, type BeamRay, type StageDimensions, type Vec3 } from './geometry';

export type BeamSurface = 'floor' | 'ceiling' | 'back-wall' | 'front-wall' | 'left-wall' | 'right-wall';

export type BeamIntersection = {
  point: Vec3;
  distance: number;
  surface: BeamSurface;
};

type Candidate = BeamIntersection & { valid: boolean };

const EPSILON = 1e-6;

function inRange(value: number, minimum: number, maximum: number) {
  return value >= minimum - EPSILON && value <= maximum + EPSILON;
}

export function intersectBeamWithStage(ray: BeamRay, dimensions: StageDimensions): BeamIntersection | null {
  const direction = normalize(ray.direction);
  const xMinimum = -dimensions.roomWidth / 2;
  const xMaximum = dimensions.roomWidth / 2;
  const zMinimum = -dimensions.roomDepth;
  const zMaximum = dimensions.depth;
  const candidates: Candidate[] = [];

  const addPlane = (surface: BeamSurface, amount: number, valid: (point: Vec3) => boolean) => {
    if (!Number.isFinite(amount) || amount <= EPSILON) return;
    const point = add(ray.origin, scale(direction, amount));
    candidates.push({ surface, point, distance: amount, valid: valid(point) });
  };

  if (Math.abs(direction.y) > EPSILON) {
    addPlane('floor', (0 - ray.origin.y) / direction.y, (point) => (
      inRange(point.x, xMinimum, xMaximum) && inRange(point.z, zMinimum, zMaximum)
    ));
    addPlane('ceiling', (dimensions.roomHeight - ray.origin.y) / direction.y, (point) => (
      inRange(point.x, xMinimum, xMaximum) && inRange(point.z, zMinimum, zMaximum)
    ));
  }
  if (Math.abs(direction.z) > EPSILON) {
    addPlane('back-wall', (dimensions.depth - ray.origin.z) / direction.z, (point) => (
      inRange(point.x, xMinimum, xMaximum) && inRange(point.y, 0, dimensions.roomHeight)
    ));
    addPlane('front-wall', (-dimensions.roomDepth - ray.origin.z) / direction.z, (point) => (
      inRange(point.x, xMinimum, xMaximum) && inRange(point.y, 0, dimensions.roomHeight)
    ));
  }
  if (Math.abs(direction.x) > EPSILON) {
    addPlane('left-wall', (xMinimum - ray.origin.x) / direction.x, (point) => (
      inRange(point.y, 0, dimensions.roomHeight) && inRange(point.z, zMinimum, zMaximum)
    ));
    addPlane('right-wall', (xMaximum - ray.origin.x) / direction.x, (point) => (
      inRange(point.y, 0, dimensions.roomHeight) && inRange(point.z, zMinimum, zMaximum)
    ));
  }

  return candidates.filter((candidate) => candidate.valid).sort((left, right) => left.distance - right.distance)[0] ?? null;
}
