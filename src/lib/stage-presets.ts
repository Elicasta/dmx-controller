import { METERS_PER_FOOT, type StageDimensions } from '../core/geometry';
import { migrateStageElement, type StageElement, type StageElementType } from './stage';

export type StagePresetId = 'cornerstone-main-sanctuary' | 'apostolic-day-2026';

export type StagePreset = {
  id: StagePresetId;
  name: string;
  venue: string;
  description: string;
  estimated: boolean;
  notes: string[];
  dimensions: StageDimensions;
  elements: StageElement[];
};

const ft = (value: number) => value * METERS_PER_FOOT;

function makeDimensions(
  stageWidthFt: number,
  stageDepthFt: number,
  heightFt: number,
  trimFt: number,
  roomWidthFt: number,
  roomDepthFt: number,
  roomHeightFt: number
): StageDimensions {
  return {
    width: ft(stageWidthFt),
    depth: ft(stageDepthFt),
    height: ft(heightFt),
    trimHeight: ft(trimFt),
    roomWidth: ft(roomWidthFt),
    roomDepth: ft(roomDepthFt),
    roomHeight: ft(roomHeightFt)
  };
}

type PresetElementSpec = {
  id: string;
  type: StageElementType;
  label: string;
  xFt: number;
  yFt: number;
  zFt: number;
  widthFt: number;
  heightFt: number;
  depthFt: number;
  color: string;
  size?: number;
  assetKind?: StageElement['assetKind'];
  mediaSource?: StageElement['mediaSource'];
};

function presetElement(presetId: StagePresetId, stage: StageDimensions, spec: PresetElementSpec): StageElement {
  const position = { x: ft(spec.xFt), y: ft(spec.yFt), z: ft(spec.zFt) };
  return migrateStageElement({
    id: `${presetId}:${spec.id}`,
    type: spec.type,
    label: spec.label,
    x: Math.max(2, Math.min(98, (position.x / stage.width + .5) * 100)),
    y: Math.max(5, Math.min(92, (1 - position.y / stage.height) * 100)),
    depth: Math.max(0, Math.min(100, position.z / stage.depth * 100)),
    size: spec.size ?? 54,
    color: spec.color,
    assetKind: spec.assetKind,
    mediaSource: spec.mediaSource,
    transform: {
      position,
      rotation: { yaw: 0, pitch: 0, roll: 0 }
    },
    dimensions: { x: ft(spec.widthFt), y: ft(spec.heightFt), z: ft(spec.depthFt) }
  }, stage);
}

/**
 * Ported from Elicasta/lumaviz/src/locations/presets.ts.
 *
 * LumaViz stored the room on a Z axis where the stage rear was near the
 * largest positive Z value. LumaRig's integrated renderer uses Z=0 at the
 * stage rear and positive Z toward the audience, so the original geometry is
 * mirrored into local stage coordinates while preserving every measured
 * spacing and physical size.
 */
const churchRearDatumFt = 24;
const churchZ = (lumavizZFt: number) => churchRearDatumFt - lumavizZFt;
const churchDimensions = makeDimensions(24, 9, 10, 9.4, 30, 48, 10);

