import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { fixtureGeometryState } from '../core/fixture-geometry';
import { cameraBasis, cameraOrbitFromPose, orbitVisualizerCamera, projectVisualizerPoint, visualizerCameraPreset, visualizerFlybyCamera, type VisualizerCamera, type VisualizerCameraPreset } from '../core/visualizer-camera';
import { pointAlongRay, type EulerDegrees, type StageDimensions, type Vec3 } from '../core/geometry';
import { findMode, readFixtureParameter, type PatchedFixture } from '../lib/fixtures';
import { stageElementPosition, type StageElement } from '../lib/stage';

export type VisualizerSnapshot = {
  patch: PatchedFixture[];
  output: number[];
  dimensions: StageDimensions;
  elements: StageElement[];
  blackout: boolean;
};

type VisualizerQuality = 'fast' | 'quality';
type CameraSelection = VisualizerCameraPreset | 'custom';

type MediaEntry = {
  deviceId: string;
  video: HTMLVideoElement;
  stream: MediaStream;
};

type Projected = ReturnType<typeof projectVisualizerPoint>;

type Face = {
  depth: number;
  points: Projected[];
  fill: string;
  stroke: string;
  elementId: string;
  label?: string;
  screenElement?: StageElement;
};

const FLYBY_MS = 12000;
const FACE_INDICES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 4, 7, 3],
  [1, 5, 6, 2],
  [3, 2, 6, 7],
  [0, 1, 5, 4]
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(value: Vec3, amount: number): Vec3 {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function rotateLocal(point: Vec3, rotation: EulerDegrees): Vec3 {
  const yaw = radians(rotation.yaw);
  const pitch = radians(rotation.pitch);
  const roll = radians(rotation.roll);

  const yawed = {
    x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw),
    y: point.y,
    z: -point.x * Math.sin(yaw) + point.z * Math.cos(yaw)
  };
  const pitched = {
    x: yawed.x,
    y: yawed.y * Math.cos(pitch) - yawed.z * Math.sin(pitch),
    z: yawed.y * Math.sin(pitch) + yawed.z * Math.cos(pitch)
  };
  return {
    x: pitched.x * Math.cos(roll) - pitched.y * Math.sin(roll),
    y: pitched.x * Math.sin(roll) + pitched.y * Math.cos(roll),
    z: pitched.z
  };
}

function elementCorners(element: StageElement, stage: StageDimensions): Vec3[] {
  const position = stageElementPosition(element, stage);
  const dimensions = element.dimensions ?? { x: 1, y: 1, z: 1 };
  const rotation = element.transform?.rotation ?? { yaw: 0, pitch: 0, roll: 0 };
  const hx = dimensions.x / 2;
  const hy = dimensions.y / 2;
  const hz = Math.max(.03, dimensions.z / 2);
  const locals: Vec3[] = [
    { x: -hx, y: -hy, z: -hz },
    { x: hx, y: -hy, z: -hz },
    { x: hx, y: hy, z: -hz },
    { x: -hx, y: hy, z: -hz },
    { x: -hx, y: -hy, z: hz },
    { x: hx, y: -hy, z: hz },
    { x: hx, y: hy, z: hz },
    { x: -hx, y: hy, z: hz }
  ];
  return locals.map((point) => add(position, rotateLocal(point, rotation)));
}

function parseHex(color: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7d8793';
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16)
  ];
}

function shade(color: string, factor: number, alpha = 1) {
  const [red, green, blue] = parseHex(color);
  return `rgba(${Math.round(red * factor)},${Math.round(green * factor)},${Math.round(blue * factor)},${alpha})`;
}

