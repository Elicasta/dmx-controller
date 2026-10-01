import type { StageDimensions, Vec3 } from './geometry';

export type VisualizerCamera = {
  position: Vec3;
  target: Vec3;
  fovDegrees: number;
  orthographicScale?: number;
};

export type VisualizerCameraPreset = 'foh' | 'stage-left' | 'stage-right' | 'top' | 'front' | 'side' | 'close';

export type CameraBasis = {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
};

export type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
};

const EPSILON = 1e-6;

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(value: Vec3, amount: number): Vec3 {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function length(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value: Vec3): Vec3 {
  const magnitude = Math.max(EPSILON, length(value));
  return scale(value, 1 / magnitude);
}

export function cameraBasis(camera: VisualizerCamera): CameraBasis {
  const forward = normalize(subtract(camera.target, camera.position));
  let right = cross(forward, { x: 0, y: 1, z: 0 });
  if (length(right) < EPSILON) right = { x: 1, y: 0, z: 0 };
  right = normalize(right);
  const up = normalize(cross(right, forward));
  return { forward, right, up };
}

export type VisualizerRay = {
  origin: Vec3;
  direction: Vec3;
};

export function screenRayFromVisualizerPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  camera: VisualizerCamera
): VisualizerRay {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const basis = cameraBasis(camera);
  const fov = Math.max(20, Math.min(100, camera.fovDegrees)) * Math.PI / 180;
  const focal = safeHeight / (2 * Math.tan(fov / 2));
  const horizontal = (x - safeWidth / 2) / focal;
  const vertical = (safeHeight / 2 - y) / focal;
  const direction = normalize(add(add(basis.forward, scale(basis.right, horizontal)), scale(basis.up, vertical)));
  return { origin: { ...camera.position }, direction };
}

export function intersectVisualizerRayWithYPlane(ray: VisualizerRay, y: number): Vec3 | null {
  if (Math.abs(ray.direction.y) < EPSILON) return null;
  const distance = (y - ray.origin.y) / ray.direction.y;
  if (distance <= 0) return null;
  return add(ray.origin, scale(ray.direction, distance));
}

export function projectVisualizerPoint(
  point: Vec3,
  camera: VisualizerCamera,
  width: number,
  height: number
): ProjectedPoint {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const basis = cameraBasis(camera);
  const relative = subtract(point, camera.position);
  const depth = dot(relative, basis.forward);
  if (depth <= .02) return { x: -10000, y: -10000, depth, visible: false };

  const horizontal = dot(relative, basis.right);
  const vertical = dot(relative, basis.up);
  const fov = Math.max(20, Math.min(100, camera.fovDegrees)) * Math.PI / 180;
  const focal = safeHeight / (2 * Math.tan(fov / 2));
  const orthoScale = camera.orthographicScale && camera.orthographicScale > 0
    ? Math.min(safeWidth, safeHeight) / camera.orthographicScale
    : 0;
  const x = orthoScale ? safeWidth / 2 + horizontal * orthoScale : safeWidth / 2 + horizontal * focal / depth;
  const y = orthoScale ? safeHeight / 2 - vertical * orthoScale : safeHeight / 2 - vertical * focal / depth;
  const margin = Math.max(safeWidth, safeHeight) * .25;

  return {
    x,
    y,
    depth,
    visible: x >= -margin && x <= safeWidth + margin && y >= -margin && y <= safeHeight + margin
  };
}