const church: StagePreset = {
  id: 'cornerstone-main-sanctuary',
  name: 'Cornerstone · Main Sanctuary',
  venue: 'Cornerstone Christian Fellowship',
  description: 'Original LumaViz church preset, ported into the integrated LumaRig visualizer.',
  estimated: true,
  notes: [
    'Geometry is photo-derived and remains estimated until field measurements are entered.',
    'The existing LumaRig show patch remains authoritative for actual fixture identity and addressing.'
  ],
  dimensions: churchDimensions,
  elements: [
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'main-platform', type: 'riser', label: 'Main Platform',
      xFt: 0, yFt: .625, zFt: churchZ(19.5),
      widthFt: 24, heightFt: 1.25, depthFt: 9,
      color: '#24282e', size: 92
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'rear-wall', type: 'back-wall', label: 'Blue Rear Accent Wall',
      xFt: 0, yFt: 5, zFt: churchZ(23.7),
      widthFt: 24, heightFt: 10, depthFt: .25,
      color: '#173b61', size: 92
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'center-screen', type: 'led-screen', label: 'Center Projection Screen',
      xFt: 0, yFt: 7.6, zFt: churchZ(23.35),
      widthFt: 9, heightFt: 5.1, depthFt: .18,
      color: '#d9e7ef', size: 60,
      mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' }
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'left-display', type: 'led-screen', label: 'Left Display',
      xFt: -8, yFt: 6.6, zFt: churchZ(23.2),
      widthFt: 5, heightFt: 3, depthFt: .22,
      color: '#d9e7ef', size: 42,
      mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' }
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'right-display', type: 'led-screen', label: 'Right Display',
      xFt: 8, yFt: 6.6, zFt: churchZ(23.2),
      widthFt: 5, heightFt: 3, depthFt: .22,
      color: '#d9e7ef', size: 42,
      mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' }
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'left-door', type: 'back-wall', label: 'Stage Left Door',
      xFt: -10.4, yFt: 3.5, zFt: churchZ(23.05),
      widthFt: 3, heightFt: 7, depthFt: .25,
      color: '#27323b', size: 28, assetKind: 'door'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'right-door', type: 'back-wall', label: 'Stage Right Door',
      xFt: 10.4, yFt: 3.5, zFt: churchZ(23.05),
      widthFt: 3, heightFt: 7, depthFt: .25,
      color: '#27323b', size: 28, assetKind: 'door'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'drum-shield', type: 'drums', label: 'Drum Shield',
      xFt: -6.5, yFt: 3.2, zFt: churchZ(20.8),
      widthFt: 5.5, heightFt: 5.2, depthFt: .08,
      color: '#aab4bf', size: 46, assetKind: 'drum-shield'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'keyboard', type: 'riser', label: 'Keyboard',
      xFt: 6.7, yFt: 3, zFt: churchZ(19.8),
      widthFt: 5, heightFt: 3, depthFt: .8,
      color: '#535d66', size: 38, assetKind: 'keyboard'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'pulpit', type: 'riser', label: 'Glass Pulpit',
      xFt: 0, yFt: 2.6, zFt: churchZ(15.8),
      widthFt: 3.2, heightFt: 4.2, depthFt: 1.5,
      color: '#cbd9df', size: 30, assetKind: 'pulpit'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'speaker-left', type: 'riser', label: 'Wall Speaker Left',
      xFt: -14.3, yFt: 7.2, zFt: churchZ(13),
      widthFt: 2.2, heightFt: 3.8, depthFt: 1.8,
      color: '#20262c', size: 26, assetKind: 'speaker'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'speaker-right', type: 'riser', label: 'Wall Speaker Right',
      xFt: 14.3, yFt: 7.2, zFt: churchZ(13),
      widthFt: 2.2, heightFt: 3.8, depthFt: 1.8,
      color: '#20262c', size: 26, assetKind: 'speaker'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'projector', type: 'riser', label: 'Ceiling Projector',
      xFt: 0, yFt: 9.2, zFt: churchZ(6.5),
      widthFt: 1.8, heightFt: .7, depthFt: 1.5,
      color: '#cfd6dc', size: 20, assetKind: 'projector'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'monitor-left', type: 'riser', label: 'Floor Monitor Left',
      xFt: -5.8, yFt: 1.3, zFt: churchZ(15.2),
      widthFt: 2.8, heightFt: 1.2, depthFt: 1.8,
      color: '#2a3138', size: 22, assetKind: 'monitor'
    }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, {
      id: 'monitor-right', type: 'riser', label: 'Floor Monitor Right',
      xFt: 5.8, yFt: 1.3, zFt: churchZ(15.2),
      widthFt: 2.8, heightFt: 1.2, depthFt: 1.8,
      color: '#2a3138', size: 22, assetKind: 'monitor'
    })
  ]
};

const apostolicRearDatumFt = 28;
const apostolicZ = (lumavizZFt: number) => apostolicRearDatumFt - lumavizZFt;
const apostolicDimensions = makeDimensions(42, 12, 16, 9.5, 50, 60, 16);

