import { clampDmx, type DmxUpdate } from './dmx';
import {
  DEFAULT_STAGE_DIMENSIONS,
  EMPTY_CALIBRATION,
  legacyFixtureTransform,
  type CalibrationObservation,
  type FixtureCalibration,
  type FixtureMounting,
  type FixtureOrientation,
  type FixtureTransform,
  type MovementGeometry,
  type StageDimensions
} from '../core/geometry';

export type FixtureCategory = 'Par' | 'Moving Head' | 'Bar' | 'Other';
export type FixtureParameter =
  | 'dimmer'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'strobe'
  | 'pan'
  | 'panFine'
  | 'tilt'
  | 'tiltFine'
  | 'movementSpeed'
  | 'colorWheel'
  | 'gobo'
  | 'focus'
  | 'prism'
  | 'zoom'
  | 'iris'
  | 'goboRotate'
  | 'prismRotate'
  | 'macro';

export type FixtureChannel = {
  offset: number;
  label: string;
  parameter?: FixtureParameter;
  defaultValue?: number;
};

export type FixtureMode = {
  id: string;
  name: string;
  channelCount: number;
  channels: FixtureChannel[];
};

export type FixtureProfile = {
  id: string;
  manufacturer: string;
  model: string;
  category: FixtureCategory;
  verified: boolean;
  note: string;
  movement?: MovementGeometry;
  optics?: {
    lensOffsetMeters?: { x: number; y: number; z: number };
    beamAngleMinDegrees: number;
    beamAngleMaxDegrees: number;
    defaultBeamAngleDegrees: number;
    fieldAngleDegrees?: number;
  };
  modes: FixtureMode[];
};

export type PatchedFixture = {
  id: string;
  name: string;
  profileId: string;
  modeId: string;
  universe?: number;
  address: number;
  group: string;
  selected: boolean;
  collapsed: boolean;
  stageX?: number;
  stageY?: number;
  stageDepth?: number;
  stageDirection?: number;
  labelColor?: string;
  transform?: FixtureTransform;
  mounting?: FixtureMounting;
  orientation?: FixtureOrientation;
  calibration?: FixtureCalibration;
};

export type PatchDocument = {
  schemaVersion: 2;
  fixtures: PatchedFixture[];
};

const ch = (
  offset: number,
  label: string,
  parameter?: FixtureParameter,
  defaultValue = 0
): FixtureChannel => ({ offset, label, parameter, defaultValue });

