import { followTimelineVideo } from '../lib/timeline-video';
import { readNativeMediaBlob } from '../lib/media-library';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { fixtureGeometryState } from '../core/fixture-geometry';
import { intersectBeamWithStage, type BeamSurface } from '../core/beam-intersection';
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

type VisualizerQuality = 'fast' | 'quality' | 'high';
type CameraSelection = VisualizerCameraPreset | 'custom';

type MediaEntry = {
  deviceId: string;
  source: HTMLVideoElement | HTMLImageElement;
  stream?: MediaStream;
  dispose?: ()=>void;
  visible?: boolean;
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

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dotVec(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(value: Vec3) {
  return Math.hypot(value.x, value.y, value.z);
}

function normalizeVec(value: Vec3): Vec3 {
  const length = magnitude(value);
  if (length < 1e-9) return { x: 0, y: -1, z: 0 };
  return scale(value, 1 / length);
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function beamBasis(directionInput: Vec3) {
  const direction = normalizeVec(directionInput);
  const reference = Math.abs(direction.y) < .88
    ? { x: 0, y: 1, z: 0 }
    : { x: 1, y: 0, z: 0 };
  const side = normalizeVec(cross(direction, reference));
  const up = normalizeVec(cross(side, direction));
  return { direction, side, up };
}

function radialDirection(side: Vec3, up: Vec3, angle: number): Vec3 {
  return add(scale(side, Math.cos(angle)), scale(up, Math.sin(angle)));
}

function rgba(color: string, alpha: number) {
  return color.replace('rgb(', 'rgba(').replace(')', `,${clamp(alpha, 0, 1)})`);
}

function surfaceAxes(surface: BeamSurface): [Vec3, Vec3] {
  if (surface === 'floor' || surface === 'ceiling') {
    return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  }
  if (surface === 'back-wall' || surface === 'front-wall') {
    return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
  }
  return [{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }];
}

function surfaceNormal(surface: BeamSurface): Vec3 {
  if (surface === 'floor') return { x: 0, y: 1, z: 0 };
  if (surface === 'ceiling') return { x: 0, y: -1, z: 0 };
  if (surface === 'back-wall') return { x: 0, y: 0, z: 1 };
  if (surface === 'front-wall') return { x: 0, y: 0, z: -1 };
  if (surface === 'left-wall') return { x: 1, y: 0, z: 0 };
  return { x: -1, y: 0, z: 0 };
}

function spillAxes(surface: BeamSurface, directionInput: Vec3): { major: Vec3; minor: Vec3; stretch: number } {
  const normal = surfaceNormal(surface);
  const direction = normalizeVec(directionInput);
  const tangent = subtractVec(direction, scale(normal, dotVec(direction, normal)));
  const fallback = surfaceAxes(surface);
  const major = magnitude(tangent) > 1e-5 ? normalizeVec(tangent) : fallback[0];
  const minor = normalizeVec(cross(normal, major));
  const incidence = Math.max(.18, Math.abs(dotVec(direction, normal)));
  return { major, minor, stretch: clamp(1 / incidence, 1, 3.6) };
}

function cameraFacingBeamRadial(directionInput: Vec3, camera: VisualizerCamera): Vec3 {
  const direction = normalizeVec(directionInput);
  const cameraAxes = cameraBasis(camera);
  const candidates = [cameraAxes.right, cameraAxes.up]
    .map((axis) => subtractVec(axis, scale(direction, dotVec(axis, direction))));
  const best = candidates.sort((a, b) => magnitude(b) - magnitude(a))[0];
  if (best && magnitude(best) > 1e-5) return normalizeVec(best);
  return beamBasis(direction).side;
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

function quadPoint(points: readonly Projected[], u: number, v: number): Projected {
  const [p0,p1,p2,p3]=points;
  const w0=(1-u)*(1-v),w1=u*(1-v),w2=u*v,w3=(1-u)*v;
  return {
    x:p0.x*w0+p1.x*w1+p2.x*w2+p3.x*w3,
    y:p0.y*w0+p1.y*w1+p2.y*w2+p3.y*w3,
    depth:p0.depth*w0+p1.depth*w1+p2.depth*w2+p3.depth*w3,
    visible:p0.visible||p1.visible||p2.visible||p3.visible
  };
}

function framedScreenQuad(source: HTMLVideoElement | HTMLImageElement, element: StageElement, points: readonly Projected[]) {
  const width=source instanceof HTMLVideoElement?source.videoWidth:source.naturalWidth;
  const height=source instanceof HTMLVideoElement?source.videoHeight:source.naturalHeight;
  const dimensions=element.dimensions ?? {x:16,y:9,z:.08};
  const sourceAspect=width/Math.max(1,height);
  const screenAspect=Math.max(.01,dimensions.x)/Math.max(.01,dimensions.y);
  const fit=element.mediaSource?.kind!=='none' ? element.mediaSource?.fit ?? 'contain' : 'contain';
  let fitX=1,fitY=1;
  if(fit==='contain'){
    if(sourceAspect>screenAspect)fitY=screenAspect/sourceAspect;
    else fitX=sourceAspect/screenAspect;
  }else{
    if(sourceAspect>screenAspect)fitX=sourceAspect/screenAspect;
    else fitY=screenAspect/sourceAspect;
  }
  const scaleValue=element.mediaSource?.kind!=='none' ? clamp(element.mediaSource?.scale ?? 1,.25,4) : 1;
  const offsetX=element.mediaSource?.kind!=='none' ? clamp(element.mediaSource?.offsetX ?? 0,-1,1) : 0;
  const offsetY=element.mediaSource?.kind!=='none' ? clamp(element.mediaSource?.offsetY ?? 0,-1,1) : 0;
  const sx=fitX*scaleValue,sy=fitY*scaleValue;
  const cx=.5+offsetX*.5,cy=.5+offsetY*.5;
  const left=cx-sx/2,right=cx+sx/2,top=cy-sy/2,bottom=cy+sy/2;
  return [
    quadPoint(points,left,top),
    quadPoint(points,right,top),
    quadPoint(points,right,bottom),
    quadPoint(points,left,bottom)
  ];
}

function objectFaces(element: StageElement, stage: StageDimensions, camera: VisualizerCamera, width: number, height: number): Face[] {
  const corners = elementCorners(element, stage);
  const projected = corners.map((corner) => projectVisualizerPoint(corner, camera, width, height));
  const factors = [.58, .82, .68, .72, 1, .48];
  const wireLike = element.type === 'person'
    || element.assetKind === 'chair'
    || element.assetKind === 'plant'
    || element.assetKind === 'lighting-stand'
    || element.assetKind === 'camera';
  const translucent = wireLike
    ? .035
    : element.type === 'drums' || element.assetKind === 'truss'
      ? .16
      : element.assetKind === 'pulpit'
        ? .5
        : element.type === 'back-wall'
          ? .88
          : .96;

  return FACE_INDICES.flatMap((indices, faceIndex) => {
    const points = indices.map((index) => projected[index]);
    if (!visibleFace(points)) return [];
    return [{
      depth: averageDepth(points),
      points,
      fill: shade(element.color, factors[faceIndex], translucent),
      stroke: shade(element.color, Math.min(1.25, factors[faceIndex] + .25), wireLike ? .16 : .8),
      elementId: element.id,
      label: faceIndex === 1 ? element.label : undefined,
      screenElement: element.type === 'led-screen' && faceIndex === 1 ? element : undefined
    }];
  });
}

function drawFloorGrid(ctx: CanvasRenderingContext2D, camera: VisualizerCamera, stage: StageDimensions, width: number, height: number, quality: VisualizerQuality) {
  const roomHalf = stage.roomWidth / 2;
  const roomDepth = Math.max(stage.roomDepth, stage.depth * 1.5);
  const step = quality !== 'fast' ? 1 : 2;
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

function drawLightSpill(
  ctx: CanvasRenderingContext2D,
  snapshot: VisualizerSnapshot,
  camera: VisualizerCamera,
  width: number,
  height: number,
  haze: number,
  quality: VisualizerQuality
) {
  if (quality === 'fast') return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  snapshot.patch.forEach((fixture, index) => {
    const intensity = fixtureIntensity(snapshot, fixture);
    if (intensity <= .015) return;

    const geometry = fixtureGeometryState(
      snapshot.output,
      fixture,
      index,
      snapshot.patch.length,
      snapshot.dimensions
    );
    const hit = intersectBeamWithStage(geometry.beam, snapshot.dimensions);
    if (!hit) return;

    const radius = clamp(
      Math.tan(radians(geometry.beam.angleDegrees / 2)) * hit.distance,
      .08,
      Math.max(snapshot.dimensions.roomWidth, snapshot.dimensions.roomHeight) * .42
    );
    const footprint = spillAxes(hit.surface, geometry.beam.direction);
    const center = projectVisualizerPoint(hit.point, camera, width, height);
    if (center.depth <= .02) return;

    const color = fixtureColor(snapshot, fixture);
    const segments = quality === 'high' ? 28 : 18;
    const layers = quality === 'high'
      ? [{ factor: 1, alpha: .038 }, { factor: .72, alpha: .064 }, { factor: .4, alpha: .115 }]
      : [{ factor: 1, alpha: .035 }, { factor: .5, alpha: .085 }];

    for (const layer of layers) {
      const points: Projected[] = [];
      for (let step = 0; step < segments; step += 1) {
        const angle = step / segments * Math.PI * 2;
        const world = add(
          hit.point,
          add(
            scale(footprint.major, Math.cos(angle) * radius * layer.factor * footprint.stretch),
            scale(footprint.minor, Math.sin(angle) * radius * layer.factor)
          )
        );
        points.push(projectVisualizerPoint(world, camera, width, height));
      }
      if (points.some((point) => point.depth <= .02)) continue;
      polygon(ctx, points);
      ctx.fillStyle = rgba(color, layer.alpha * intensity * (.65 + haze * .8));
      ctx.fill();
    }

    if (quality === 'high') {
      const hotRadius = Math.max(.03, radius * .13);
      const edge = projectVisualizerPoint(add(hit.point, scale(footprint.minor, hotRadius)), camera, width, height);
      const screenRadius = clamp(Math.hypot(edge.x - center.x, edge.y - center.y), 1.5, 42);
      const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, screenRadius);
      glow.addColorStop(0, rgba(color, .32 * intensity));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
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
  const fallbackLength = Math.max(snapshot.dimensions.roomDepth, snapshot.dimensions.depth * 2.1);
  const sliceCount = quality === 'high' ? 5 : quality === 'quality' ? 3 : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  snapshot.patch.forEach((fixture, index) => {
    const intensity = fixtureIntensity(snapshot, fixture);
    if (intensity <= .01) return;

    const geometry = fixtureGeometryState(
      snapshot.output,
      fixture,
      index,
      snapshot.patch.length,
      snapshot.dimensions
    );
    const hit = intersectBeamWithStage(geometry.beam, snapshot.dimensions);
    const length = hit?.distance ?? fallbackLength;
    const endpoint = pointAlongRay(geometry.beam, length);
    const radius = Math.max(.03, Math.tan(radians(geometry.beam.angleDegrees / 2)) * length);
    const basis = beamBasis(geometry.beam.direction);
    const startCenter = projectVisualizerPoint(geometry.beam.origin, camera, width, height);
    const endCenter = projectVisualizerPoint(endpoint, camera, width, height);
    if (startCenter.depth <= .02 || endCenter.depth <= .02) return;

    const color = fixtureColor(snapshot, fixture);
    const baseAlpha = clamp(
      (quality === 'high' ? .22 : quality === 'quality' ? .19 : .16)
        * intensity
        * (.42 + haze * 1.1),
      .025,
      .52
    );

    // Always draw one camera-facing cone silhouette. Fixed radial slices can
    // collapse to almost zero screen width at grazing camera angles; this
    // slice keeps the volumetric beam readable while still using true 3D
    // beam origin/direction/radius.
    const facingRadial = cameraFacingBeamRadial(geometry.beam.direction, camera);
    const facingSourceRadius = Math.min(.045, radius * .04);
    const silhouette = [
      projectVisualizerPoint(add(geometry.beam.origin, scale(facingRadial, -facingSourceRadius)), camera, width, height),
      projectVisualizerPoint(add(geometry.beam.origin, scale(facingRadial, facingSourceRadius)), camera, width, height),
      projectVisualizerPoint(add(endpoint, scale(facingRadial, radius)), camera, width, height),
      projectVisualizerPoint(add(endpoint, scale(facingRadial, -radius)), camera, width, height),
    ];
    if (silhouette.every((point) => point.depth > .02)) {
      const silhouetteGradient = ctx.createLinearGradient(startCenter.x, startCenter.y, endCenter.x, endCenter.y);
      silhouetteGradient.addColorStop(0, rgba(color, baseAlpha * .78));
      silhouetteGradient.addColorStop(.28, rgba(color, baseAlpha * .64));
      silhouetteGradient.addColorStop(.75, rgba(color, baseAlpha * .34));
      silhouetteGradient.addColorStop(1, rgba(color, baseAlpha * .06));
      polygon(ctx, silhouette);
      ctx.fillStyle = silhouetteGradient;
      ctx.fill();
    }

    for (let slice = 0; slice < sliceCount; slice += 1) {
      const angle = sliceCount === 1 ? 0 : slice / sliceCount * Math.PI;
      const radial = radialDirection(basis.side, basis.up, angle);
      const sourceRadius = Math.min(.045, radius * .04);
      const startLeft = projectVisualizerPoint(
        add(geometry.beam.origin, scale(radial, -sourceRadius)),
        camera, width, height
      );
      const startRight = projectVisualizerPoint(
        add(geometry.beam.origin, scale(radial, sourceRadius)),
        camera, width, height
      );
      const endLeft = projectVisualizerPoint(add(endpoint, scale(radial, -radius)), camera, width, height);
      const endRight = projectVisualizerPoint(add(endpoint, scale(radial, radius)), camera, width, height);
      if ([startLeft,startRight,endLeft,endRight].some((point) => point.depth <= .02)) continue;

      const gradient = ctx.createLinearGradient(
        startCenter.x, startCenter.y, endCenter.x, endCenter.y
      );
      const sliceAlpha = baseAlpha / Math.max(1, sliceCount * .72);
      gradient.addColorStop(0, rgba(color, sliceAlpha * 1.2));
      gradient.addColorStop(.3, rgba(color, sliceAlpha));
      gradient.addColorStop(.76, rgba(color, sliceAlpha * .54));
      gradient.addColorStop(1, rgba(color, sliceAlpha * .08));

      polygon(ctx, [startLeft, startRight, endRight, endLeft]);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    if (quality !== 'fast') {
      const haloRadius = Math.max(.04, radius * .62);
      const haloLeft = projectVisualizerPoint(add(endpoint, scale(basis.side, -haloRadius)), camera, width, height);
      const haloRight = projectVisualizerPoint(add(endpoint, scale(basis.side, haloRadius)), camera, width, height);
      const haloSize = clamp(Math.hypot(haloRight.x - haloLeft.x, haloRight.y - haloLeft.y) / 2, 1, 70);
      const halo = ctx.createRadialGradient(endCenter.x, endCenter.y, 0, endCenter.x, endCenter.y, haloSize);
      halo.addColorStop(0, rgba(color, baseAlpha * .65));
      halo.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(endCenter.x, endCenter.y, haloSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rgba(color, Math.min(.76, baseAlpha * 1.5));
      ctx.lineWidth = Math.max(.8, intensity * (quality === 'high' ? 1.6 : 1.2));
      ctx.beginPath();
      ctx.moveTo(startCenter.x, startCenter.y);
      ctx.lineTo(endCenter.x, endCenter.y);
      ctx.stroke();
    }
  });

  ctx.restore();
}
const crowdLayoutCache = new Map<string, Array<Vec3 & { seed: number }>>();

function crowdPoints(stage: StageDimensions, quality: VisualizerQuality) {
  const cacheKey = [
    quality,
    stage.width.toFixed(3), stage.depth.toFixed(3),
    stage.roomWidth.toFixed(3), stage.roomDepth.toFixed(3)
  ].join(':');
  const cached = crowdLayoutCache.get(cacheKey);
  if (cached) return cached;

  const points: Array<Vec3 & { seed: number }> = [];
  const half = Math.min(stage.roomWidth / 2 - .8, Math.max(stage.width / 2, 4));
  const start = stage.depth + 1.2;
  const end = Math.max(start + 1, stage.roomDepth - 1.2);
  const xStep = quality === 'high' ? .72 : quality === 'quality' ? .82 : 1.12;
  const zStep = quality === 'high' ? .82 : quality === 'quality' ? .94 : 1.25;
  const limit = quality === 'high' ? 420 : quality === 'quality' ? 310 : 175;
  let row = 0;
  outer: for (let z = start; z <= end; z += zStep) {
    const offset = row % 2 ? xStep * .45 : 0;
    let column = 0;
    for (let x = -half + offset; x <= half; x += xStep) {
      points.push({ x, y: 0, z, seed: ((row * 37 + column * 17) % 101) / 100 });
      if (points.length >= limit) break outer;
      column += 1;
    }
    row += 1;
  }
  crowdLayoutCache.set(cacheKey, points);
  if (crowdLayoutCache.size > 24) {
    const oldest = crowdLayoutCache.keys().next().value;
    if (oldest) crowdLayoutCache.delete(oldest);
  }
  return points;
}

function crowdTone(seed: number, alpha: number) {
  const value = Math.round(118 + seed * 38);
  return `rgba(${value},${value + 7},${value + 12},${alpha})`;
}

function drawCrowdPerson(
  ctx: CanvasRenderingContext2D,
  camera: VisualizerCamera,
  width: number,
  height: number,
  point: Vec3 & { seed: number },
  quality: VisualizerQuality,
  detailed: boolean
) {
  const stature = 1.52 + point.seed * .26;
  const shoulderWidth = .17 + point.seed * .04;
  const hipWidth = shoulderWidth * .68;
  const torsoTop = stature * .76;
  const torsoBottom = stature * .42;
  const depth = .10 + point.seed * .025;

  const headWorld = { x: point.x, y: stature * .9, z: point.z };
  const head = projectVisualizerPoint(headWorld, camera, width, height);
  const foot = projectVisualizerPoint(point, camera, width, height);
  if (head.depth <= .04 || foot.depth <= .04) return;

  const apparent = clamp(205 / head.depth, 1.7, quality === 'high' ? 8.5 : 6.8);
  if (!detailed || quality === 'fast' || apparent < 3.1) {
    ctx.strokeStyle = crowdTone(point.seed, .28);
    ctx.fillStyle = crowdTone(point.seed, .38);
    ctx.lineWidth = Math.max(.75, apparent * .2);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + apparent * .62);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, apparent * .38, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const yaw = (point.seed - .5) * .26;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const local = (x: number, y: number, z: number): Vec3 => ({
    x: point.x + x * cosine + z * sine,
    y,
    z: point.z - x * sine + z * cosine,
  });

  const torsoWorld = [
    local(-shoulderWidth, torsoTop, -depth),
    local(shoulderWidth, torsoTop, -depth),
    local(hipWidth, torsoBottom, -depth),
    local(-hipWidth, torsoBottom, -depth),
    local(-shoulderWidth, torsoTop, depth),
    local(shoulderWidth, torsoTop, depth),
    local(hipWidth, torsoBottom, depth),
    local(-hipWidth, torsoBottom, depth),
  ];
  const torso = torsoWorld.map(vertex => projectVisualizerPoint(vertex, camera, width, height));
  const faceSets = [[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2]] as const;

  faceSets.forEach((indices, faceIndex) => {
    const points = indices.map(index => torso[index]);
    if (points.some(vertex => vertex.depth <= .04)) return;
    polygon(ctx, points);
    ctx.fillStyle = crowdTone(point.seed, faceIndex === 1 ? .34 : .24);
    ctx.fill();
  });

  const leftFoot = projectVisualizerPoint(local(-hipWidth * .58, 0, 0), camera, width, height);
  const rightFoot = projectVisualizerPoint(local(hipWidth * .58, 0, 0), camera, width, height);
  const leftHip = projectVisualizerPoint(local(-hipWidth * .52, torsoBottom, 0), camera, width, height);
  const rightHip = projectVisualizerPoint(local(hipWidth * .52, torsoBottom, 0), camera, width, height);
  ctx.strokeStyle = crowdTone(point.seed, .34);
  ctx.lineWidth = Math.max(.7, apparent * .16);
  ctx.beginPath();
  ctx.moveTo(leftHip.x, leftHip.y); ctx.lineTo(leftFoot.x, leftFoot.y);
  ctx.moveTo(rightHip.x, rightHip.y); ctx.lineTo(rightFoot.x, rightFoot.y);
  ctx.stroke();

  const headRadiusWorld = .105 + point.seed * .015;
  const headEdge = projectVisualizerPoint(local(headRadiusWorld, stature * .9, 0), camera, width, height);
  const headRadius = clamp(Math.hypot(headEdge.x - head.x, headEdge.y - head.y), 1.4, 7);
  ctx.beginPath();
  ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = crowdTone(point.seed, .42);
  ctx.fill();
  if (quality === 'high') {
    ctx.strokeStyle = crowdTone(point.seed, .2);
    ctx.lineWidth = .7;
    ctx.stroke();
  }
}

function drawCrowd(
  ctx: CanvasRenderingContext2D,
  camera: VisualizerCamera,
  stage: StageDimensions,
  width: number,
  height: number,
  quality: VisualizerQuality
) {
  const people = crowdPoints(stage, quality)
    .map(point => ({
      point,
      projected: projectVisualizerPoint({ x: point.x, y: 1.55, z: point.z }, camera, width, height)
    }))
    .filter(item => item.projected.depth > .05)
    .sort((a, b) => b.projected.depth - a.projected.depth);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const detailDepth = quality === 'high' ? 18 : quality === 'quality' ? 12 : 0;
  for (const item of people) {
    drawCrowdPerson(ctx, camera, width, height, item.point, quality, item.projected.depth <= detailDepth);
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

function mediaEntryReady(entry: MediaEntry | undefined) {
  if (!entry || entry.visible === false) return false;
  if (entry.source instanceof HTMLVideoElement) {
    return entry.source.readyState >= 2 && entry.source.videoWidth > 0;
  }
  return entry.source.complete && entry.source.naturalWidth > 0;
}

function drawScreenTestPattern(
  ctx: CanvasRenderingContext2D,
  points: readonly Projected[],
  pattern: 'bars' | 'grid' | 'checker'
) {
  const minX=Math.min(...points.map(point=>point.x));
  const maxX=Math.max(...points.map(point=>point.x));
  const minY=Math.min(...points.map(point=>point.y));
  const maxY=Math.max(...points.map(point=>point.y));
  const width=Math.max(1,maxX-minX),height=Math.max(1,maxY-minY);
  ctx.save();
  polygon(ctx,points);
  ctx.clip();

  if(pattern==='bars'){
    const colors=['#d8d8d8','#d8d84a','#49d8d8','#49d849','#d849d8','#d84949','#4949d8'];
    colors.forEach((color,index)=>{
      ctx.fillStyle=color;
      ctx.fillRect(minX+width*index/colors.length,minY,width/colors.length+1,height);
    });
  }else if(pattern==='checker'){
    const cells=8;
    const size=Math.max(4,width/cells);
    for(let y=minY,row=0;y<maxY;y+=size,row++){
      for(let x=minX,col=0;x<maxX;x+=size,col++){
        ctx.fillStyle=(row+col)%2===0?'#e8edf0':'#11161a';
        ctx.fillRect(x,y,size+1,size+1);
      }
    }
  }else{
    ctx.fillStyle='#101820';
    ctx.fillRect(minX,minY,width,height);
    ctx.strokeStyle='rgba(110,231,255,.75)';
    ctx.lineWidth=1;
    const step=Math.max(10,Math.min(width,height)/8);
    for(let x=minX;x<=maxX;x+=step){ctx.beginPath();ctx.moveTo(x,minY);ctx.lineTo(x,maxY);ctx.stroke();}
    for(let y=minY;y<=maxY;y+=step){ctx.beginPath();ctx.moveTo(minX,y);ctx.lineTo(maxX,y);ctx.stroke();}
    ctx.strokeStyle='rgba(255,255,255,.65)';
    ctx.beginPath();ctx.moveTo((minX+maxX)/2,minY);ctx.lineTo((minX+maxX)/2,maxY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(minX,(minY+maxY)/2);ctx.lineTo(maxX,(minY+maxY)/2);ctx.stroke();
  }
  ctx.restore();
}

function drawFaces(
  ctx: CanvasRenderingContext2D,
  faces: Face[],
  media: Map<string, MediaEntry>,
  quality: VisualizerQuality,
  selectedElementId?: string,
  showLabels = true
) {
  for (const face of faces.sort((a, b) => b.depth - a.depth)) {
    polygon(ctx, face.points);
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.strokeStyle = face.elementId === selectedElementId ? '#64e18e' : face.stroke;
    ctx.lineWidth = face.elementId === selectedElementId ? 2.2 : 1;
    ctx.stroke();

    if (face.screenElement) {
      const screenSource=face.screenElement.mediaSource;
      const entry = media.get(face.screenElement.id);
      if (screenSource?.kind==='color') {
        polygon(ctx,face.points);
        ctx.fillStyle=screenSource.color;
        ctx.fill();
      } else if (screenSource?.kind==='test-pattern') {
        drawScreenTestPattern(ctx,face.points,screenSource.pattern);
      } else if (mediaEntryReady(entry)) {
        const framed=framedScreenQuad(entry!.source,face.screenElement,face.points);
        ctx.save();
        polygon(ctx, face.points);
        ctx.clip();
        drawImageQuad(ctx, entry!.source, framed);
        ctx.restore();
        polygon(ctx, face.points);
        ctx.strokeStyle = 'rgba(228,239,244,.58)';
        ctx.stroke();
      } else {
        polygon(ctx, face.points);
        const glow = quality !== 'fast' ? .32 : .18;
        ctx.fillStyle = screenSource?.kind==='timeline' || screenSource?.kind==='image' ? '#000' : `rgba(210,230,240,${glow})`;
        ctx.fill();
      }
    }

    if (face.label && showLabels) {
      const centerX = face.points.reduce((sum, point) => sum + point.x, 0) / face.points.length;
      const centerY = face.points.reduce((sum, point) => sum + point.y, 0) / face.points.length;
      ctx.fillStyle = 'rgba(224,234,239,.76)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(face.label, centerX, centerY);
    }
  }
}


function worldFromElementLocal(element: StageElement, stage: StageDimensions, local: Vec3): Vec3 {
  const position = stageElementPosition(element, stage);
  const rotation = element.transform?.rotation ?? { yaw: 0, pitch: 0, roll: 0 };
  return add(position, rotateLocal(local, rotation));
}

function drawWorldLine(
  ctx: CanvasRenderingContext2D,
  camera: VisualizerCamera,
  width: number,
  height: number,
  a: Vec3,
  b: Vec3,
  stroke: string,
  lineWidth = 1.2
) {
  const start = projectVisualizerPoint(a, camera, width, height);
  const end = projectVisualizerPoint(b, camera, width, height);
  if (start.depth <= .02 || end.depth <= .02) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function drawWorldCircle(
  ctx: CanvasRenderingContext2D,
  camera: VisualizerCamera,
  width: number,
  height: number,
  center: Vec3,
  radiusMeters: number,
  fill: string,
  stroke?: string
) {
  const projected = projectVisualizerPoint(center, camera, width, height);
  const edge = projectVisualizerPoint({ ...center, x: center.x + radiusMeters }, camera, width, height);
  if (projected.depth <= .02 || edge.depth <= .02) return;
  const radius = clamp(Math.hypot(edge.x - projected.x, edge.y - projected.y), 1.8, 34);
  ctx.beginPath();
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawAssetDetails(
  ctx: CanvasRenderingContext2D,
  elements: readonly StageElement[],
  stage: StageDimensions,
  camera: VisualizerCamera,
  width: number,
  height: number,
  selectedElementId?: string,
  quality: VisualizerQuality = 'quality'
) {
  const ordered = elements
    .map((element) => ({ element, depth: projectVisualizerPoint(stageElementPosition(element, stage), camera, width, height).depth }))
    .filter((item) => item.depth > .02)
    .sort((a, b) => b.depth - a.depth);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const { element } of ordered) {
    const dims = element.dimensions ?? { x: 1, y: 1, z: 1 };
    const h = Math.max(.15, dims.y);
    const w = Math.max(.12, dims.x);
    const d = Math.max(.08, dims.z);
    const selected = element.id === selectedElementId;
    const stroke = selected ? '#64e18e' : shade(element.color, 1.18, .92);
    const soft = selected ? 'rgba(100,225,142,.28)' : shade(element.color, .9, .52);

    if (element.type === 'person' && element.assetKind !== 'chair' && element.assetKind !== 'plant') {
      const head = worldFromElementLocal(element, stage, { x: 0, y: h * .37, z: 0 });
      const neck = worldFromElementLocal(element, stage, { x: 0, y: h * .24, z: 0 });
      const hips = worldFromElementLocal(element, stage, { x: 0, y: -h * .12, z: 0 });
      const leftHand = worldFromElementLocal(element, stage, { x: -w * .48, y: h * .08, z: 0 });
      const rightHand = worldFromElementLocal(element, stage, { x: w * .48, y: h * .08, z: 0 });
      const leftFoot = worldFromElementLocal(element, stage, { x: -w * .2, y: -h * .5, z: 0 });
      const rightFoot = worldFromElementLocal(element, stage, { x: w * .2, y: -h * .5, z: 0 });
      drawWorldCircle(ctx, camera, width, height, head, Math.max(.09, w * .18), shade(element.color, 1.08, .95), stroke);
      drawWorldLine(ctx, camera, width, height, neck, hips, stroke, selected ? 2.4 : 1.8);
      drawWorldLine(ctx, camera, width, height, neck, leftHand, stroke, 1.5);
      drawWorldLine(ctx, camera, width, height, neck, rightHand, stroke, 1.5);
      drawWorldLine(ctx, camera, width, height, hips, leftFoot, stroke, 1.6);
      drawWorldLine(ctx, camera, width, height, hips, rightFoot, stroke, 1.6);
      continue;
    }

    if (element.assetKind === 'chair') {
      const seatY = -h * .05;
      const backY = h * .45;
      const left = -w * .42;
      const right = w * .42;
      const front = d * .34;
      const back = -d * .34;
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:left,y:seatY,z:front}), worldFromElementLocal(element, stage, {x:right,y:seatY,z:front}), stroke, 1.5);
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:left,y:seatY,z:back}), worldFromElementLocal(element, stage, {x:right,y:seatY,z:back}), stroke, 1.5);
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:left,y:seatY,z:back}), worldFromElementLocal(element, stage, {x:left,y:backY,z:back}), stroke, 1.4);
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:right,y:seatY,z:back}), worldFromElementLocal(element, stage, {x:right,y:backY,z:back}), stroke, 1.4);
      for (const x of [left,right]) for (const z of [front,back]) {
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x,y:seatY,z}), worldFromElementLocal(element, stage, {x,y:-h*.5,z}), soft, 1);
      }
      continue;
    }

    if (element.assetKind === 'plant') {
      const base = worldFromElementLocal(element, stage, {x:0,y:-h*.36,z:0});
      const stem = worldFromElementLocal(element, stage, {x:0,y:h*.08,z:0});
      drawWorldLine(ctx, camera, width, height, base, stem, stroke, 2);
      const leafColor = selected ? 'rgba(100,225,142,.72)' : 'rgba(89,132,86,.8)';
      for (const [x,y,z,r] of [
        [-.24,.18,0,.22],[.22,.24,.05,.24],[0,.38,-.03,.28],[-.12,.34,.08,.22],[.14,.12,-.05,.2]
      ] as const) {
        drawWorldCircle(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:x*w,y:y*h,z:z*d}), Math.max(.08,r*w), leafColor, selected ? stroke : undefined);
      }
      continue;
    }

    if (element.assetKind === 'lighting-stand' || element.assetKind === 'camera') {
      const bottom = worldFromElementLocal(element, stage, {x:0,y:-h*.5,z:0});
      const top = worldFromElementLocal(element, stage, {x:0,y:h*.5,z:0});
      drawWorldLine(ctx, camera, width, height, bottom, top, stroke, 1.8);
      for (const x of [-w*.34,w*.34]) {
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:0,y:-h*.35,z:0}), worldFromElementLocal(element, stage, {x,y:-h*.5,z:d*.28}), soft, 1.2);
      }
      if (element.assetKind === 'camera') {
        const body = worldFromElementLocal(element, stage, {x:0,y:h*.48,z:0});
        const lens = worldFromElementLocal(element, stage, {x:0,y:h*.48,z:-d*.36});
        drawWorldCircle(ctx, camera, width, height, body, Math.max(.08,w*.18), '#252c33', stroke);
        drawWorldLine(ctx, camera, width, height, body, lens, stroke, 3);
      } else {
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:-w*.35,y:h*.46,z:0}), worldFromElementLocal(element, stage, {x:w*.35,y:h*.46,z:0}), stroke, 2.2);
      }
      continue;
    }

    if (element.type === 'drums' || element.assetKind === 'drum-shield') {
      drawWorldCircle(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:0,y:-h*.14,z:d*.08}), Math.max(.16,w*.2), '#161b20', stroke);
      drawWorldCircle(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:-w*.22,y:h*.08,z:0}), Math.max(.1,w*.12), '#20272d', stroke);
      drawWorldCircle(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:w*.22,y:h*.12,z:0}), Math.max(.1,w*.12), '#20272d', stroke);
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:-w*.4,y:h*.28,z:0}), worldFromElementLocal(element, stage, {x:-w*.06,y:h*.28,z:0}), '#c5a95d', 1.4);
      drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:w*.08,y:h*.34,z:0}), worldFromElementLocal(element, stage, {x:w*.42,y:h*.34,z:0}), '#c5a95d', 1.4);
      if (element.assetKind === 'drum-shield' && quality !== 'fast') {
        for (const x of [-w*.48,-w*.16,w*.16,w*.48]) {
          drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x,y:-h*.45,z:-d*.48}), worldFromElementLocal(element, stage, {x,y:h*.48,z:-d*.48}), 'rgba(190,215,225,.42)', 1);
        }
      }
      continue;
    }

    if (element.assetKind === 'truss') {
      const corners = elementCorners(element, stage);
      const pairs = [[0,2],[1,3],[4,6],[5,7],[0,5],[1,4],[3,6],[2,7]] as const;
      for (const [a,b] of pairs) drawWorldLine(ctx, camera, width, height, corners[a], corners[b], stroke, .9);
      continue;
    }

    if (element.assetKind === 'speaker' || element.assetKind === 'subwoofer' || element.assetKind === 'monitor') {
      const front = worldFromElementLocal(element, stage, {x:0,y:0,z:-d*.51});
      const upper = worldFromElementLocal(element, stage, {x:0,y:h*.2,z:-d*.52});
      const lower = worldFromElementLocal(element, stage, {x:0,y:-h*.2,z:-d*.52});
      drawWorldCircle(ctx, camera, width, height, upper, Math.max(.06,Math.min(w,h)*.22), '#0b0e11', stroke);
      drawWorldCircle(ctx, camera, width, height, lower, Math.max(.07,Math.min(w,h)*.27), '#0b0e11', soft);
      if (element.assetKind === 'monitor') drawWorldLine(ctx, camera, width, height, front, worldFromElementLocal(element, stage, {x:0,y:-h*.35,z:d*.25}), soft, 1);
      continue;
    }

    if (element.assetKind === 'keyboard' || element.assetKind === 'piano') {
      const y = h * .18;
      const z = -d * .46;
      const keyCount = quality !== 'fast' ? 9 : 5;
      for (let index = 0; index <= keyCount; index += 1) {
        const x = -w*.44 + (w*.88)*(index/keyCount);
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x,y,z}), worldFromElementLocal(element, stage, {x,y,z:d*.18}), 'rgba(225,230,234,.55)', .7);
      }
      continue;
    }

    if (element.assetKind === 'pulpit' || element.assetKind === 'projector') {
      const center = worldFromElementLocal(element, stage, {x:0,y:0,z:-d*.52});
      if (element.assetKind === 'projector') drawWorldCircle(ctx, camera, width, height, center, Math.max(.05,Math.min(w,h)*.15), '#101419', stroke);
      else {
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:-w*.35,y:h*.35,z:-d*.52}), worldFromElementLocal(element, stage, {x:w*.35,y:-h*.35,z:-d*.52}), stroke, 1);
        drawWorldLine(ctx, camera, width, height, worldFromElementLocal(element, stage, {x:w*.35,y:h*.35,z:-d*.52}), worldFromElementLocal(element, stage, {x:-w*.35,y:-h*.35,z:-d*.52}), stroke, 1);
      }
    }
  }
  ctx.restore();
}

