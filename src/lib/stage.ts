import { DEFAULT_STAGE_DIMENSIONS, type EulerDegrees, type StageDimensions, type Vec3 } from '../core/geometry';

export type StageElementType = 'back-wall' | 'drums' | 'person' | 'led-screen' | 'riser';

export type StageElement = {
  id: string;
  type: StageElementType;
  label: string;
  x: number;
  y: number;
  depth: number;
  size: number;
  color: string;
  transform?: { position: Vec3; rotation: EulerDegrees };
  dimensions?: Vec3;
};

export type StageDocument = {
  schemaVersion: 2;
  elements: StageElement[];
};

export const STAGE_ELEMENT_LIBRARY: ReadonlyArray<{
  type: StageElementType;
  name: string;
  defaultColor: string;
  defaultSize: number;
}> = [
  { type: 'back-wall', name: 'Back wall', defaultColor: '#313844', defaultSize: 90 },
  { type: 'drums', name: 'Drum kit', defaultColor: '#9aa4b2', defaultSize: 36 },
  { type: 'person', name: 'Performer', defaultColor: '#d6dde5', defaultSize: 22 },
  { type: 'led-screen', name: 'LED screen', defaultColor: '#8158ff', defaultSize: 54 },
  { type: 'riser', name: 'Riser', defaultColor: '#56606d', defaultSize: 48 }
];

export function makeStageElement(type: StageElementType, index: number, stageDimensions: StageDimensions = DEFAULT_STAGE_DIMENSIONS): StageElement {
  const definition = STAGE_ELEMENT_LIBRARY.find((item) => item.type === type) ?? STAGE_ELEMENT_LIBRARY[0];
  const defaultPosition: Record<StageElementType, { x: number; y: number; depth: number }> = {
    'back-wall': { x: 50, y: 42, depth: 5 },
    drums: { x: 50, y: 72, depth: 58 },
    person: { x: 34, y: 70, depth: 64 },
    'led-screen': { x: 72, y: 35, depth: 18 },
    riser: { x: 52, y: 82, depth: 48 }
  };
  const position = defaultPosition[type];
  return migrateStageElement({
    id: `stage-${type}-${Date.now().toString(36)}-${index}`,
    type,
    label: `${definition.name} ${index + 1}`,
    x: Math.min(92, position.x + index * 5),
    y: position.y,
    depth: position.depth,
    size: definition.defaultSize,
    color: definition.defaultColor
  }, stageDimensions);
}

export function clampStageElement(element: StageElement): StageElement {
  return {
    ...element,
    label: element.label.trim().slice(0, 48) || 'Stage element',
    x: Math.max(2, Math.min(98, element.x)),
    y: Math.max(5, Math.min(92, element.y)),
    depth: Math.max(0, Math.min(100, element.depth)),
    size: Math.max(10, Math.min(100, element.size)),
    color: /^#[0-9a-f]{6}$/i.test(element.color) ? element.color : '#7d8793'
  };
}

export function isStageElement(value: unknown): value is StageElement {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StageElement>;
  return typeof item.id === 'string'
    && ['back-wall', 'drums', 'person', 'led-screen', 'riser'].includes(item.type ?? '')
    && typeof item.label === 'string'
    && typeof item.x === 'number'
    && typeof item.y === 'number'
    && typeof item.depth === 'number'
    && typeof item.size === 'number'
    && typeof item.color === 'string'
    && (item.transform === undefined || isElementTransform(item.transform))
    && (item.dimensions === undefined || isVector(item.dimensions));
}

function isVector(value: unknown): value is Vec3 {
  if (!value || typeof value !== 'object') return false;
  const vector = value as Partial<Vec3>;
  return [vector.x, vector.y, vector.z].every((part) => typeof part === 'number' && Number.isFinite(part));
}

function isElementTransform(value: unknown): value is NonNullable<StageElement['transform']> {
  if (!value || typeof value !== 'object') return false;
  const transform = value as NonNullable<StageElement['transform']>;
  return isVector(transform.position)
    && [transform.rotation?.yaw, transform.rotation?.pitch, transform.rotation?.roll].every((part) => typeof part === 'number' && Number.isFinite(part));
}

function defaultPhysicalSize(type: StageElementType, stage: StageDimensions): Vec3 {
  if (type === 'back-wall') return { x: stage.width * .9, y: stage.height * .55, z: .15 };
  if (type === 'drums') return { x: 2, y: 1.4, z: 1.7 };
  if (type === 'person') return { x: .6, y: 1.8, z: .6 };
  if (type === 'led-screen') return { x: 3.6, y: 2, z: .15 };
  return { x: 2.4, y: .45, z: 1.8 };
}

export function stageElementPosition(element: StageElement, stage: StageDimensions = DEFAULT_STAGE_DIMENSIONS): Vec3 {
  return element.transform?.position ?? {
    x: (element.x / 100 - .5) * stage.width,
    y: (1 - element.y / 100) * stage.height,
    z: element.depth / 100 * stage.depth
  };
}

export function migrateStageElement(element: StageElement, stage: StageDimensions = DEFAULT_STAGE_DIMENSIONS): StageElement {
  const clamped = clampStageElement(element);
  return {
    ...clamped,
    transform: clamped.transform ?? {
      position: stageElementPosition(clamped, stage),
      rotation: { yaw: 0, pitch: 0, roll: 0 }
    },
    dimensions: clamped.dimensions ?? defaultPhysicalSize(clamped.type, stage)
  };
}

export function makeStageDocument(elements: readonly StageElement[], stage: StageDimensions = DEFAULT_STAGE_DIMENSIONS): StageDocument {
  return { schemaVersion: 2, elements: elements.map((element) => migrateStageElement(element, stage)) };
}

export function isStageDocument(value: unknown): value is StageDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<StageDocument>;
  return document.schemaVersion === 2 && Array.isArray(document.elements) && document.elements.every(isStageElement);
}