export const FIXTURE_LIBRARY: readonly FixtureProfile[] = [
  {
    id: 'adj-mega-par-profile-plus',
    manufacturer: 'ADJ',
    model: 'Mega Par Profile Plus',
    category: 'Par',
    verified: true,
    note: 'Ch05 mode verified against the ADJ manual and the connected fixture.',
    optics: { beamAngleMinDegrees: 30, beamAngleMaxDegrees: 30, defaultBeamAngleDegrees: 30, fieldAngleDegrees: 42 },
    modes: [{
      id: 'ch05',
      name: 'Ch05 · RGB UV Dimmer',
      channelCount: 5,
      channels: [
        ch(0, 'Red', 'red'), ch(1, 'Green', 'green'), ch(2, 'Blue', 'blue'),
        ch(3, 'UV', 'uv'), ch(4, 'Master dimmer', 'dimmer')
      ]
    }]
  },
  {
    id: 'adj-mega-hex-par',
    manufacturer: 'ADJ',
    model: 'Mega Hex Par',
    category: 'Par',
    verified: false,
    note: 'Starter profile. Confirm the selected personality in the fixture manual before output.',
    modes: [{
      id: '6ch-direct',
      name: '6ch · RGBAW+UV direct',
      channelCount: 6,
      channels: [
        ch(0, 'Red', 'red'), ch(1, 'Green', 'green'), ch(2, 'Blue', 'blue'),
        ch(3, 'Amber', 'amber'), ch(4, 'White', 'white'), ch(5, 'UV', 'uv')
      ]
    }]
  },
  {
    id: 'adj-pocket-pro',
    manufacturer: 'ADJ',
    model: 'Pocket Pro Moving Head',
    category: 'Moving Head',
    verified: false,
    note: 'Starter profile. ADJ revisions can differ; verify channel order before connecting output.',
    movement: {
      panRangeDegrees: 540, tiltRangeDegrees: 270,
      panHomeDegrees: 0, tiltHomeDegrees: 0,
      panInvert: false, tiltInvert: false,
      panDMXMin: 0, panDMXMax: 255, tiltDMXMin: 0, tiltDMXMax: 255
    },
    optics: { beamAngleMinDegrees: 13, beamAngleMaxDegrees: 13, defaultBeamAngleDegrees: 13 },
    modes: [{
      id: '11ch-starter',
      name: '11ch · starter personality',
      channelCount: 11,
      channels: [
        ch(0, 'Pan', 'pan'), ch(1, 'Pan fine', 'panFine'), ch(2, 'Tilt', 'tilt'),
        ch(3, 'Tilt fine', 'tiltFine'), ch(4, 'Movement speed', 'movementSpeed'),
        ch(5, 'Color wheel', 'colorWheel'), ch(6, 'Gobo', 'gobo'), ch(7, 'Shutter / strobe', 'strobe'),
        ch(8, 'Dimmer', 'dimmer'), ch(9, 'Focus', 'focus'), ch(10, 'Programs', 'macro')
      ]
    }]
  },
  {
    id: 'shehds-7x18w-par',
    manufacturer: 'SHEHDS',
    model: '7×18W RGBWA+UV Par',
    category: 'Par',
    verified: false,
    note: 'Starter template for a commonly sold SHEHDS par. Match it to the exact manual and mode.',
    modes: [{
      id: '10ch-starter',
      name: '10ch · Dimmer RGBWA+UV',
      channelCount: 10,
      channels: [
        ch(0, 'Master dimmer', 'dimmer'), ch(1, 'Red', 'red'), ch(2, 'Green', 'green'),
        ch(3, 'Blue', 'blue'), ch(4, 'White', 'white'), ch(5, 'Amber', 'amber'),
        ch(6, 'UV', 'uv'), ch(7, 'Strobe', 'strobe'), ch(8, 'Macro', 'macro'), ch(9, 'Speed')
      ]
    }]
  },
  {
    id: 'shehds-spot-moving-head',
    manufacturer: 'SHEHDS',
    model: 'Spot Moving Head',
    category: 'Moving Head',
    verified: false,
    note: 'Starter moving-head template. SHEHDS wattages and revisions use different personalities.',
    movement: {
      panRangeDegrees: 540, tiltRangeDegrees: 270,
      panHomeDegrees: 0, tiltHomeDegrees: 0,
      panInvert: false, tiltInvert: false,
      panDMXMin: 0, panDMXMax: 255, tiltDMXMin: 0, tiltDMXMax: 255
    },
    optics: { beamAngleMinDegrees: 10, beamAngleMaxDegrees: 18, defaultBeamAngleDegrees: 12 },
    modes: [{
      id: '14ch-starter',
      name: '14ch · Pan/Tilt/Color/Gobo',
      channelCount: 14,
      channels: [
        ch(0, 'Pan', 'pan'), ch(1, 'Pan fine', 'panFine'), ch(2, 'Tilt', 'tilt'),
        ch(3, 'Tilt fine', 'tiltFine'), ch(4, 'Movement speed', 'movementSpeed'),
        ch(5, 'Color wheel', 'colorWheel'), ch(6, 'Gobo', 'gobo'), ch(7, 'Strobe', 'strobe'),
        ch(8, 'Dimmer', 'dimmer'), ch(9, 'Focus', 'focus'), ch(10, 'Prism', 'prism'),
        ch(11, 'Prism rotation'), ch(12, 'Programs', 'macro'), ch(13, 'Reset')
      ]
    }]
  },
  {
    id: 'generic-rgb-par',
    manufacturer: 'Generic / Amazon',
    model: 'RGB Par',
    category: 'Par',
    verified: false,
    note: 'Generic template. Choose the channel order printed in your fixture manual.',
    modes: [
      {
        id: '4ch-rgbd',
        name: '4ch · Red Green Blue Dimmer',
        channelCount: 4,
        channels: [ch(0, 'Red', 'red'), ch(1, 'Green', 'green'), ch(2, 'Blue', 'blue'), ch(3, 'Dimmer', 'dimmer')]
      },
      {
        id: '4ch-drgb',
        name: '4ch · Dimmer Red Green Blue',
        channelCount: 4,
        channels: [ch(0, 'Dimmer', 'dimmer'), ch(1, 'Red', 'red'), ch(2, 'Green', 'green'), ch(3, 'Blue', 'blue')]
      },
      {
        id: '7ch-common',
        name: '7ch · Dimmer RGB Strobe Macro Speed',
        channelCount: 7,
        channels: [
          ch(0, 'Dimmer', 'dimmer'), ch(1, 'Red', 'red'), ch(2, 'Green', 'green'),
          ch(3, 'Blue', 'blue'), ch(4, 'Strobe', 'strobe'), ch(5, 'Macro', 'macro'), ch(6, 'Speed')
        ]
      }
    ]
  },
  {
    id: 'generic-rgbw-par',
    manufacturer: 'Generic / Amazon',
    model: 'RGBW Par',
    category: 'Par',
    verified: false,
    note: 'Generic template. Confirm whether dimmer comes first or last on your fixture.',
    modes: [{
      id: '5ch-drgbw',
      name: '5ch · Dimmer Red Green Blue White',
      channelCount: 5,
      channels: [
        ch(0, 'Dimmer', 'dimmer'), ch(1, 'Red', 'red'), ch(2, 'Green', 'green'),
        ch(3, 'Blue', 'blue'), ch(4, 'White', 'white')
      ]
    }]
  },
  {
    id: 'generic-led-bar',
    manufacturer: 'Generic / Amazon',
    model: 'RGB LED Bar',
    category: 'Bar',
    verified: false,
    note: 'Simple whole-bar template. Pixel modes require a model-specific profile.',
    modes: [{
      id: '7ch-common',
      name: '7ch · Dimmer RGB Strobe Macro Speed',
      channelCount: 7,
      channels: [
        ch(0, 'Dimmer', 'dimmer'), ch(1, 'Red', 'red'), ch(2, 'Green', 'green'),
        ch(3, 'Blue', 'blue'), ch(4, 'Strobe', 'strobe'), ch(5, 'Macro', 'macro'), ch(6, 'Speed')
      ]
    }]
  },
  {
    id: 'generic-moving-head',
    manufacturer: 'Generic / Amazon',
    model: 'LED Moving Head',
    category: 'Moving Head',
    verified: false,
    note: 'Safe starting template only. Verify every moving-head channel before raising the dimmer.',
    movement: {
      panRangeDegrees: 540, tiltRangeDegrees: 270,
      panHomeDegrees: 0, tiltHomeDegrees: 0,
      panInvert: false, tiltInvert: false,
      panDMXMin: 0, panDMXMax: 255, tiltDMXMin: 0, tiltDMXMax: 255
    },
    optics: { beamAngleMinDegrees: 8, beamAngleMaxDegrees: 22, defaultBeamAngleDegrees: 12 },
    modes: [{
      id: '14ch-common',
      name: '14ch · common starter layout',
      channelCount: 14,
      channels: [
        ch(0, 'Pan', 'pan'), ch(1, 'Pan fine', 'panFine'), ch(2, 'Tilt', 'tilt'),
        ch(3, 'Tilt fine', 'tiltFine'), ch(4, 'Movement speed', 'movementSpeed'),
        ch(5, 'Color wheel', 'colorWheel'), ch(6, 'Gobo', 'gobo'), ch(7, 'Strobe', 'strobe'),
        ch(8, 'Dimmer', 'dimmer'), ch(9, 'Focus', 'focus'), ch(10, 'Prism', 'prism'),
        ch(11, 'Prism rotation'), ch(12, 'Programs', 'macro'), ch(13, 'Reset')
      ]
    }]
  }
] as const;