const apostolic: StagePreset = {
  id: 'apostolic-day-2026',
  name: 'Apostolic Day 2026 · Signature Ballroom 2',
  venue: 'Rosen Centre Hotel · Signature 2',
  description: 'Original Apostolic Day 2026 LumaViz preset, ported into LumaRig.',
  estimated: true,
  notes: [
    'Rosen Signature 2 room footprint: 50 ft × 60 ft / 3,000 sq ft.',
    'The source preset uses a 16 ft ceiling and records the published conflicting 15 ft figure.',
    'The cove boundary remains a field-adjustable stage-area datum.',
    'Reference lighting positions stay separate from the authoritative LumaRig fixture patch.'
  ],
  dimensions: apostolicDimensions,
  elements: [
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'main-stage', type: 'riser', label: 'Main Stage',
      xFt: 0, yFt: .335, zFt: 6,
      widthFt: 42, heightFt: .67, depthFt: 12,
      color: '#25292e', size: 96
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'cove-boundary', type: 'back-wall', label: 'Stage Cove Boundary',
      xFt: 0, yFt: 12, zFt: apostolicZ(18),
      widthFt: 50, heightFt: .08, depthFt: .08,
      color: '#666b70', size: 96
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'black-drape', type: 'back-wall', label: '10 ft Black Back Drape',
      xFt: 0, yFt: 5, zFt: apostolicZ(27.5),
      widthFt: 42, heightFt: 10, depthFt: .3,
      color: '#101216', size: 96, assetKind: 'drape'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'pulpit-riser', type: 'riser', label: '8 in Pulpit Riser',
      xFt: 0, yFt: .335, zFt: apostolicZ(20),
      widthFt: 8, heightFt: .67, depthFt: 6,
      color: '#16191d', size: 52
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'center-screen', type: 'led-screen', label: '180 in Projection Screen',
      xFt: 0, yFt: 7.2, zFt: apostolicZ(27.15),
      widthFt: 15, heightFt: 8.44, depthFt: .2,
      color: '#edf1f5', size: 74,
      mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' }
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'pulpit', type: 'riser', label: 'Black Pulpit',
      xFt: 0, yFt: 2.4, zFt: apostolicZ(17.5),
      widthFt: 2.4, heightFt: 4.2, depthFt: 1.7,
      color: '#0d0f12', size: 24, assetKind: 'pulpit'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'choir-riser-a', type: 'riser', label: 'Choir Riser A',
      xFt: -14, yFt: .5, zFt: apostolicZ(23),
      widthFt: 14, heightFt: 1, depthFt: 4,
      color: '#292d32', size: 58, assetKind: 'choir-riser'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'choir-riser-b', type: 'riser', label: 'Choir Riser B',
      xFt: -14, yFt: 1, zFt: apostolicZ(25.2),
      widthFt: 14, heightFt: 2, depthFt: 4,
      color: '#292d32', size: 58, assetKind: 'choir-riser'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'band-pit', type: 'riser', label: 'Band Pit',
      xFt: 14, yFt: .25, zFt: apostolicZ(22.5),
      widthFt: 14, heightFt: .5, depthFt: 9,
      color: '#1d2125', size: 64, assetKind: 'rug'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'piano', type: 'riser', label: 'Piano / Keys',
      xFt: 10, yFt: 2, zFt: apostolicZ(19),
      widthFt: 6, heightFt: 3, depthFt: 2,
      color: '#4f565d', size: 40, assetKind: 'piano'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'sub-left', type: 'riser', label: 'Sub Left',
      xFt: -7, yFt: 1.5, zFt: apostolicZ(14.5),
      widthFt: 2.5, heightFt: 3, depthFt: 2.5,
      color: '#20262c', size: 28, assetKind: 'subwoofer'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'sub-right', type: 'riser', label: 'Sub Right',
      xFt: 7, yFt: 1.5, zFt: apostolicZ(14.5),
      widthFt: 2.5, heightFt: 3, depthFt: 2.5,
      color: '#20262c', size: 28, assetKind: 'subwoofer'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'main-left', type: 'riser', label: 'Main Left',
      xFt: -20, yFt: 6.5, zFt: apostolicZ(16),
      widthFt: 2.5, heightFt: 4, depthFt: 2.5,
      color: '#20262c', size: 28, assetKind: 'speaker'
    }),
    presetElement('apostolic-day-2026', apostolicDimensions, {
      id: 'main-right', type: 'riser', label: 'Main Right',
      xFt: 20, yFt: 6.5, zFt: apostolicZ(16),
      widthFt: 2.5, heightFt: 4, depthFt: 2.5,
      color: '#20262c', size: 28, assetKind: 'speaker'
    })
  ]
};

export const STAGE_PRESETS: readonly StagePreset[] = [church, apostolic];

export function getStagePreset(id: StagePresetId): StagePreset {
  const preset = STAGE_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown stage preset: ${id}`);
  return preset;
}

export function instantiateStagePreset(id: StagePresetId): StagePreset {
  const preset = getStagePreset(id);
  return {
    ...preset,
    notes: [...preset.notes],
    dimensions: { ...preset.dimensions },
    elements: preset.elements.map((element) => ({
      ...element,
      transform: element.transform ? {
        position: { ...element.transform.position },
        rotation: { ...element.transform.rotation }
      } : undefined,
      dimensions: element.dimensions ? { ...element.dimensions } : undefined,
      mediaSource: element.mediaSource ? { ...element.mediaSource } : undefined
    }))
  };
}