function cameraLabel(selection: CameraSelection) {
  if (selection === 'foh') return 'Perspective';
  if (selection === 'front') return 'Front';
  if (selection === 'side') return 'Side';
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
  const [orthographicZoom, setOrthographicZoom] = useState(1);
  const [haze, setHaze] = useState(.68);
  const [showCrowd, setShowCrowd] = useState(false);
  const [showLabels, setShowLabels] = useState(()=>localStorage.getItem('lumarig.visualizer.labels.v1')!=='off');
  const [quality, setQuality] = useState<VisualizerQuality>('quality');
  const [playingFlyby, setPlayingFlyby] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  useEffect(()=>{const sync=()=>setShowLabels(localStorage.getItem('lumarig.visualizer.labels.v1')!=='off');window.addEventListener('lumarig-labels-changed',sync);return()=>window.removeEventListener('lumarig-labels-changed',sync);},[]);
  const selectedElement = snapshot.elements.find((element) => element.id === selectedElementId);

  const target = useMemo(() => ({
    x: 0,
    y: snapshot.dimensions.height * .28,
    z: snapshot.dimensions.depth * .45
  }), [snapshot.dimensions.height, snapshot.dimensions.depth]);

  function selectCamera(preset: VisualizerCameraPreset) {
    const camera = visualizerCameraPreset(preset, snapshot.dimensions);
    setCameraSelection(preset);
    setOrthographicZoom(1);
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
      if (element.type !== 'led-screen' || !source) continue;
      if (source.kind === 'timeline') desired.set(element.id, 'timeline');
      if (source.kind === 'ndi' && source.deviceId) desired.set(element.id, 'ndi:' + source.deviceId);
      if (source.kind === 'image' && source.mediaId) desired.set(element.id, 'image:' + source.mediaId);
    }

    for (const [id, entry] of mediaRef.current) {
      if (desired.get(id) === entry.deviceId) continue;
      entry.dispose?.();
      entry.stream?.getTracks().forEach(track => track.stop());
      if (entry.source instanceof HTMLVideoElement) entry.source.srcObject = null;
      mediaRef.current.delete(id);
    }

    let cancelled=false;

    for (const [id, sourceKey] of desired) {
      if (mediaRef.current.has(id)) continue;
      if (sourceKey === 'timeline') {
        const video=document.createElement('video');
        const entry:MediaEntry={deviceId:sourceKey,source:video,visible:false};
        entry.dispose=followTimelineVideo(video,visible=>{entry.visible=visible;});
        mediaRef.current.set(id,entry);
        setMediaRevision(value=>value+1);
        continue;
      }
      if (sourceKey.startsWith('image:')) {
        const mediaId=sourceKey.slice('image:'.length);
        void readNativeMediaBlob(mediaId).then(blob=>{
          if(cancelled || !blob)return;
          const url=URL.createObjectURL(blob);
          const image=new Image();
          image.onload=()=>{
            if(cancelled){URL.revokeObjectURL(url);return;}
            mediaRef.current.set(id,{
              deviceId:sourceKey,
              source:image,
              dispose:()=>URL.revokeObjectURL(url)
            });
            setMediaRevision(value=>value+1);
          };
          image.onerror=()=>{URL.revokeObjectURL(url);setMediaRevision(value=>value+1);};
          image.src=url;
        }).catch(()=>setMediaRevision(value=>value+1));
        continue;
      }
      if(!sourceKey.startsWith('ndi:') || !navigator.mediaDevices?.getUserMedia)continue;
      const deviceId=sourceKey.slice('ndi:'.length);
      void navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      }).then(async stream => {
        if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
        const video=document.createElement('video');
        video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=stream;
        try{await video.play();}catch{}
        if(cancelled){stream.getTracks().forEach(track=>track.stop());video.srcObject=null;return;}
        mediaRef.current.set(id,{deviceId:sourceKey,source:video,stream});
        setMediaRevision(value=>value+1);
      }).catch(()=>setMediaRevision(value=>value+1));
    }

    return () => { cancelled=true; };
  }, [snapshot.elements]);
  useEffect(() => () => {
    for (const entry of mediaRef.current.values()) {
      entry.dispose?.();
      entry.stream?.getTracks().forEach((track) => track.stop());
      if (entry.source instanceof HTMLVideoElement) entry.source.srcObject = null;
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
      const targetFps = quality === 'high' ? 60 : quality === 'quality' ? 30 : 24;
      if (now - lastDraw >= 1000 / targetFps) {
        lastDraw = now;
        const bounds = host.getBoundingClientRect();
        const cssWidth = Math.max(320, Math.floor(bounds.width));
        const cssHeight = Math.max(compact ? 260 : 380, Math.floor(bounds.height));
        const dpr = quality === 'high' ? Math.min(3, Math.max(2.5, window.devicePixelRatio || 1)) : Math.min(window.devicePixelRatio || 1, quality === 'quality' ? 2 : 1.35);
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
        if (cameraSelection === 'top' || cameraSelection === 'front' || cameraSelection === 'side') {
          camera = visualizerCameraPreset(cameraSelection, snapshot.dimensions);
          camera.orthographicSize = (camera.orthographicSize ?? 10) * orthographicZoom;
        }
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
        drawLightSpill(context, snapshot, camera, cssWidth, cssHeight, haze, quality);
        drawBeams(context, snapshot, camera, cssWidth, cssHeight, haze, quality);

        const faces = snapshot.elements.flatMap((element) => objectFaces(element, snapshot.dimensions, camera, cssWidth, cssHeight));
        drawFaces(context, faces, mediaRef.current, quality, selectedElementId ?? undefined, showLabels);
        drawAssetDetails(context, snapshot.elements, snapshot.dimensions, camera, cssWidth, cssHeight, selectedElementId ?? undefined, quality);
        drawFixtureBodies(context, snapshot, camera, cssWidth, cssHeight);
        if (showCrowd) drawCrowd(context, camera, snapshot.dimensions, cssWidth, cssHeight, quality);

        const vignette = context.createRadialGradient(cssWidth / 2, cssHeight / 2, Math.min(cssWidth, cssHeight) * .2, cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * .72);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, quality !== 'fast' ? 'rgba(0,0,0,.38)' : 'rgba(0,0,0,.24)');
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
  }, [snapshot, orbit, haze, showCrowd, quality, compact, playingFlyby, cameraSelection, orthographicZoom, target, mediaRevision, selectedElementId, showLabels]);

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
    if (cameraSelection === 'top' || cameraSelection === 'front' || cameraSelection === 'side') {
      setOrthographicZoom(current => clamp(current * (event.deltaY > 0 ? 1.08 : .92), .2, 4));
      return;
    }
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

  return <section ref={hostRef} data-projection={cameraSelection === "top" || cameraSelection === "front" || cameraSelection === "side" ? "orthographic" : "perspective"} data-camera={cameraSelection} className={`visualizer-3d ${compact ? 'compact' : ''} ${className}`}>
    <div className="visualizer-3d-toolbar">
      <div className="visualizer-camera-bank" role="group" aria-label="Visualizer cameras">
        {(['foh', 'top', 'front', 'side', 'stage-left', 'stage-right', 'close'] as VisualizerCameraPreset[]).map((preset) =>
          <button key={preset} className={cameraSelection === preset ? 'active' : ''} onClick={() => selectCamera(preset)}>{cameraLabel(preset)}</button>
        )}
      </div>
      <div className="visualizer-playback-tools">
        <button onClick={() => selectCamera('foh')}>Reset View</button>
        <button className={playingFlyby ? 'active' : ''} onClick={toggleFlyby}>{playingFlyby ? 'Stop Flyby' : '▶ Flyby'}</button>
        <button onClick={() => setShowCrowd((value) => !value)} aria-pressed={showCrowd}>Crowd {showCrowd ? 'On' : 'Off'}</button>
        <button aria-pressed={showLabels} onClick={()=>{const next=!showLabels;setShowLabels(next);localStorage.setItem('lumarig.visualizer.labels.v1',next?'on':'off');window.dispatchEvent(new Event('lumarig-labels-changed'));}}>Labels {showLabels?'On':'Off'}</button>
        <button onClick={() => setQuality(value=>value==='fast'?'quality':value==='quality'?'high':'fast')}>Render {quality==='high'?'High':quality==='quality'?'Quality':'Fast'}</button>
      </div>
      {!compact && <label className="visualizer-haze"><span>Haze {Math.round(haze * 100)}%</span><input type="range" min="0" max="1" step=".02" value={haze} onChange={(event) => setHaze(Number(event.target.value))}/></label>}
    </div>
    <div className="visualizer-fixture-state-list" aria-hidden="true" hidden>
      {snapshot.patch.map((fixture) => <span
        key={fixture.id}
        data-fixture={fixture.id}
        data-level={fixtureIntensity(snapshot, fixture)}
        data-color={fixtureColor(snapshot, fixture)}
      />)}
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
      onDoubleClick={() => selectCamera('foh')}
    />
    {!compact && <div className="visualizer-3d-help"><span>Drag to orbit · scroll to zoom · double-click to reset</span><strong>{selectedElement ? `Selected · ${selectedElement.label}` : cameraLabel(cameraSelection)}</strong></div>}
  </section>;
}