export const DEFAULT_PATCH: PatchedFixture[] = [{
  id: 'fixture-mega-par-1',
  name: 'Mega Par 1',
  profileId: 'adj-mega-par-profile-plus',
  modeId: 'ch05',
  universe: 1,
  address: 1,
  group: 'Front Wash',
  selected: true,
  collapsed: false,
  stageX: 50,
  stageY: 14,
  stageDepth: 35,
  stageDirection: 0,
  labelColor: '#55d982',
  transform: legacyFixtureTransform({ stageX: 50, stageY: 14, stageDepth: 35, stageDirection: 0 }, 0, 1),
  mounting: 'hanging',
  orientation: 'normal',
  calibration: { ...EMPTY_CALIBRATION }
}];

export function findProfile(profileId: string): FixtureProfile | undefined {
  return FIXTURE_LIBRARY.find((profile) => profile.id === profileId);
}

export function findMode(patch: Pick<PatchedFixture, 'profileId' | 'modeId'>): FixtureMode | undefined {
  return findProfile(patch.profileId)?.modes.find((mode) => mode.id === patch.modeId);
}

export function fixtureEndAddress(patch: PatchedFixture): number {
  return patch.address + (findMode(patch)?.channelCount ?? 1) - 1;
}

export function patchCollision(
  candidate: PatchedFixture,
  patch: readonly PatchedFixture[]
): PatchedFixture | undefined {
  const start = candidate.address;
  const end = fixtureEndAddress(candidate);
  const universe = candidate.universe ?? 1;
  return patch.find((other) => {
    if (other.id === candidate.id) return false;
    if ((other.universe ?? 1) !== universe) return false;
    const otherEnd = fixtureEndAddress(other);
    return start <= otherEnd && end >= other.address;
  });
}

