import { isColorPalette, type ColorPalette } from '../core/color';
import { clampDmx } from './dmx';
import type { DmxUpdate } from './dmx';
import type { FixtureLookValues } from './looks';
import type { Vec3 } from '../core/geometry';
import type { TargetArrangement } from '../core/targets';

export type SpatialPositionPalette = {
  id: string;
  name: string;
  kind: 'spatial';
  targetId: string;
  targetName: string;
  fallbackTarget: Vec3;
  arrangement: TargetArrangement;
  spreadMeters: number;
};

export type AbsolutePositionPalette = {
  id: string;
  name: string;
  kind: 'absolute';
  positions: Array<{
    fixtureId: string;
    fixtureName: string;
    panNormalized: number;
    tiltNormalized: number;
  }>;
};

export type PositionPalette = SpatialPositionPalette | AbsolutePositionPalette;

export type FixtureGroup = {
  id: string;
  name: string;
  labelColor: string;
  masterDefault: number;
  fxEnabled: boolean;
  notes: string;
  fixtureOrder: string[];
};

export type ShowCue = {
  id: string;
  number: number;
  name: string;
  fadeMs: number;
  fadeOutMs?: number;
  delayMs?: number;
  followMs?: number;
  color?: string;
  description?: string;
  linkedLookId?: string;
  linkedEffectId?: string;
  trackName?: string;
  values: FixtureLookValues;
  /** Legacy v1-v3 Universe 1 snapshot. Kept for backward compatibility. */
  universe?: number[];
  universes?: Array<{ universe: number; values: number[] }>;
};

export type ShowRecordingFrame = {
  timeMs: number;
  /** Legacy v1-v3 Universe 1 updates. Kept for backward compatibility. */
  updates: DmxUpdate[];
  universeUpdates?: Array<{ universe: number; updates: DmxUpdate[] }>;
};

export type ShowRecording = {
  id: string;
  name: string;
  trackName: string;
  durationMs: number;
  createdAt: string;
  frames: ShowRecordingFrame[];
};

export type ExternalTrackSync = {
  songName: string;
  recordingId: string;
  bpm: number;
  lightingOffsetMs: number;
  armed: boolean;
};

export type ShowFile = {
  version: 1 | 2 | 3 | 4;
  name: string;
  notes?: string;
  cues: ShowCue[];
  groups?: FixtureGroup[];
  positionPalettes?: PositionPalette[];
  colorPalettes?: ColorPalette[];
  recordings?: ShowRecording[];
  externalTrack?: ExternalTrackSync;
};

export const DEFAULT_EXTERNAL_TRACK_SYNC: ExternalTrackSync = {
  songName: '',
  recordingId: '',
  bpm: 120,
  lightingOffsetMs: 0,
  armed: false
};

export const EMPTY_SHOW: ShowFile = {
  version: 4,
  name: 'My First Show',
  notes: '',
  cues: [],
  groups: [],
  positionPalettes: [],
  recordings: [],
  externalTrack: { ...DEFAULT_EXTERNAL_TRACK_SYNC }
};

export const MAX_RECORDING_FRAMES = 18_000;

export function renumberCues(cues: readonly ShowCue[]): ShowCue[] {
  return cues.map((cue, index) => ({ ...cue, number: index + 1 }));
}

export function moveCue(
  cues: readonly ShowCue[],
  cueId: string,
  direction: -1 | 1
): ShowCue[] {
  const from = cues.findIndex((cue) => cue.id === cueId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= cues.length) return [...cues];
  const next = [...cues];
  [next[from], next[to]] = [next[to], next[from]];
  return renumberCues(next);
}

