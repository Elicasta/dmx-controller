import { METERS_PER_FOOT, type StageDimensions } from '../core/geometry';
import { migrateStageElement, type StageElement, type StageElementType } from './stage';

export type StagePresetId = 'cornerstone-main-sanctuary' | 'apostolic-day-2026';

export type StagePreset = {
  id: StagePresetId;
  name: string;
  description: string;
  dimensions: StageDimensions;
  elements: StageElement[];
};

const ft = (value: number) => value * METERS_PER_FOOT;

function makeDimensions(stageWidthFt: number, stageDepthFt: number, heightFt: number, trimFt: number, roomWidthFt: number, roomDepthFt: number, roomHeightFt: number): StageDimensions {
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

const churchDimensions = makeDimensions(30, 14, 10, 9.5, 30, 48, 10);
const church: StagePreset = {
  id: 'cornerstone-main-sanctuary',
  name: 'Cornerstone · Main Sanctuary',
  description: 'Church setup with blue rear wall, projection, side displays, drum shield, keyboard, pulpit, PA and monitors.',
  dimensions: churchDimensions,
  elements: [
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'rear-wall', type: 'back-wall', label: 'Blue Rear Wall', xFt: 0, yFt: 5, zFt: .15, widthFt: 30, heightFt: 10, depthFt: .25, color: '#173b61', size: 92 }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'center-screen', type: 'led-screen', label: 'Center Projection', xFt: 0, yFt: 5.6, zFt: .35, widthFt: 12, heightFt: 6.75, depthFt: .2, color: '#d9e7ef', size: 64, mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' } }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'left-display', type: 'led-screen', label: 'Stage Left Display', xFt: -12, yFt: 5.2, zFt: .45, widthFt: 3.8, heightFt: 2.15, depthFt: .2, color: '#d9e7ef', size: 34, mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' } }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'right-display', type: 'led-screen', label: 'Stage Right Display', xFt: 12, yFt: 5.2, zFt: .45, widthFt: 3.8, heightFt: 2.15, depthFt: .2, color: '#d9e7ef', size: 34, mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' } }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'left-door', type: 'back-wall', label: 'Stage Left Door', xFt: -13.2, yFt: 3.5, zFt: .6, widthFt: 2.6, heightFt: 7, depthFt: .3, color: '#26313b', size: 24, assetKind: 'door' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'right-door', type: 'back-wall', label: 'Stage Right Door', xFt: 13.2, yFt: 3.5, zFt: .6, widthFt: 2.6, heightFt: 7, depthFt: .3, color: '#26313b', size: 24, assetKind: 'door' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'left-pixel-bar', type: 'back-wall', label: 'RGBW Pixel Bar L', xFt: -7.5, yFt: 4.2, zFt: .55, widthFt: .45, heightFt: 8, depthFt: .35, color: '#8cb7d8', size: 18 }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'right-pixel-bar', type: 'back-wall', label: 'RGBW Pixel Bar R', xFt: 7.5, yFt: 4.2, zFt: .55, widthFt: .45, heightFt: 8, depthFt: .35, color: '#8cb7d8', size: 18 }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'drums', type: 'drums', label: 'Drums + Shield', xFt: -8.2, yFt: 1.4, zFt: 6.2, widthFt: 6, heightFt: 4, depthFt: 5, color: '#aab4bf', size: 48, assetKind: 'drum-shield' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'keyboard', type: 'riser', label: 'Keyboard', xFt: 8, yFt: 1.4, zFt: 6.7, widthFt: 6, heightFt: 3, depthFt: 2.5, color: '#5e6975', size: 42, assetKind: 'keyboard' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'pulpit', type: 'riser', label: 'Pulpit', xFt: 0, yFt: 2, zFt: 10.6, widthFt: 2.5, heightFt: 4, depthFt: 2.2, color: '#d9dde2', size: 30, assetKind: 'pulpit' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'pa-left', type: 'riser', label: 'Wall PA L', xFt: -13.7, yFt: 5.8, zFt: 2.2, widthFt: 1.4, heightFt: 3.5, depthFt: 1.2, color: '#20272e', size: 24, assetKind: 'speaker' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'pa-right', type: 'riser', label: 'Wall PA R', xFt: 13.7, yFt: 5.8, zFt: 2.2, widthFt: 1.4, heightFt: 3.5, depthFt: 1.2, color: '#20272e', size: 24, assetKind: 'speaker' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'monitor-left', type: 'riser', label: 'Floor Monitor L', xFt: -4.4, yFt: .45, zFt: 11.7, widthFt: 2.2, heightFt: .8, depthFt: 1.5, color: '#2a3138', size: 22, assetKind: 'monitor' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'monitor-right', type: 'riser', label: 'Floor Monitor R', xFt: 4.4, yFt: .45, zFt: 11.7, widthFt: 2.2, heightFt: .8, depthFt: 1.5, color: '#2a3138', size: 22, assetKind: 'monitor' }),
    presetElement('cornerstone-main-sanctuary', churchDimensions, { id: 'projector', type: 'riser', label: 'Ceiling Projector', xFt: 0, yFt: 9.1, zFt: 12.8, widthFt: 1.8, heightFt: .8, depthFt: 1.5, color: '#cfd6dc', size: 20, assetKind: 'projector' })
  ]
};