function fixtureColor(snapshot: VisualizerSnapshot, fixture: PatchedFixture): string {
  const mode = findMode(fixture);
  const has = (parameter: string) => mode?.channels.some((channel) => channel.parameter === parameter) ?? false;
  const red = has('red') ? readFixtureParameter(snapshot.output, fixture, 'red') : 255;
  const green = has('green') ? readFixtureParameter(snapshot.output, fixture, 'green') : 255;
  const blue = has('blue') ? readFixtureParameter(snapshot.output, fixture, 'blue') : 255;
  const white = has('white') ? readFixtureParameter(snapshot.output, fixture, 'white') : 0;
  const amber = has('amber') ? readFixtureParameter(snapshot.output, fixture, 'amber') : 0;
  const r = clamp(red + white * .7 + amber * .85, 0, 255);
  const g = clamp(green + white * .7 + amber * .35, 0, 255);
  const b = clamp(blue + white * .7, 0, 255);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function fixtureIntensity(snapshot: VisualizerSnapshot, fixture: PatchedFixture): number {
  if (snapshot.blackout) return 0;
  const mode = findMode(fixture);
  const hasDimmer = mode?.channels.some((channel) => channel.parameter === 'dimmer') ?? false;
  return hasDimmer ? readFixtureParameter(snapshot.output, fixture, 'dimmer') / 255 : 1;
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Projected[]) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
}

function pointInsideFace(x: number, y: number, points: readonly Projected[]) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    const crosses = ((a.y > y) !== (b.y > y))
      && x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1e-9) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function averageDepth(points: readonly Projected[]) {
  return points.reduce((sum, point) => sum + point.depth, 0) / Math.max(1, points.length);
}

function visibleFace(points: readonly Projected[]) {
  if (points.some((point) => point.depth <= .02)) return false;
  const [a, b, c] = points;
  const signed = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(signed) > .2;
}

