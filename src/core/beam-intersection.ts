import { add, normalize, scale, type BeamRay, type StageDimensions, type Vec3 } from './geometry';
import { migrateStageElement, stageElementPosition, type StageElement } from '../lib/stage';

export type BeamSurface = 'floor' | 'ceiling' | 'back-wall' | 'front-wall' | 'left-wall' | 'right-wall' | 'stage-object';

export type BeamIntersection = {
  point: Vec3;
  distance: number;
  surface: BeamSurface;
  elementId?: string;
  elementName?: string;
};

type Candidate = BeamIntersection & { valid: boolean };

const EPSILON = 1e-6;

function rayBoxDistance(origin: Vec3, direction: Vec3, minimum: Vec3, maximum: Vec3): number | null {
  let near = Number.NEGATIVE_INFINITY;
  let far = Number.POSITIVE_INFINITY;

  for (const axis of ['x', 'y', 'z'] as const) {
    const component = direction[axis];
    if (Math.abs(component) <= EPSILON) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    let first = (minimum[axis] - origin[axis]) / component;
    let second = (maximum[axis] - origin[axis]) / component;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    if (near > far) return null;
  }

  if (far <= EPSILON) return null;
  const distance = near > EPSILON ? near : far;
  return Number.isFinite(distance) && distance > EPSILON ? distance : null;
}

function inRange(value: number, minimum: number, maximum: number) {
  return value >= minimum - EPSILON && value <= maximum + EPSILON;
}

export function intersectBeamWithStage(ray: BeamRay, dimensions: StageDimensions, elements: readonly StageElement[] = []): BeamIntersection | null {
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

  elements.forEach((element) => {
    const resolved = migrateStageElement(element, dimensions);
    const center = stageElementPosition(resolved, dimensions);
    const size = resolved.dimensions ?? { x: .5, y: .5, z: .5 };
    const minimum = {
      x: center.x - size.x / 2,
      y: Math.max(0, center.y - size.y / 2),
      z: center.z - size.z / 2
    };
    const maximum = {
      x: center.x + size.x / 2,
      y: center.y + size.y / 2,
      z: center.z + size.z / 2
    };
    const amount = rayBoxDistance(ray.origin, direction, minimum, maximum);
    if (amount == null) return;
    const point = add(ray.origin, scale(direction, amount));
    candidates.push({
      surface: 'stage-object',
      point,
      distance: amount,
      valid: true,
      elementId: element.id,
      elementName: element.label
    });
  });

  return candidates.filter((candidate) => candidate.valid).sort((left, right) => left.distance - right.distance)[0] ?? null;
}
