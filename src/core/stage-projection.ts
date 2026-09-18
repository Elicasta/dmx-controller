import type { StageDimensions, Vec3 } from './geometry';

export type StageView = 'perspective' | 'top' | 'front' | 'side';
export type StagePoint2D = { x: number; y: number };

function percent(value: number, span: number) {
  return span <= 0 ? 0.5 : value / span;
}

export function projectStagePoint(
  point: Vec3,
  dimensions: StageDimensions,
  view: StageView,
  width = 1000,
  height = 560
): StagePoint2D {
  const marginX = width * 0.08;
  const marginY = height * 0.1;
  const drawableWidth = width - marginX * 2;
  const drawableHeight = height - marginY * 2;
  const x = percent(point.x + dimensions.width / 2, dimensions.width);
  const y = percent(point.y, dimensions.height);
  const z = percent(point.z, dimensions.depth);

  if (view === 'top') return { x: marginX + x * drawableWidth, y: marginY + z * drawableHeight };
  if (view === 'front') return { x: marginX + x * drawableWidth, y: height - marginY - y * drawableHeight };
  if (view === 'side') return { x: marginX + z * drawableWidth, y: height - marginY - y * drawableHeight };

  const perspectiveX = (x - 0.5) * (0.72 + z * 0.28) + 0.5;
  const perspectiveY = 0.08 + (1 - y) * 0.58 + z * 0.3;
  return {
    x: marginX + perspectiveX * drawableWidth,
    y: marginY + perspectiveY * drawableHeight
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Maps a pointer in the stage view back onto the view's editable plane.
 * Orthographic views edit their two visible axes. Perspective edits X/Z while
 * preserving height, which keeps a fixture's trim height stable while dragging.
 */
export function unprojectStagePoint(
  point: StagePoint2D,
  dimensions: StageDimensions,
  view: StageView,
  preserved: Vec3,
  width = 1000,
  height = 560
): Vec3 {
  const marginX = width * 0.08;
  const marginY = height * 0.1;
  const drawableWidth = width - marginX * 2;
  const drawableHeight = height - marginY * 2;
  const screenX = clamp((point.x - marginX) / drawableWidth, 0, 1);
  const screenY = clamp((point.y - marginY) / drawableHeight, 0, 1);
  const normalizedX = clamp((preserved.x + dimensions.width / 2) / dimensions.width, 0, 1);
  const normalizedY = clamp(preserved.y / dimensions.height, 0, 1);
  const normalizedZ = clamp(preserved.z / dimensions.depth, 0, 1);

  let x = normalizedX;
  let y = normalizedY;
  let z = normalizedZ;

  if (view === 'top') {
    x = screenX;
    z = screenY;
  } else if (view === 'front') {
    x = screenX;
    y = 1 - screenY;
  } else if (view === 'side') {
    z = screenX;
    y = 1 - screenY;
  } else {
    z = clamp((screenY - 0.08 - (1 - normalizedY) * 0.58) / 0.3, 0, 1);
    const perspectiveScale = 0.72 + z * 0.28;
    x = clamp((screenX - 0.5) / perspectiveScale + 0.5, 0, 1);
  }

  return {
    x: (x - 0.5) * dimensions.width,
    y: y * dimensions.height,
    z: z * dimensions.depth
  };
}