export function visualizerCameraPreset(preset: VisualizerCameraPreset, dimensions: StageDimensions): VisualizerCamera {
  const stageCenter = { x: 0, y: dimensions.height * .28, z: dimensions.depth * .45 };
  const audienceDepth = Math.max(dimensions.roomDepth, dimensions.depth * 2.2);

  if (preset === 'stage-left') {
    return {
      position: { x: -dimensions.roomWidth * .42, y: dimensions.roomHeight * .34, z: dimensions.depth * .82 },
      target: stageCenter,
      fovDegrees: 52
    };
  }

  if (preset === 'stage-right') {
    return {
      position: { x: dimensions.roomWidth * .42, y: dimensions.roomHeight * .34, z: dimensions.depth * .82 },
      target: stageCenter,
      fovDegrees: 52
    };
  }

  if (preset === 'top') {
    return {
      position: { x: 0, y: Math.max(dimensions.roomHeight * 2.5, dimensions.height * 4), z: dimensions.depth * .6 },
      target: { x: 0, y: 0, z: dimensions.depth * .55 },
      fovDegrees: 48,
      orthographicScale: Math.max(dimensions.roomWidth, dimensions.roomDepth) * 1.15
    };
  }

  if (preset === 'front') {
    return {
      position: { x: 0, y: dimensions.height * .42, z: Math.max(dimensions.roomDepth * 2.5, dimensions.depth * 4) },
      target: { x: 0, y: dimensions.height * .42, z: dimensions.depth * .42 },
      fovDegrees: 45,
      orthographicScale: Math.max(dimensions.roomWidth, dimensions.roomHeight * 1.6) * 1.08
    };
  }

  if (preset === 'side') {
    return {
      position: { x: dimensions.roomWidth * 2.5, y: dimensions.height * .42, z: dimensions.depth * .55 },
      target: { x: 0, y: dimensions.height * .42, z: dimensions.depth * .55 },
      fovDegrees: 45,
      orthographicScale: Math.max(dimensions.roomDepth, dimensions.roomHeight * 1.6) * 1.08
    };
  }

  if (preset === 'close') {
    return {
      position: { x: 0, y: dimensions.height * .25, z: dimensions.depth * 1.34 },
      target: { x: 0, y: dimensions.height * .3, z: dimensions.depth * .42 },
      fovDegrees: 58
    };
  }

  return {
    position: { x: 0, y: dimensions.roomHeight * .35, z: Math.max(dimensions.depth * 1.65, audienceDepth * .78) },
    target: stageCenter,
    fovDegrees: 50
  };
}

export function orbitVisualizerCamera(
  target: Vec3,
  yawRadians: number,
  pitchRadians: number,
  distance: number,
  fovDegrees = 50
): VisualizerCamera {
  const safeDistance = Math.max(.8, distance);
  const safePitch = Math.max(-1.35, Math.min(1.35, pitchRadians));
  const horizontal = Math.cos(safePitch) * safeDistance;
  return {
    target: { ...target },
    position: {
      x: target.x + Math.sin(yawRadians) * horizontal,
      y: target.y + Math.sin(safePitch) * safeDistance,
      z: target.z + Math.cos(yawRadians) * horizontal
    },
    fovDegrees
  };
}

function ease(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  };
}

export function interpolateVisualizerCamera(a: VisualizerCamera, b: VisualizerCamera, progress: number): VisualizerCamera {
  const t = ease(progress);
  return {
    position: lerpVec3(a.position, b.position, t),
    target: lerpVec3(a.target, b.target, t),
    fovDegrees: lerp(a.fovDegrees, b.fovDegrees, t),
    orthographicScale: a.orthographicScale && b.orthographicScale
      ? lerp(a.orthographicScale, b.orthographicScale, t)
      : undefined
  };
}

export function visualizerFlybyCamera(progress: number, dimensions: StageDimensions): VisualizerCamera {
  const keyframes: VisualizerCamera[] = [
    visualizerCameraPreset('foh', dimensions),
    visualizerCameraPreset('stage-left', dimensions),
    visualizerCameraPreset('close', dimensions),
    visualizerCameraPreset('stage-right', dimensions),
    visualizerCameraPreset('foh', dimensions)
  ];
  const clamped = Math.max(0, Math.min(.999999, progress));
  const scaled = clamped * (keyframes.length - 1);
  const index = Math.floor(scaled);
  return interpolateVisualizerCamera(keyframes[index], keyframes[index + 1], scaled - index);
}

export function cameraOrbitFromPose(camera: VisualizerCamera): { yaw: number; pitch: number; distance: number } {
  const delta = subtract(camera.position, camera.target);
  const distance = Math.max(EPSILON, length(delta));
  return {
    yaw: Math.atan2(delta.x, delta.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, delta.y / distance))),
    distance
  };
}

export function cameraForwardPoint(camera: VisualizerCamera, distance: number): Vec3 {
  return add(camera.position, scale(cameraBasis(camera).forward, distance));
}