const apostolicDimensions = makeDimensions(31 + 5 / 12, 24 + 10 / 12, 13.5, 11.5, 31 + 5 / 12, 24 + 10 / 12, 13.5);
const apostolic: StagePreset = {
  id: 'apostolic-day-2026',
  name: 'Apostolic Day 2026 · Rosen',
  description: 'Signature Ballroom 2 setup with 180-inch center screen, black drape, pulpit riser, choir riser and stage-right band area.',
  dimensions: apostolicDimensions,
  elements: [
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'black-drape', type: 'back-wall', label: 'Full Black Drape', xFt: 0, yFt: 6.5, zFt: .2, widthFt: 31, heightFt: 13, depthFt: .25, color: '#101216', size: 96, assetKind: 'drape' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'center-screen', type: 'led-screen', label: '180in Center Screen', xFt: 0, yFt: 8.17, zFt: .6, widthFt: 13 + 1 / 12, heightFt: 7 + 4 / 12, depthFt: .2, color: '#edf1f5', size: 72, mediaSource: { kind: 'ndi', sourceName: 'ProPresenter', fit: 'contain' } }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'slat-left-a', type: 'back-wall', label: 'Warm Slat L1', xFt: -13, yFt: 5.8, zFt: .7, widthFt: 1.1, heightFt: 10.5, depthFt: .35, color: '#9d7652', size: 18 }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'slat-left-b', type: 'back-wall', label: 'Warm Slat L2', xFt: -10.5, yFt: 5.5, zFt: .75, widthFt: 1.1, heightFt: 9.5, depthFt: .35, color: '#9d7652', size: 18 }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'slat-right-a', type: 'back-wall', label: 'Warm Slat R1', xFt: 10.5, yFt: 5.5, zFt: .75, widthFt: 1.1, heightFt: 9.5, depthFt: .35, color: '#9d7652', size: 18 }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'slat-right-b', type: 'back-wall', label: 'Warm Slat R2', xFt: 13, yFt: 5.8, zFt: .7, widthFt: 1.1, heightFt: 10.5, depthFt: .35, color: '#9d7652', size: 18 }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'choir-riser', type: 'riser', label: 'Choir Riser · Stage Left', xFt: -5.5, yFt: .34, zFt: 4.5, widthFt: 20, heightFt: 8 / 12, depthFt: 8, color: '#24272b', size: 84, assetKind: 'choir-riser' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'band-rug', type: 'riser', label: 'Band Rug · Stage Right', xFt: 8.2, yFt: .08, zFt: 14, widthFt: 14, heightFt: .16, depthFt: 10, color: '#16181b', size: 66, assetKind: 'rug' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'drums', type: 'drums', label: 'Shielded Drums', xFt: 8, yFt: 1.3, zFt: 11.8, widthFt: 6, heightFt: 4, depthFt: 5, color: '#b8bec5', size: 46, assetKind: 'drum-shield' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'keys', type: 'riser', label: 'Keys', xFt: 12.2, yFt: 1.4, zFt: 15.4, widthFt: 5.5, heightFt: 3, depthFt: 2.4, color: '#555c64', size: 38, assetKind: 'keyboard' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'pulpit-riser', type: 'riser', label: '8×8 Pulpit Riser', xFt: 0, yFt: .34, zFt: 20, widthFt: 8, heightFt: 8 / 12, depthFt: 8, color: '#16191d', size: 52, assetKind: 'pulpit' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'lectern', type: 'riser', label: 'Black Lectern', xFt: 0, yFt: 2.1, zFt: 20, widthFt: 2.2, heightFt: 4, depthFt: 2, color: '#0d0f12', size: 24, assetKind: 'pulpit' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'plant-left', type: 'person', label: 'Greenery L', xFt: -3.3, yFt: 1.8, zFt: 19.7, widthFt: 2.2, heightFt: 4, depthFt: 2.2, color: '#48634c', size: 24, assetKind: 'plant' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'plant-right', type: 'person', label: 'Greenery R', xFt: 3.3, yFt: 1.8, zFt: 19.7, widthFt: 2.2, heightFt: 4, depthFt: 2.2, color: '#48634c', size: 24, assetKind: 'plant' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'choir-chair-1', type: 'person', label: 'Choir Chair 1', xFt: -11.2, yFt: 1.7, zFt: 3.6, widthFt: 1.8, heightFt: 3.3, depthFt: 1.8, color: '#5a5f65', size: 18, assetKind: 'chair' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'choir-chair-2', type: 'person', label: 'Choir Chair 2', xFt: -7.2, yFt: 1.7, zFt: 3.6, widthFt: 1.8, heightFt: 3.3, depthFt: 1.8, color: '#5a5f65', size: 18, assetKind: 'chair' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'choir-chair-3', type: 'person', label: 'Choir Chair 3', xFt: -3.2, yFt: 1.7, zFt: 3.6, widthFt: 1.8, heightFt: 3.3, depthFt: 1.8, color: '#5a5f65', size: 18, assetKind: 'chair' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'rear-light-stand-left', type: 'riser', label: 'Rear Light Stand L', xFt: -14, yFt: 5, zFt: 2.2, widthFt: 1.4, heightFt: 10, depthFt: 1.4, color: '#3d4248', size: 20, assetKind: 'lighting-stand' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'rear-light-stand-right', type: 'riser', label: 'Rear Light Stand R', xFt: 14, yFt: 5, zFt: 2.2, widthFt: 1.4, heightFt: 10, depthFt: 1.4, color: '#3d4248', size: 20, assetKind: 'lighting-stand' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'front-light-stand-left', type: 'riser', label: 'Front Light Stand L', xFt: -14, yFt: 5, zFt: 22.5, widthFt: 1.4, heightFt: 10, depthFt: 1.4, color: '#3d4248', size: 20, assetKind: 'lighting-stand' }),
    presetElement('apostolic-day-2026', apostolicDimensions, { id: 'front-light-stand-right', type: 'riser', label: 'Front Light Stand R', xFt: 14, yFt: 5, zFt: 22.5, widthFt: 1.4, heightFt: 10, depthFt: 1.4, color: '#3d4248', size: 20, assetKind: 'lighting-stand' })
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
