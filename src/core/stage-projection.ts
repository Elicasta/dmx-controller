import type { StageDimensions, Vec3 } from './geometry';

export type StageView = 'perspective' | 'top' | 'front' | 'side';
export type StagePoint2D = { x: number; y: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

type Plane = { horizontal: number; vertical: number; x: number; y: number };

function planeFor(point: Vec3, dimensions: StageDimensions, view: Exclude<StageView, 'perspective'>): Plane {
  if (view === 'top') return {
    horizontal: dimensions.width,
    vertical: dimensions.depth,
    x: point.x + dimensions.width / 2,
    y: dimensions.depth - point.z
  };
  if (view === 'front') return {
    horizontal: dimensions.width,
    vertical: dimensions.height,
    x: point.x + dimensions.width / 2,
    y: dimensions.height - point.y
  };
  return {
    horizontal: dimensions.depth,
    vertical: dimensions.height,
    x: point.z,
    y: dimensions.height - point.y
  };
}

function orthographicLayout(
  dimensions: StageDimensions,
  view: Exclude<StageView, 'perspective'>,
  width: number,
  height: number,
  zoom: number
) {
  const marginX = width * .08;
  const marginY = height * .1;
  const horizontal = view === 'side' ? dimensions.depth : dimensions.width;
  const vertical = view === 'top' ? dimensions.depth : dimensions.height;
  // One metre always occupies the same number of pixels on both axes.
  const baseScale = Math.min((width - marginX * 2) / horizontal, (height - marginY * 2) / vertical);
  const scale = baseScale * clamp(zoom, .7, 1.8);
  return {
    scale,
    left: width / 2 - horizontal * scale / 2,
    top: height / 2 - vertical * scale / 2
  };
}

export function projectStagePoint(
  point: Vec3,
  dimensions: StageDimensions,
  view: StageView,
  width = 1000,
  height = 560,
  zoom = 1
): StagePoint2D {
  if (view !== 'perspective') {
    const plane = planeFor(point, dimensions, view);
    const layout = orthographicLayout(dimensions, view, width, height, zoom);
    return { x: layout.left + plane.x * layout.scale, y: layout.top + plane.y * layout.scale };
  }

  const x = clamp((point.x + dimensions.width / 2) / dimensions.width, 0, 1);
  const y = clamp(point.y / dimensions.height, 0, 1);
  const z = clamp(point.z / dimensions.depth, 0, 1);
  const perspectiveScale = 1 - z * .32;
  const perspectiveX = (x - .5) * perspectiveScale + .5;
  const perspectiveY = .82 - z * .48 - y * .48;
  const viewZoom = clamp(zoom, .7, 1.8);
  return {
    x: 500 + (80 + perspectiveX * 840 - 500) * viewZoom,
    y: 280 + (56 + perspectiveY * 448 - 280) * viewZoom
  };
}

/**
 * Maps a pointer back to the stage plane using the exact inverse scale used by
 * projectStagePoint. Orthographic views preserve real-world proportions.
 */
export function unprojectStagePoint(
  point: StagePoint2D,
  dimensions: StageDimensions,
  view: StageView,
  preserved: Vec3,
  width = 1000,
  height = 560,
  zoom = 1
): Vec3 {
  if (view !== 'perspective') {
    const layout = orthographicLayout(dimensions, view, width, height, zoom);
    const planeX = (point.x - layout.left) / layout.scale;
    const planeY = (point.y - layout.top) / layout.scale;
    if (view === 'top') return {
      x: clamp(planeX - dimensions.width / 2, -dimensions.width / 2, dimensions.width / 2),
      y: preserved.y,
      z: clamp(dimensions.depth - planeY, 0, dimensions.depth)
    };
    if (view === 'front') return {
      x: clamp(planeX - dimensions.width / 2, -dimensions.width / 2, dimensions.width / 2),
      y: clamp(dimensions.height - planeY, 0, dimensions.height),
      z: preserved.z
    };
    return {
      x: preserved.x,
      y: clamp(dimensions.height - planeY, 0, dimensions.height),
      z: clamp(planeX, 0, dimensions.depth)
    };
  }

  const viewZoom = clamp(zoom, .7, 1.8);
  const screenX = ((point.x - 500) / viewZoom + 500 - 80) / 840;
  const screenY = ((point.y - 280) / viewZoom + 280 - 56) / 448;
  const normalizedY = clamp(preserved.y / dimensions.height, 0, 1);
  const z = clamp((.82 - normalizedY * .48 - screenY) / .48, 0, 1);
  const perspectiveScale = 1 - z * .32;
  const x = clamp((screenX - .5) / perspectiveScale + .5, 0, 1);
  return {
    x: (x - .5) * dimensions.width,
    y: preserved.y,
    z: z * dimensions.depth
  };
}