export function isShowFile(value: unknown): value is ShowFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ShowFile>;
  if (![1, 2, 3, 4].includes(candidate.version ?? 0) || typeof candidate.name !== 'string' || !Array.isArray(candidate.cues)) {
    return false;
  }
  const cuesValid = candidate.cues.every((cue) => {
    if (!cue || typeof cue !== 'object') return false;
    const item = cue as Partial<ShowCue>;
    const values = item.values as Partial<FixtureLookValues> | undefined;
    return typeof item.id === 'string'
      && typeof item.number === 'number'
      && typeof item.name === 'string'
      && typeof item.fadeMs === 'number'
      && (item.fadeOutMs === undefined || typeof item.fadeOutMs === 'number')
      && (item.delayMs === undefined || typeof item.delayMs === 'number')
      && (item.followMs === undefined || typeof item.followMs === 'number')
      && (item.color === undefined || (typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color)))
      && (item.description === undefined || typeof item.description === 'string')
      && (item.linkedLookId === undefined || typeof item.linkedLookId === 'string')
      && (item.linkedEffectId === undefined || typeof item.linkedEffectId === 'string')
      && (item.trackName === undefined || typeof item.trackName === 'string')
      && (item.universe === undefined || (
        Array.isArray(item.universe)
        && item.universe.length === 512
        && item.universe.every((channel) => typeof channel === 'number' && Number.isFinite(channel))
      ))
      && (item.universes === undefined || (
        Array.isArray(item.universes)
        && item.universes.length <= 64
        && item.universes.every((snapshot) => (
          snapshot && typeof snapshot === 'object'
          && Number.isInteger(snapshot.universe)
          && snapshot.universe >= 1
          && Array.isArray(snapshot.values)
          && snapshot.values.length === 512
          && snapshot.values.every((channel) => typeof channel === 'number' && Number.isFinite(channel))
        ))
      ))
      && Boolean(values)
      && ['red', 'green', 'blue', 'uv', 'dimmer'].every((key) => (
        typeof values?.[key as keyof FixtureLookValues] === 'number'
      ));
  });
  const externalTrack = candidate.externalTrack as Partial<ExternalTrackSync> | undefined;
  const externalTrackValid = externalTrack === undefined || (
    typeof externalTrack.songName === 'string'
    && typeof externalTrack.recordingId === 'string'
    && typeof externalTrack.bpm === 'number'
    && (externalTrack.lightingOffsetMs === undefined || typeof externalTrack.lightingOffsetMs === 'number')
    && typeof externalTrack.armed === 'boolean'
  );
  return cuesValid
    && externalTrackValid
    && (candidate.colorPalettes === undefined || (Array.isArray(candidate.colorPalettes) && candidate.colorPalettes.every(isColorPalette)))
    && (candidate.groups === undefined || (Array.isArray(candidate.groups) && candidate.groups.every(isFixtureGroup)))
    && (candidate.positionPalettes === undefined || (Array.isArray(candidate.positionPalettes) && candidate.positionPalettes.every(isPositionPalette)))
    && (candidate.recordings === undefined || (
    Array.isArray(candidate.recordings) && candidate.recordings.every(isShowRecording)
  ));
}

export function isFixtureGroup(value: unknown): value is FixtureGroup {
  if (!value || typeof value !== 'object') return false;
  const group = value as Partial<FixtureGroup>;
  return typeof group.id === 'string'
    && typeof group.name === 'string'
    && typeof group.labelColor === 'string'
    && /^#[0-9a-f]{6}$/i.test(group.labelColor)
    && typeof group.masterDefault === 'number'
    && Number.isFinite(group.masterDefault)
    && typeof group.fxEnabled === 'boolean'
    && typeof group.notes === 'string'
    && Array.isArray(group.fixtureOrder)
    && group.fixtureOrder.every((id) => typeof id === 'string');
}

function isVector(value: unknown): value is Vec3 {
  if (!value || typeof value !== 'object') return false;
  const vector = value as Partial<Vec3>;
  return [vector.x, vector.y, vector.z].every((part) => typeof part === 'number' && Number.isFinite(part));
}

export function isPositionPalette(value: unknown): value is PositionPalette {
  if (!value || typeof value !== 'object') return false;
  const palette = value as Partial<PositionPalette>;
  if (typeof palette.id !== 'string' || typeof palette.name !== 'string') return false;
  if (palette.kind === 'spatial') {
    const spatial = palette as Partial<SpatialPositionPalette>;
    return typeof spatial.targetId === 'string'
      && typeof spatial.targetName === 'string'
      && isVector(spatial.fallbackTarget)
      && ['converge', 'fan-horizontal', 'fan-vertical', 'mirror', 'cross'].includes(spatial.arrangement ?? '')
      && typeof spatial.spreadMeters === 'number'
      && Number.isFinite(spatial.spreadMeters);
  }
  if (palette.kind === 'absolute') {
    const absolute = palette as Partial<AbsolutePositionPalette>;
    return Array.isArray(absolute.positions) && absolute.positions.every((position) => (
      position && typeof position === 'object'
      && typeof position.fixtureId === 'string'
      && typeof position.fixtureName === 'string'
      && typeof position.panNormalized === 'number'
      && Number.isFinite(position.panNormalized)
      && typeof position.tiltNormalized === 'number'
      && Number.isFinite(position.tiltNormalized)
    ));
  }
  return false;
}

