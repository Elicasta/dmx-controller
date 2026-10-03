import { DEFAULT_STAGE_DIMENSIONS, type EulerDegrees, type StageDimensions, type Vec3 } from '../core/geometry';

export type StageElementType = 'back-wall' | 'drums' | 'person' | 'led-screen' | 'riser';

export type StageAssetKind =
  | 'generic'
  | 'pulpit'
  | 'keyboard'
  | 'speaker'
  | 'monitor'
  | 'projector'
  | 'door'
  | 'drape'
  | 'rug'
  | 'chair'
  | 'plant'
  | 'lighting-stand'
  | 'drum-shield'
  | 'choir-riser'
  | 'subwoofer'
  | 'truss'
  | 'column'
  | 'camera'
  | 'piano';

export type StageScreenFraming = {
  fit?: 'contain' | 'cover';
  scale?: number;
  offsetX?: number;
  offsetY?: number;
};

export type StageScreenSource = (
  | { kind: 'none' }
  | { kind: 'timeline'; sourceName?: string; deviceId?: string }
  | { kind: 'ndi'; deviceId?: string; sourceName?: string }
  | { kind: 'image'; mediaId: string; sourceName?: string }
  | { kind: 'color'; color: string }
  | { kind: 'test-pattern'; pattern: 'bars' | 'grid' | 'checker' }
) & StageScreenFraming;

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
  assetKind?: StageAssetKind;
  mediaSource?: StageScreenSource;
};

export type StageDocument = {
  schemaVersion: 2;
  elements: StageElement[];
};

export type StageWarehouseCategory = 'Stage' | 'Screens' | 'Scenic' | 'Audio' | 'Band' | 'People';

export type StageWarehouseItem = {
  id: string;
  category: StageWarehouseCategory;
  name: string;
  type: StageElementType;
  assetKind?: StageAssetKind;
  defaultColor: string;
  defaultSize: number;
  dimensions: Vec3;
  mediaSource?: StageScreenSource;
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

export const STAGE_WAREHOUSE: readonly StageWarehouseItem[] = [
  { id: 'stage-deck-4x8', category: 'Stage', name: '4×8 Deck', type: 'riser', defaultColor: '#4d5660', defaultSize: 42, dimensions: { x: 2.4384, y: .2032, z: 1.2192 } },
  { id: 'stage-deck-8x8', category: 'Stage', name: '8×8 Deck', type: 'riser', defaultColor: '#4d5660', defaultSize: 52, dimensions: { x: 2.4384, y: .2032, z: 2.4384 } },
  { id: 'choir-riser', category: 'Stage', name: 'Choir Riser', type: 'riser', assetKind: 'choir-riser', defaultColor: '#33383e', defaultSize: 70, dimensions: { x: 6.096, y: .2032, z: 2.4384 } },
  { id: 'pulpit', category: 'Stage', name: 'Pulpit / Lectern', type: 'riser', assetKind: 'pulpit', defaultColor: '#171a1e', defaultSize: 28, dimensions: { x: .762, y: 1.1684, z: .6096 } },
  { id: 'screen-16x9', category: 'Screens', name: '16:9 Screen', type: 'led-screen', defaultColor: '#d8e2e8', defaultSize: 58, dimensions: { x: 4.2672, y: 2.4, z: .08 }, mediaSource: { kind: 'none' } },
  { id: 'screen-vertical', category: 'Screens', name: 'Vertical LED', type: 'led-screen', defaultColor: '#d8e2e8', defaultSize: 40, dimensions: { x: 1.2, y: 2.4, z: .08 }, mediaSource: { kind: 'none' } },
  { id: 'drape', category: 'Scenic', name: 'Drape', type: 'back-wall', assetKind: 'drape', defaultColor: '#111317', defaultSize: 76, dimensions: { x: 4.8768, y: 3.048, z: .08 } },
  { id: 'truss-10ft', category: 'Scenic', name: '10ft Truss', type: 'riser', assetKind: 'truss', defaultColor: '#777f87', defaultSize: 46, dimensions: { x: 3.048, y: .3048, z: .3048 } },
  { id: 'column', category: 'Scenic', name: 'Column', type: 'back-wall', assetKind: 'column', defaultColor: '#5b646d', defaultSize: 24, dimensions: { x: .6096, y: 3.048, z: .6096 } },
  { id: 'speaker', category: 'Audio', name: 'PA Speaker', type: 'riser', assetKind: 'speaker', defaultColor: '#20262c', defaultSize: 26, dimensions: { x: .6096, y: 1.0668, z: .5588 } },
  { id: 'subwoofer', category: 'Audio', name: '18in Sub', type: 'riser', assetKind: 'subwoofer', defaultColor: '#20262c', defaultSize: 30, dimensions: { x: .7112, y: .6096, z: .762 } },
  { id: 'monitor', category: 'Audio', name: 'Floor Monitor', type: 'riser', assetKind: 'monitor', defaultColor: '#262d34', defaultSize: 22, dimensions: { x: .6096, y: .254, z: .4572 } },
  { id: 'drums', category: 'Band', name: 'Drum Kit', type: 'drums', assetKind: 'drum-shield', defaultColor: '#a7b0b9', defaultSize: 44, dimensions: { x: 1.8288, y: 1.2192, z: 1.524 } },
  { id: 'keyboard', category: 'Band', name: 'Keyboard', type: 'riser', assetKind: 'keyboard', defaultColor: '#4f5861', defaultSize: 36, dimensions: { x: 1.524, y: 1.016, z: .6096 } },
  { id: 'piano', category: 'Band', name: 'Piano', type: 'riser', assetKind: 'piano', defaultColor: '#25292e', defaultSize: 42, dimensions: { x: 1.524, y: 1.0668, z: .762 } },
  { id: 'performer', category: 'People', name: 'Performer', type: 'person', defaultColor: '#d1d9df', defaultSize: 22, dimensions: { x: .6096, y: 1.7526, z: .4572 } },
  { id: 'chair', category: 'People', name: 'Chair', type: 'person', assetKind: 'chair', defaultColor: '#555e66', defaultSize: 18, dimensions: { x: .508, y: .9144, z: .508 } },
  { id: 'camera', category: 'People', name: 'Camera', type: 'riser', assetKind: 'camera', defaultColor: '#353c43', defaultSize: 18, dimensions: { x: .6096, y: 1.524, z: .6096 } }
];

export function makeStageWarehouseElement(itemId: string, index: number, stageDimensions: StageDimensions = DEFAULT_STAGE_DIMENSIONS): StageElement {
  const item = STAGE_WAREHOUSE.find((candidate) => candidate.id === itemId) ?? STAGE_WAREHOUSE[0];
  const base = makeStageElement(item.type, index, stageDimensions);
  return migrateStageElement({
    ...base,
    id: `warehouse-${item.id}-${Date.now().toString(36)}-${index}`,
    label: `${item.name} ${index + 1}`,
    color: item.defaultColor,
    size: item.defaultSize,
    assetKind: item.assetKind,
    mediaSource: item.mediaSource ? { ...item.mediaSource } : base.mediaSource,
    dimensions: { ...item.dimensions }
  }, stageDimensions);
}

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
    && (item.dimensions === undefined || isVector(item.dimensions))
    && (item.assetKind === undefined || isStageAssetKind(item.assetKind))
    && (item.mediaSource === undefined || isStageScreenSource(item.mediaSource));
}