export function validatePatch(candidate: PatchedFixture, patch: readonly PatchedFixture[]): string | null {
  if (!findMode(candidate)) return 'Choose a valid fixture mode.';
  if (!Number.isInteger(candidate.universe ?? 1) || (candidate.universe ?? 1) < 1) {
    return 'DMX universe must be a positive whole number.';
  }
  if (!Number.isInteger(candidate.address) || candidate.address < 1 || candidate.address > 512) {
    return 'DMX address must be between 1 and 512.';
  }
  if (fixtureEndAddress(candidate) > 512) return 'This fixture would run past channel 512.';
  const collision = patchCollision(candidate, patch);
  return collision ? `Channels overlap ${collision.name} at A${String(collision.address).padStart(3, '0')}.` : null;
}

export function parameterChannel(
  patch: PatchedFixture,
  parameter: FixtureParameter
): number | null {
  const definition = findMode(patch)?.channels.find((channel) => channel.parameter === parameter);
  return definition ? patch.address + definition.offset : null;
}

export function readFixtureParameter(
  universe: readonly number[],
  patch: PatchedFixture,
  parameter: FixtureParameter
): number {
  const channel = parameterChannel(patch, parameter);
  return channel ? universe[channel - 1] ?? 0 : 0;
}

export function fixtureParameterUpdate(
  patch: PatchedFixture,
  parameter: FixtureParameter,
  value: number
): DmxUpdate | null {
  const channel = parameterChannel(patch, parameter);
  return channel ? [channel, clampDmx(value)] : null;
}

export function fixtureColorUpdates(
  patch: PatchedFixture,
  rgb: readonly [number, number, number]
): DmxUpdate[] {
  const updates = (['red', 'green', 'blue'] as const)
    .map((parameter, index) => fixtureParameterUpdate(patch, parameter, rgb[index]))
    .filter((update): update is DmxUpdate => Boolean(update));
  return updates;
}