export function isShowRecording(value: unknown): value is ShowRecording {
  if (!value || typeof value !== 'object') return false;
  const recording = value as Partial<ShowRecording>;
  return typeof recording.id === 'string'
    && typeof recording.name === 'string'
    && typeof recording.trackName === 'string'
    && typeof recording.durationMs === 'number'
    && typeof recording.createdAt === 'string'
    && Array.isArray(recording.frames)
    && recording.frames.every((frame) => (
      frame && typeof frame === 'object'
      && typeof frame.timeMs === 'number'
      && Array.isArray(frame.updates)
      && frame.updates.every((update) => (
        Array.isArray(update)
        && update.length === 2
        && Number.isInteger(update[0])
        && update[0] >= 1
        && update[0] <= 512
        && typeof update[1] === 'number'
        && Number.isFinite(update[1])
      ))
      && (frame.universeUpdates === undefined || (
        Array.isArray(frame.universeUpdates)
        && frame.universeUpdates.length <= 64
        && frame.universeUpdates.every((entry) => (
          entry && typeof entry === 'object'
          && Number.isInteger(entry.universe)
          && entry.universe >= 1
          && Array.isArray(entry.updates)
          && entry.updates.every((update) => (
            Array.isArray(update)
            && update.length === 2
            && Number.isInteger(update[0])
            && update[0] >= 1
            && update[0] <= 512
            && typeof update[1] === 'number'
            && Number.isFinite(update[1])
          ))
        ))
      ))
    ));
}

export function diffUniverse(previous: readonly number[], next: readonly number[]): DmxUpdate[] {
  const updates: DmxUpdate[] = [];
  for (let index = 0; index < 512; index += 1) {
    const value = clampDmx(next[index] ?? 0);
    if (value !== clampDmx(previous[index] ?? 0)) updates.push([index + 1, value]);
  }
  return updates;
}

export function midiSongPositionToMs(position: number, bpm: number) {
  const safePosition = Math.max(0, Math.min(16383, Math.round(position)));
  const safeBpm = Math.max(20, Math.min(300, Number.isFinite(bpm) ? bpm : 120));
  return safePosition * (60000 / safeBpm / 4);
}

export function applyLightingOffset(positionMs: number, offsetMs: number) {
  const safePosition = Math.max(0, Number.isFinite(positionMs) ? positionMs : 0);
  const safeOffset = Math.max(-5000, Math.min(5000, Number.isFinite(offsetMs) ? offsetMs : 0));
  return Math.max(0, safePosition + safeOffset);
}