function drawImageTriangle(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourcePoints: readonly [number, number][],
  destination: readonly Projected[]
) {
  const [s0, s1, s2] = sourcePoints;
  const [d0, d1, d2] = destination;
  const determinant = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (Math.abs(determinant) < 1e-6) return;

  const a = (d0.x * (s1[1] - s2[1]) + d1.x * (s2[1] - s0[1]) + d2.x * (s0[1] - s1[1])) / determinant;
  const c = (d0.x * (s2[0] - s1[0]) + d1.x * (s0[0] - s2[0]) + d2.x * (s1[0] - s0[0])) / determinant;
  const e = (d0.x * (s1[0] * s2[1] - s2[0] * s1[1]) + d1.x * (s2[0] * s0[1] - s0[0] * s2[1]) + d2.x * (s0[0] * s1[1] - s1[0] * s0[1])) / determinant;
  const b = (d0.y * (s1[1] - s2[1]) + d1.y * (s2[1] - s0[1]) + d2.y * (s0[1] - s1[1])) / determinant;
  const d = (d0.y * (s2[0] - s1[0]) + d1.y * (s0[0] - s2[0]) + d2.y * (s1[0] - s0[0])) / determinant;
  const f = (d0.y * (s1[0] * s2[1] - s2[0] * s1[1]) + d1.y * (s2[0] * s0[1] - s0[0] * s2[1]) + d2.y * (s0[0] * s1[1] - s1[0] * s0[1])) / determinant;

  ctx.save();
  polygon(ctx, destination);
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

function drawImageQuad(ctx: CanvasRenderingContext2D, source: CanvasImageSource, points: readonly Projected[]) {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : 0;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : 0;
  if (!width || !height || points.length !== 4) return false;
  drawImageTriangle(ctx, source, [[0, 0], [width, 0], [width, height]], [points[0], points[1], points[2]]);
  drawImageTriangle(ctx, source, [[0, 0], [width, height], [0, height]], [points[0], points[2], points[3]]);
  return true;
}

function objectFaces(element: StageElement, stage: StageDimensions, camera: VisualizerCamera, width: number, height: number): Face[] {
  const corners = elementCorners(element, stage);
  const projected = corners.map((corner) => projectVisualizerPoint(corner, camera, width, height));
  const factors = [.58, .82, .68, .72, 1, .48];

  return FACE_INDICES.flatMap((indices, faceIndex) => {
    const points = indices.map((index) => projected[index]);
    if (!visibleFace(points)) return [];
    return [{
      depth: averageDepth(points),
      points,
      fill: shade(element.color, factors[faceIndex], element.type === 'back-wall' ? .88 : .96),
      stroke: shade(element.color, Math.min(1.25, factors[faceIndex] + .25), .8),
      elementId: element.id,
      label: faceIndex === 1 ? element.label : undefined,
      screenElement: element.type === 'led-screen' && faceIndex === 1 ? element : undefined
    }];
  });
}

function drawFloorGrid(ctx: CanvasRenderingContext2D, camera: VisualizerCamera, stage: StageDimensions, width: number, height: number, quality: VisualizerQuality) {
  const roomHalf = stage.roomWidth / 2;
  const roomDepth = Math.max(stage.roomDepth, stage.depth * 1.5);
  const step = quality === 'quality' ? 1 : 2;
  ctx.save();
  ctx.lineWidth = 1;

  for (let x = -Math.floor(roomHalf); x <= roomHalf; x += step) {
    const a = projectVisualizerPoint({ x, y: 0, z: 0 }, camera, width, height);
    const b = projectVisualizerPoint({ x, y: 0, z: roomDepth }, camera, width, height);
    if (a.depth <= 0 || b.depth <= 0) continue;
    ctx.strokeStyle = x === 0 ? 'rgba(124,157,174,.28)' : 'rgba(88,112,126,.12)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (let z = 0; z <= roomDepth; z += step) {
    const a = projectVisualizerPoint({ x: -roomHalf, y: 0, z }, camera, width, height);
    const b = projectVisualizerPoint({ x: roomHalf, y: 0, z }, camera, width, height);
    if (a.depth <= 0 || b.depth <= 0) continue;
    ctx.strokeStyle = Math.abs(z - stage.depth) < .25 ? 'rgba(116,221,151,.32)' : 'rgba(88,112,126,.12)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoom(ctx: CanvasRenderingContext2D, camera: VisualizerCamera, stage: StageDimensions, width: number, height: number) {
  const roomHalf = stage.roomWidth / 2;
  const roomDepth = Math.max(stage.roomDepth, stage.depth * 1.5);
  const floor = [
    { x: -roomHalf, y: 0, z: 0 },
    { x: roomHalf, y: 0, z: 0 },
    { x: roomHalf, y: 0, z: roomDepth },
    { x: -roomHalf, y: 0, z: roomDepth }
  ].map((point) => projectVisualizerPoint(point, camera, width, height));
  const back = [
    { x: -roomHalf, y: 0, z: 0 },
    { x: roomHalf, y: 0, z: 0 },
    { x: roomHalf, y: stage.roomHeight, z: 0 },
    { x: -roomHalf, y: stage.roomHeight, z: 0 }
  ].map((point) => projectVisualizerPoint(point, camera, width, height));

  if (back.every((point) => point.depth > 0)) {
    polygon(ctx, back);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#101923');
    gradient.addColorStop(1, '#070b10');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  if (floor.every((point) => point.depth > 0)) {
    polygon(ctx, floor);
    const gradient = ctx.createLinearGradient(0, height * .3, 0, height);
    gradient.addColorStop(0, '#111820');
    gradient.addColorStop(1, '#05080c');
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function drawStageDeck(ctx: CanvasRenderingContext2D, camera: VisualizerCamera, stage: StageDimensions, width: number, height: number) {
  const half = stage.width / 2;
  const points = [
    { x: -half, y: .02, z: 0 },
    { x: half, y: .02, z: 0 },
    { x: half, y: .02, z: stage.depth },
    { x: -half, y: .02, z: stage.depth }
  ].map((point) => projectVisualizerPoint(point, camera, width, height));
  if (points.some((point) => point.depth <= 0)) return;
  polygon(ctx, points);
  ctx.fillStyle = '#171b20';
  ctx.fill();
  ctx.strokeStyle = 'rgba(188,203,214,.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawBeams(
  ctx: CanvasRenderingContext2D,
  snapshot: VisualizerSnapshot,
  camera: VisualizerCamera,
  width: number,
  height: number,
  haze: number,
  quality: VisualizerQuality
) {
  const basis = cameraBasis(camera);
  const length = Math.max(snapshot.dimensions.roomDepth, snapshot.dimensions.depth * 2.1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  snapshot.patch.forEach((fixture, index) => {
    const intensity = fixtureIntensity(snapshot, fixture);
    if (intensity <= .01) return;
    const geometry = fixtureGeometryState(snapshot.output, fixture, index, snapshot.patch.length, snapshot.dimensions);
    const endpoint = pointAlongRay(geometry.beam, length);
    const radius = Math.max(.03, Math.tan(radians(geometry.beam.angleDegrees / 2)) * length);
    const start = projectVisualizerPoint(geometry.beam.origin, camera, width, height);
    const endLeft = projectVisualizerPoint(add(endpoint, scale(basis.right, -radius)), camera, width, height);
    const endRight = projectVisualizerPoint(add(endpoint, scale(basis.right, radius)), camera, width, height);
    if (start.depth <= 0 || endLeft.depth <= 0 || endRight.depth <= 0) return;

    const color = fixtureColor(snapshot, fixture);
    const alpha = clamp((quality === 'quality' ? .34 : .23) * intensity * (.35 + haze), .03, .7);
    const gradient = ctx.createLinearGradient(start.x, start.y, (endLeft.x + endRight.x) / 2, (endLeft.y + endRight.y) / 2);
    gradient.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', `,${alpha * .95})`));
    gradient.addColorStop(.65, color.replace('rgb(', 'rgba(').replace(')', `,${alpha * .55})`));
    gradient.addColorStop(1, color.replace('rgb(', 'rgba(').replace(')', ',0)'));

    ctx.beginPath();
    ctx.moveTo(start.x - 1.5, start.y);
    ctx.lineTo(start.x + 1.5, start.y);
    ctx.lineTo(endRight.x, endRight.y);
    ctx.lineTo(endLeft.x, endLeft.y);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    if (quality === 'quality') {
      ctx.strokeStyle = color.replace('rgb(', 'rgba(').replace(')', `,${Math.min(.8, alpha * 1.45)})`);
      ctx.lineWidth = Math.max(1, intensity * 1.6);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo((endLeft.x + endRight.x) / 2, (endLeft.y + endRight.y) / 2);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function crowdPoints(stage: StageDimensions, quality: VisualizerQuality) {
  const points: Vec3[] = [];
  const half = Math.min(stage.roomWidth / 2 - .8, Math.max(stage.width / 2, 4));
  const start = stage.depth + 1.2;
  const end = Math.max(start + 1, stage.roomDepth - 1.2);
  const xStep = quality === 'quality' ? .72 : 1.05;
  const zStep = quality === 'quality' ? .82 : 1.18;
  let row = 0;
  for (let z = start; z <= end; z += zStep) {
    const offset = row % 2 ? xStep * .45 : 0;
    for (let x = -half + offset; x <= half; x += xStep) {
      points.push({ x, y: 0, z });
      if (points.length >= (quality === 'quality' ? 420 : 190)) return points;
    }
    row += 1;
  }
  return points;
}

function drawCrowd(ctx: CanvasRenderingContext2D, camera: VisualizerCamera, stage: StageDimensions, width: number, height: number, quality: VisualizerQuality) {
  const people = crowdPoints(stage, quality)
    .map((point) => ({ point, projected: projectVisualizerPoint({ ...point, y: 1.55 }, camera, width, height) }))
    .filter((item) => item.projected.depth > .05)
    .sort((a, b) => b.projected.depth - a.projected.depth);

  ctx.save();
  for (const item of people) {
    const foot = projectVisualizerPoint(item.point, camera, width, height);
    const head = item.projected;
    const size = clamp(210 / head.depth, 2.2, quality === 'quality' ? 8 : 6);
    ctx.strokeStyle = 'rgba(137,151,160,.36)';
    ctx.fillStyle = 'rgba(164,176,183,.42)';
    ctx.lineWidth = Math.max(1, size * .24);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + size * .7);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, size * .42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFixtureBodies(ctx: CanvasRenderingContext2D, snapshot: VisualizerSnapshot, camera: VisualizerCamera, width: number, height: number) {
  snapshot.patch.forEach((fixture, index) => {
    const geometry = fixtureGeometryState(snapshot.output, fixture, index, snapshot.patch.length, snapshot.dimensions);
    const point = projectVisualizerPoint(geometry.beam.origin, camera, width, height);
    if (point.depth <= 0) return;
    const radius = clamp(80 / point.depth, 3, 8);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#151b21';
    ctx.fill();
    ctx.strokeStyle = fixture.labelColor ?? '#788a95';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

function drawFaces(
  ctx: CanvasRenderingContext2D,
  faces: Face[],
  media: Map<string, MediaEntry>,
  quality: VisualizerQuality,
  selectedElementId?: string
) {
  for (const face of faces.sort((a, b) => b.depth - a.depth)) {
    polygon(ctx, face.points);
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.strokeStyle = face.elementId === selectedElementId ? '#64e18e' : face.stroke;
    ctx.lineWidth = face.elementId === selectedElementId ? 2.2 : 1;
    ctx.stroke();

    if (face.screenElement) {
      const entry = media.get(face.screenElement.id);
      if (entry?.video.readyState && entry.video.videoWidth > 0) {
        drawImageQuad(ctx, entry.video, face.points);
        polygon(ctx, face.points);
        ctx.strokeStyle = 'rgba(228,239,244,.58)';
        ctx.stroke();
      } else {
        polygon(ctx, face.points);
        const glow = quality === 'quality' ? .32 : .18;
        ctx.fillStyle = `rgba(210,230,240,${glow})`;
        ctx.fill();
      }
    }

    if (face.label && quality === 'quality') {
      const centerX = face.points.reduce((sum, point) => sum + point.x, 0) / face.points.length;
      const centerY = face.points.reduce((sum, point) => sum + point.y, 0) / face.points.length;
      ctx.fillStyle = 'rgba(224,234,239,.76)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(face.label, centerX, centerY);
    }
  }
}

function cameraLabel(selection: CameraSelection) {
  if (selection === 'foh') return 'FOH';
  if (selection === 'stage-left') return 'Stage Left';
  if (selection === 'stage-right') return 'Stage Right';
  if (selection === 'top') return 'Top';
  if (selection === 'close') return 'Close';
  return 'Custom';
}

export default function Visualizer3D({
  snapshot,
  compact = false,
  className = '',
  selectedElementId,
  onSelectElement
}: {
  snapshot: VisualizerSnapshot;
  compact?: boolean;
  className?: string;
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRef = useRef<Map<string, MediaEntry>>(new Map());
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const cameraRef = useRef<VisualizerCamera>(visualizerCameraPreset('foh', snapshot.dimensions));
  const flybyStartRef = useRef(0);
  const [cameraSelection, setCameraSelection] = useState<CameraSelection>('foh');
  const [orbit, setOrbit] = useState(() => cameraOrbitFromPose(visualizerCameraPreset('foh', snapshot.dimensions)));
  const [haze, setHaze] = useState(.68);
  const [showCrowd, setShowCrowd] = useState(true);
  const [quality, setQuality] = useState<VisualizerQuality>('quality');
  const [playingFlyby, setPlayingFlyby] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);

  const target = useMemo(() => ({
    x: 0,
    y: snapshot.dimensions.height * .28,
    z: snapshot.dimensions.depth * .45
  }), [snapshot.dimensions.height, snapshot.dimensions.depth]);

  function selectCamera(preset: VisualizerCameraPreset) {
    const camera = visualizerCameraPreset(preset, snapshot.dimensions);
    setCameraSelection(preset);
    setOrbit(cameraOrbitFromPose(camera));
    setPlayingFlyby(false);
  }

  useEffect(() => {
    if (cameraSelection === 'custom') return;
    const camera = visualizerCameraPreset(cameraSelection, snapshot.dimensions);
    setOrbit(cameraOrbitFromPose(camera));
  }, [
    snapshot.dimensions.width,
    snapshot.dimensions.depth,
    snapshot.dimensions.height,
    snapshot.dimensions.roomWidth,
    snapshot.dimensions.roomDepth,
    snapshot.dimensions.roomHeight
  ]);

  useEffect(() => {
    const desired = new Map<string, string>();
    for (const element of snapshot.elements) {
      const source = element.mediaSource;
      if (element.type === 'led-screen' && source?.kind === 'ndi' && source.deviceId) {
        desired.set(element.id, source.deviceId);
      }
    }

    for (const [id, entry] of mediaRef.current) {
      if (desired.get(id) === entry.deviceId) continue;
      entry.stream.getTracks().forEach((track) => track.stop());
      entry.video.srcObject = null;
      mediaRef.current.delete(id);
    }

    if (!navigator.mediaDevices?.getUserMedia) return;

    for (const [id, deviceId] of desired) {
      if (mediaRef.current.has(id)) continue;
      void navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      }).then(async (stream) => {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        try { await video.play(); } catch { /* redraw will show the screen fallback */ }
        mediaRef.current.set(id, { deviceId, video, stream });
        setMediaRevision((value) => value + 1);
      }).catch(() => {
        setMediaRevision((value) => value + 1);
      });
    }

    return () => {
      // Inputs stay alive across ordinary scene updates and are closed on unmount below.
    };
  }, [snapshot.elements]);

  useEffect(() => () => {
    for (const entry of mediaRef.current.values()) {
      entry.stream.getTracks().forEach((track) => track.stop());
      entry.video.srcObject = null;
    }
    mediaRef.current.clear();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    let frame = 0;
    let lastDraw = 0;
    let disposed = false;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    const draw = (now: number) => {
      if (disposed) return;
      const targetFps = quality === 'quality' ? 30 : 24;
      if (now - lastDraw >= 1000 / targetFps) {
        lastDraw = now;
        const bounds = host.getBoundingClientRect();
        const cssWidth = Math.max(320, Math.floor(bounds.width));
        const cssHeight = Math.max(compact ? 260 : 380, Math.floor(bounds.height));
        const dpr = Math.min(window.devicePixelRatio || 1, quality === 'quality' ? 2 : 1.35);
        const pixelWidth = Math.floor(cssWidth * dpr);
        const pixelHeight = Math.floor(cssHeight * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        let camera = orbitVisualizerCamera(target, orbit.yaw, orbit.pitch, orbit.distance, 50);
        if (playingFlyby) {
          if (!flybyStartRef.current) flybyStartRef.current = now;
          const progress = (now - flybyStartRef.current) / FLYBY_MS;
          if (progress >= 1) {
            setPlayingFlyby(false);
            flybyStartRef.current = 0;
            selectCamera('foh');
            camera = visualizerCameraPreset('foh', snapshot.dimensions);
          } else {
            camera = visualizerFlybyCamera(progress, snapshot.dimensions);
          }
        }

        const background = context.createLinearGradient(0, 0, 0, cssHeight);
        background.addColorStop(0, '#03070b');
        background.addColorStop(1, '#0a0d11');
        context.fillStyle = background;
        context.fillRect(0, 0, cssWidth, cssHeight);

        drawRoom(context, camera, snapshot.dimensions, cssWidth, cssHeight);
        drawFloorGrid(context, camera, snapshot.dimensions, cssWidth, cssHeight, quality);
        drawStageDeck(context, camera, snapshot.dimensions, cssWidth, cssHeight);
        cameraRef.current = camera;
        drawBeams(context, snapshot, camera, cssWidth, cssHeight, haze, quality);

        const faces = snapshot.elements.flatMap((element) => objectFaces(element, snapshot.dimensions, camera, cssWidth, cssHeight));
        drawFaces(context, faces, mediaRef.current, quality, selectedElementId ?? undefined);
        drawFixtureBodies(context, snapshot, camera, cssWidth, cssHeight);
        if (showCrowd) drawCrowd(context, camera, snapshot.dimensions, cssWidth, cssHeight, quality);

        const vignette = context.createRadialGradient(cssWidth / 2, cssHeight / 2, Math.min(cssWidth, cssHeight) * .2, cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * .72);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, quality === 'quality' ? 'rgba(0,0,0,.38)' : 'rgba(0,0,0,.24)');
        context.fillStyle = vignette;
        context.fillRect(0, 0, cssWidth, cssHeight);

        context.fillStyle = 'rgba(213,226,233,.72)';
        context.font = '11px system-ui, sans-serif';
        context.textAlign = 'left';
        context.fillText(`${cameraLabel(cameraSelection)} · ${snapshot.patch.length} fixtures · ${snapshot.elements.length} objects`, 14, cssHeight - 16);
      }
      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
    };
  }, [snapshot, orbit, haze, showCrowd, quality, compact, playingFlyby, cameraSelection, target, mediaRevision, selectedElementId]);

  function beginOrbit(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  }

  function moveOrbit(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
      setPlayingFlyby(false);
      setCameraSelection('custom');
    }
    if (!drag.moved) return;
    setOrbit((current) => ({
      ...current,
      yaw: current.yaw - dx * .006,
      pitch: clamp(current.pitch + dy * .005, -.15, 1.28)
    }));
  }

  function endOrbit(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved && onSelectElement) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const camera = cameraRef.current;
      const candidates = snapshot.elements.flatMap((element) => objectFaces(element, snapshot.dimensions, camera, bounds.width, bounds.height))
        .filter((face) => pointInsideFace(x, y, face.points))
        .sort((a, b) => a.depth - b.depth);
      if (candidates[0]) onSelectElement(candidates[0].elementId);
    }
  }

  function zoom(event: ReactWheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setPlayingFlyby(false);
    setCameraSelection('custom');
    setOrbit((current) => ({
      ...current,
      distance: clamp(current.distance * (event.deltaY > 0 ? 1.08 : .92), 2.2, Math.max(snapshot.dimensions.roomDepth * 1.9, 28))
    }));
  }

  function toggleFlyby() {
    if (playingFlyby) {
      setPlayingFlyby(false);
      flybyStartRef.current = 0;
      return;
    }
    flybyStartRef.current = performance.now();
    setCameraSelection('custom');
    setPlayingFlyby(true);
  }

  return <section ref={hostRef} className={`visualizer-3d ${compact ? 'compact' : ''} ${className}`}>
    <div className="visualizer-3d-toolbar">
      <div className="visualizer-camera-bank" role="group" aria-label="Visualizer cameras">
        {(['foh', 'stage-left', 'stage-right', 'top', 'close'] as VisualizerCameraPreset[]).map((preset) =>
          <button key={preset} className={cameraSelection === preset ? 'active' : ''} onClick={() => selectCamera(preset)}>{cameraLabel(preset)}</button>
        )}
      </div>
      <div className="visualizer-playback-tools">
        <button className={playingFlyby ? 'active' : ''} onClick={toggleFlyby}>{playingFlyby ? 'Stop Flyby' : '▶ Flyby'}</button>
        <button onClick={() => setShowCrowd((value) => !value)} aria-pressed={showCrowd}>Crowd {showCrowd ? 'On' : 'Off'}</button>
        <button onClick={() => setQuality((value) => value === 'quality' ? 'fast' : 'quality')}>Render {quality === 'quality' ? 'Quality' : 'Fast'}</button>
      </div>
      {!compact && <label className="visualizer-haze"><span>Haze {Math.round(haze * 100)}%</span><input type="range" min="0" max="1" step=".02" value={haze} onChange={(event) => setHaze(Number(event.target.value))}/></label>}
    </div>
    <canvas
      ref={canvasRef}
      className="visualizer-3d-canvas"
      aria-label="Interactive 3D stage visualizer"
      onPointerDown={beginOrbit}
      onPointerMove={moveOrbit}
      onPointerUp={endOrbit}
      onPointerCancel={endOrbit}
      onWheel={zoom}
    />
    {!compact && <div className="visualizer-3d-help">Drag to orbit · scroll to zoom · Flyby previews the room automatically</div>}
  </section>;
}