export function isPatchedFixture(value: unknown): value is PatchedFixture {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PatchedFixture>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.profileId === 'string'
    && typeof item.modeId === 'string'
    && (item.universe === undefined || (Number.isInteger(item.universe) && item.universe >= 1))
    && typeof item.address === 'number'
    && typeof item.group === 'string'
    && typeof item.selected === 'boolean'
    && typeof item.collapsed === 'boolean'
    && (item.stageX === undefined || typeof item.stageX === 'number')
    && (item.stageY === undefined || typeof item.stageY === 'number')
    && (item.stageDepth === undefined || typeof item.stageDepth === 'number')
    && (item.stageDirection === undefined || typeof item.stageDirection === 'number')
    && (item.transform === undefined || isFixtureTransform(item.transform))
    && (item.mounting === undefined || ['hanging', 'floor', 'wall', 'custom'].includes(item.mounting))
    && (item.orientation === undefined || ['normal', 'inverted', 'rotated90', 'rotated180', 'custom'].includes(item.orientation))
    && (item.calibration === undefined || isFixtureCalibration(item.calibration))
    && (item.labelColor === undefined || /^#[0-9a-f]{6}$/i.test(item.labelColor))
    && Boolean(findMode(item as PatchedFixture));
}

function isFixtureTransform(value: unknown): value is FixtureTransform {
  if (!value || typeof value !== 'object') return false;
  const transform = value as Partial<FixtureTransform>;
  const position = transform.position as Partial<FixtureTransform['position']> | undefined;
  const rotation = transform.rotation as Partial<FixtureTransform['rotation']> | undefined;
  return Boolean(position && rotation)
    && [position?.x, position?.y, position?.z, rotation?.yaw, rotation?.pitch, rotation?.roll].every((part) => typeof part === 'number' && Number.isFinite(part));
}

function isFixtureCalibration(value: unknown): value is FixtureCalibration {
  if (!value || typeof value !== 'object') return false;
  const calibration = value as Partial<FixtureCalibration>;
  return typeof calibration.panOffsetDegrees === 'number'
    && typeof calibration.tiltOffsetDegrees === 'number'
    && typeof calibration.panInvert === 'boolean'
    && typeof calibration.tiltInvert === 'boolean'
    && ['uncalibrated', 'partial', 'calibrated'].includes(calibration.status ?? '')
    && (calibration.confidence === undefined || (typeof calibration.confidence === 'number' && Number.isFinite(calibration.confidence) && calibration.confidence >= 0 && calibration.confidence <= 1))
    && (calibration.lastCalibratedAt === undefined || typeof calibration.lastCalibratedAt === 'string')
    && (calibration.observations === undefined || (Array.isArray(calibration.observations) && calibration.observations.every((observation) => {
      if (!observation || typeof observation !== 'object') return false;
      const candidate = observation as Partial<CalibrationObservation>;
      return typeof candidate.id === 'string'
        && (candidate.targetId === undefined || typeof candidate.targetId === 'string')
        && typeof candidate.targetName === 'string'
        && Boolean(candidate.target)
        && [candidate.target?.x, candidate.target?.y, candidate.target?.z, candidate.panNormalized, candidate.tiltNormalized].every((part) => typeof part === 'number' && Number.isFinite(part))
        && typeof candidate.capturedAt === 'string';
    })));
}

export function fixtureTransform(
  fixture: PatchedFixture,
  index: number,
  total: number,
  dimensions: StageDimensions = DEFAULT_STAGE_DIMENSIONS
): FixtureTransform {
  return fixture.transform ?? legacyFixtureTransform(fixture, index, total, dimensions);
}

export function migratePatchedFixture(
  fixture: PatchedFixture,
  index: number,
  total: number,
  dimensions: StageDimensions = DEFAULT_STAGE_DIMENSIONS
): PatchedFixture {
  const transform = fixtureTransform(fixture, index, total, dimensions);
  const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
  const wrapDegrees = (value: number) => {
    const finiteValue = finite(value, 0);
    return ((finiteValue + 180) % 360 + 360) % 360 - 180;
  };
  const safeTransform: FixtureTransform = {
    position: {
      x: clamp(finite(transform.position.x, 0), -dimensions.width / 2, dimensions.width / 2),
      y: clamp(finite(transform.position.y, dimensions.trimHeight), 0, dimensions.height),
      z: clamp(finite(transform.position.z, dimensions.depth * .35), 0, dimensions.depth)
    },
    rotation: {
      yaw: wrapDegrees(transform.rotation.yaw),
      pitch: wrapDegrees(transform.rotation.pitch),
      roll: wrapDegrees(transform.rotation.roll)
    }
  };
  return {
    ...fixture,
    universe: fixture.universe ?? 1,
    transform: safeTransform,
    mounting: fixture.mounting ?? 'hanging',
    orientation: fixture.orientation ?? 'normal',
    calibration: { ...EMPTY_CALIBRATION, ...fixture.calibration }
  };
}

export function makePatchDocument(fixtures: readonly PatchedFixture[]): PatchDocument {
  return { schemaVersion: 2, fixtures: fixtures.map((fixture, index) => migratePatchedFixture(fixture, index, fixtures.length)) };
}

export function isPatchDocument(value: unknown): value is PatchDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<PatchDocument>;
  return document.schemaVersion === 2
    && Array.isArray(document.fixtures)
    && document.fixtures.length > 0
    && document.fixtures.every(isPatchedFixture);
}

export function fixtureStagePosition(
  fixture: PatchedFixture,
  index: number,
  total: number
): { x: number; y: number; depth: number; direction: number } {
  const fallbackX = ((index + 1) / (total + 1)) * 100;
  return {
    x: Math.max(5, Math.min(95, fixture.stageX ?? fallbackX)),
    y: Math.max(5, Math.min(65, fixture.stageY ?? 14)),
    depth: Math.max(0, Math.min(100, fixture.stageDepth ?? 35)),
    direction: Math.max(-90, Math.min(90, fixture.stageDirection ?? 0))
  };
}