export function sanitizeShow(show: ShowFile): ShowFile {
  return {
    version: 4,
    colorPalettes: (show.colorPalettes ?? []).filter(isColorPalette).slice(0, 256).map(p => ({id:p.id.slice(0,100),name:p.name.trim().slice(0,64),color:p.color.toLowerCase(),folder:p.folder.trim().slice(0,64)})),
    name: show.name.trim().slice(0, 64) || EMPTY_SHOW.name,
    notes: typeof show.notes === 'string' ? show.notes.slice(0, 4000) : '',
    groups: (show.groups ?? []).slice(0, 64).map((group) => ({
      id: group.id.slice(0, 100),
      name: group.name.trim().slice(0, 64) || 'Group',
      labelColor: /^#[0-9a-f]{6}$/i.test(group.labelColor) ? group.labelColor : '#55e98d',
      masterDefault: Math.max(0, Math.min(100, Number.isFinite(group.masterDefault) ? group.masterDefault : 100)),
      fxEnabled: Boolean(group.fxEnabled),
      notes: group.notes.slice(0, 500),
      fixtureOrder: [...new Set(group.fixtureOrder.filter((id) => typeof id === 'string').map((id) => id.slice(0, 100)))].slice(0, 256)
    })),
    externalTrack: {
      songName: (show.externalTrack?.songName ?? '').trim().slice(0, 180),
      recordingId: (show.externalTrack?.recordingId ?? '').slice(0, 100),
      bpm: Math.max(20, Math.min(300, Number.isFinite(show.externalTrack?.bpm) ? Number(show.externalTrack?.bpm) : 120)),
      lightingOffsetMs: Math.max(-5000, Math.min(5000, Number.isFinite(show.externalTrack?.lightingOffsetMs) ? Math.round(Number(show.externalTrack?.lightingOffsetMs)) : 0)),
      armed: Boolean(show.externalTrack?.armed)
    },
    cues: renumberCues(show.cues.slice(0, 200).map((cue) => ({
      ...cue,
      name: cue.name.trim().slice(0, 64) || `Cue ${cue.number}`,
      fadeMs: Math.max(0, Math.min(60000, Math.round(cue.fadeMs))),
      fadeOutMs: Math.max(0, Math.min(60000, Math.round(cue.fadeOutMs ?? cue.fadeMs))),
      delayMs: Math.max(0, Math.min(60000, Math.round(cue.delayMs ?? 0))),
      followMs: Math.max(0, Math.min(3_600_000, Math.round(cue.followMs ?? 0))),
      color: cue.color && /^#[0-9a-f]{6}$/i.test(cue.color) ? cue.color : '#55e98d',
      description: (cue.description ?? '').slice(0, 500),
      linkedLookId: (cue.linkedLookId ?? '').slice(0, 100),
      linkedEffectId: (cue.linkedEffectId ?? '').slice(0, 100),
      trackName: (cue.trackName ?? '').slice(0, 180),
      values: {
        red: clampDmx(cue.values.red),
        green: clampDmx(cue.values.green),
        blue: clampDmx(cue.values.blue),
        uv: clampDmx(cue.values.uv),
        dimmer: clampDmx(cue.values.dimmer)
      },
      universe: cue.universe?.slice(0, 512).map(clampDmx),
      universes: (
        cue.universes?.length
          ? cue.universes
          : cue.universe ? [{ universe: 1, values: cue.universe }] : []
      )
        .filter((snapshot, index, snapshots) => (
          Number.isInteger(snapshot.universe)
          && snapshot.universe >= 1
          && snapshots.findIndex((item) => item.universe === snapshot.universe) === index
        ))
        .slice(0, 64)
        .map((snapshot) => ({
          universe: snapshot.universe,
          values: Array.from({ length: 512 }, (_, index) => clampDmx(snapshot.values[index] ?? 0))
        }))
    }))),
    positionPalettes: (show.positionPalettes ?? []).slice(0, 64).map((palette): PositionPalette => palette.kind === 'spatial' ? {
      id: palette.id.slice(0, 100),
      name: palette.name.trim().slice(0, 64) || 'Position palette',
      kind: 'spatial',
      targetId: palette.targetId.slice(0, 100),
      targetName: palette.targetName.trim().slice(0, 64) || 'Target',
      fallbackTarget: {
        x: Number.isFinite(palette.fallbackTarget.x) ? palette.fallbackTarget.x : 0,
        y: Number.isFinite(palette.fallbackTarget.y) ? palette.fallbackTarget.y : 0,
        z: Number.isFinite(palette.fallbackTarget.z) ? palette.fallbackTarget.z : 0
      },
      arrangement: palette.arrangement,
      spreadMeters: Math.max(.1, Math.min(100, Number.isFinite(palette.spreadMeters) ? palette.spreadMeters : 4))
    } : {
      id: palette.id.slice(0, 100),
      name: palette.name.trim().slice(0, 64) || 'Position palette',
      kind: 'absolute',
      positions: palette.positions.slice(0, 128).map((position) => ({
        fixtureId: position.fixtureId.slice(0, 100),
        fixtureName: position.fixtureName.trim().slice(0, 64) || 'Fixture',
        panNormalized: Math.max(0, Math.min(1, Number.isFinite(position.panNormalized) ? position.panNormalized : .5)),
        tiltNormalized: Math.max(0, Math.min(1, Number.isFinite(position.tiltNormalized) ? position.tiltNormalized : .5))
      }))
    }),
    recordings: (show.recordings ?? []).slice(-24).map((recording) => ({
      id: recording.id,
      name: recording.name.trim().slice(0, 64) || 'Recorded take',
      trackName: recording.trackName.trim().slice(0, 180),
      durationMs: Math.max(0, Math.min(3_600_000, Math.round(recording.durationMs))),
      createdAt: recording.createdAt,
      frames: recording.frames.slice(0, MAX_RECORDING_FRAMES).map((frame) => {
        const legacyUpdates = frame.updates.slice(0, 512).map(([channel, value]) => [
          Math.max(1, Math.min(512, Math.round(channel))),
          clampDmx(value)
        ] as DmxUpdate);
        const sourceUniverseUpdates = frame.universeUpdates?.length
          ? frame.universeUpdates
          : legacyUpdates.length ? [{ universe: 1, updates: legacyUpdates }] : [];
        const universeUpdates = sourceUniverseUpdates
          .filter((entry, index, entries) => (
            Number.isInteger(entry.universe)
            && entry.universe >= 1
            && entries.findIndex((item) => item.universe === entry.universe) === index
          ))
          .slice(0, 64)
          .map((entry) => ({
            universe: entry.universe,
            updates: entry.updates.slice(0, 512).map(([channel, value]) => [
              Math.max(1, Math.min(512, Math.round(channel))),
              clampDmx(value)
            ] as DmxUpdate)
          }));
        return {
          timeMs: Math.max(0, Math.min(3_600_000, Math.round(frame.timeMs))),
          updates: universeUpdates.find((entry) => entry.universe === 1)?.updates ?? legacyUpdates,
          universeUpdates
        };
      })
    }))
  };
}
