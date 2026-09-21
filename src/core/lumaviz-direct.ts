import { invoke } from '@tauri-apps/api/core';
import {
  findMode,
  findProfile,
  readFixtureParameter,
  type PatchedFixture
} from '../lib/fixtures';

export type LumaVizDirectStatus = {
  listening: boolean;
  port: number;
  clients: number;
  framesSent: number;
  lastError?: string | null;
};

export type SemanticFixtureState = {
  id: string;
  name: string;
  group: string;
  profileId: string;
  modeId: string;
  manufacturer?: string;
  model?: string;
  category?: string;
  capabilities: string[];
  universe: number;
  address: number;
  intensity?: number;
  color?: string;
  emitters?: {
    red: number;
    green: number;
    blue: number;
    white: number;
    amber: number;
    uv: number;
  };
  pan?: number;
  tilt?: number;
  beamAngle?: number;
  strobeHz?: number;
};

export type SemanticFixtureFrame = {
  version: 1;
  showId?: string;
  sequence: number;
  timestamp: number;
  fixtures: SemanticFixtureState[];
};

function normalized(frame: readonly number[], fixture: PatchedFixture, parameter: Parameters<typeof readFixtureParameter>[2]) {
  return readFixtureParameter(frame, fixture, parameter) / 255;
}

function hex(red: number, green: number, blue: number) {
  return '#' + [red, green, blue].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('');
}

function movementDegrees(value: number, range: number) {
  return (value - 0.5) * range;
}

export function semanticFrameFromResolvedOutput(
  sequence: number,
  frame: readonly number[],
  patch: readonly PatchedFixture[],
  universe: number,
  showId?: string
): SemanticFixtureFrame {
  const fixtures = patch
    .filter((fixture) => (fixture.universe ?? 1) === universe)
    .map((fixture): SemanticFixtureState => {
      const profile = findProfile(fixture.profileId);
      const mode = findMode(fixture);
      const has = (parameter: string) => mode?.channels.some((channel) => channel.parameter === parameter) ?? false;
      const dimmer = has('dimmer') ? normalized(frame, fixture, 'dimmer') : 1;
      const red = has('red') ? readFixtureParameter(frame, fixture, 'red') : 255;
      const green = has('green') ? readFixtureParameter(frame, fixture, 'green') : 255;
      const blue = has('blue') ? readFixtureParameter(frame, fixture, 'blue') : 255;
      const white = has('white') ? readFixtureParameter(frame, fixture, 'white') : 0;
      const amber = has('amber') ? readFixtureParameter(frame, fixture, 'amber') : 0;
      const uv = has('uv') ? readFixtureParameter(frame, fixture, 'uv') : 0;
      const pan = has('pan') && profile?.movement
        ? movementDegrees(normalized(frame, fixture, 'pan'), profile.movement.panRangeDegrees)
        : undefined;
      const tilt = has('tilt') && profile?.movement
        ? movementDegrees(normalized(frame, fixture, 'tilt'), profile.movement.tiltRangeDegrees)
        : undefined;
      const zoom = has('zoom') && profile?.optics
        ? profile.optics.beamAngleMinDegrees
          + normalized(frame, fixture, 'zoom') * (profile.optics.beamAngleMaxDegrees - profile.optics.beamAngleMinDegrees)
        : profile?.optics?.defaultBeamAngleDegrees;
      const strobeValue = has('strobe') ? normalized(frame, fixture, 'strobe') : 0;

      return {
        id: fixture.id,
        name: fixture.name,
        group: fixture.group,
        profileId: fixture.profileId,
        modeId: fixture.modeId,
        manufacturer: profile?.manufacturer,
        model: profile?.model,
        category: profile?.category,
        capabilities: mode?.channels.flatMap((channel) => channel.parameter ? [channel.parameter] : []) ?? [],
        universe: fixture.universe ?? 1,
        address: fixture.address,
        intensity: dimmer,
        color: hex(red, green, blue),
        emitters: {
          red: red / 255,
          green: green / 255,
          blue: blue / 255,
          white: white / 255,
          amber: amber / 255,
          uv: uv / 255
        },
        pan,
        tilt,
        beamAngle: zoom,
        strobeHz: strobeValue > 0 ? strobeValue * 20 : 0
      };
    });

  return {
    version: 1,
    showId,
    sequence,
    timestamp: Date.now(),
    fixtures
  };
}

export async function startLumaVizDirect(): Promise<LumaVizDirectStatus> {
  return invoke<LumaVizDirectStatus>('start_lumaviz_direct');
}

export async function lumaVizDirectStatus(): Promise<LumaVizDirectStatus> {
  return invoke<LumaVizDirectStatus>('lumaviz_direct_status');
}

export async function sendLumaVizDirectFrame(frame: SemanticFixtureFrame): Promise<void> {
  await invoke('send_lumaviz_fixture_frame', { frame });
}


export async function sendLumaVizStageChange(change: unknown): Promise<void> {
  await invoke('send_lumaviz_stage_change', { change });
}

export async function drainLumaVizStageChanges<T = unknown>(): Promise<T[]> {
  return invoke<T[]>('drain_lumaviz_stage_changes');
}