function isStageAssetKind(value: unknown): value is StageAssetKind {
  return typeof value === 'string' && [
    'generic', 'pulpit', 'keyboard', 'speaker', 'monitor', 'projector',
    'door', 'drape', 'rug', 'chair', 'plant', 'lighting-stand',
    'drum-shield', 'choir-riser', 'subwoofer', 'truss', 'column', 'camera', 'piano'
  ].includes(value);
}

function isStageScreenSource(value: unknown): value is StageScreenSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<StageScreenSource> & {
    deviceId?: unknown; sourceName?: unknown; mediaId?: unknown; color?: unknown; pattern?: unknown;
    fit?: unknown; scale?: unknown; offsetX?: unknown; offsetY?: unknown;
  };
  if (source.kind === 'none') return true;
  if (source.kind === 'color') return typeof source.color === 'string' && /^#[0-9a-f]{6}$/i.test(source.color);
  if (source.kind === 'test-pattern') return source.pattern === 'bars' || source.pattern === 'grid' || source.pattern === 'checker';
  if (source.kind !== 'ndi' && source.kind !== 'timeline' && source.kind !== 'image') return false;
  if (source.kind === 'image' && typeof source.mediaId !== 'string') return false;
  return (source.deviceId === undefined || typeof source.deviceId === 'string')
    && (source.sourceName === undefined || typeof source.sourceName === 'string')
    && (source.fit === undefined || source.fit === 'contain' || source.fit === 'cover')
    && (source.scale === undefined || (typeof source.scale === 'number' && Number.isFinite(source.scale) && source.scale >= .25 && source.scale <= 4))
    && (source.offsetX === undefined || (typeof source.offsetX === 'number' && Number.isFinite(source.offsetX) && source.offsetX >= -1 && source.offsetX <= 1))
    && (source.offsetY === undefined || (typeof source.offsetY === 'number' && Number.isFinite(source.offsetY) && source.offsetY >= -1 && source.offsetY <= 1));
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
