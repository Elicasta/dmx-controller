import {pasteFixtures} from './lib/fixture-clipboard';
import {ManualOverdub,timelineCaptureClip,appendTimelineCapture} from './lib/timeline-capture';
import { cueContext, cueTargetIds } from './lib/show-selection';
import { mediaWindow, mediaPosition } from './lib/timeline-media';
import {exportTrimmedVideo} from './lib/video-export';
import {type TimelineMediaClip} from './lib/show-design';
import {activeVideoClip,videoDuration} from './lib/timeline-assets';
import {recordingSongVersion} from './lib/recording-version';
import {type MediaOutputFrame} from './components/MediaOutput';
import { fxLibrary } from './lib/fx-library';
import RecorderTransport from './components/RecorderTransport';
import { useEditHistory } from './lib/edit-history';
import TempoPulse from './components/TempoPulse';
import { useMediaOutputPublisher } from "./components/MediaOutput";
import { importSongProgram, readProgramState, replaceProgramState, saveProgramState, upsertSongProgram, validateProgramState, type Recovery } from './lib/program-storage';
import { extractSongProgram, insertSongProgram, isSongProgram, programId, type SongProgram } from './lib/song-library';
import SongBank from './components/SongBank';
import MediaLibraryPanel from './components/MediaLibraryPanel';
import { buildSong, songsForShow, renameSong, storeSongMedia, readSongMedia, type SongRecord } from './lib/song-bank';
import { waveformForBlob } from './lib/media-waveform';
import { analyzeTempo, correctedDownbeat } from './lib/tempo-analysis';
import { cancelPortableBackupRestore, collectMediaIds, commitPortableBackupRestore, countMediaIds, exportPortableBackup, exportPortablePackage, importPortableBackup, importPortablePackage, mediaNameForId, persistManagedMedia, readMediaAsset, readMediaLibrary, type MediaAsset } from './lib/media-library';
import ResizableWorkspace from './components/ResizableWorkspace';
import DraggablePanelDeck from './components/DraggablePanelDeck';
import StageMonitor, { openStageWindow, useStagePublisher } from './components/StageMonitor';
import Visualizer3D from './components/Visualizer3D';
import { StageMediaSurface, StageVideoInputError, requestStageVideoInputs, type StageVideoInputOption } from './components/StageMediaSurface';
import SongCueLibrary from './components/SongCueLibrary';
import { moveRundownItemCues } from './lib/show';
import { activeTimelineCueId, createSection, EMPTY_TIMELINE, FX_RECIPES, SHOW_COLORS, buildSectionCues, renderEffectStack, renderShowTimeline, isEffectRecipe, isShowSection, type EffectStackLayer, type ShowSection } from './lib/show-design';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { lumaVizDirectStatus, pollLumaVizDirectMessages, semanticFrameFromResolvedOutput, sendLumaVizDirectFrame, sendLumaVizDirectMessage, startLumaVizDirect, type LumaVizDirectStatus, type SharedShowPatchMutation } from './core/lumaviz-direct';
import type { SharedLocationPreset } from './core/shared-locations';
import { isSharedShowActivation } from './core/shared-show';
import { invoke } from '@tauri-apps/api/core';
import {
  applyUniverseUpdates,
  clampDmx,
  interpolateUniverse,
  makeUniverse,
  VISIBLE_CHANNELS,
  type DmxUpdate
} from './lib/dmx';
import { EFFECT_PRESETS, EFFECT_SHAPES, effectWaveValue, renderEffect, renderCustomEffect, type CustomEffect, type CustomEffectLane, type CustomEffectParameter, type EffectId, type EffectPreset, type EffectWaveform, type MotionShape } from './lib/effects';
import {
  DEFAULT_PATCH,
  FIXTURE_LIBRARY,
  findMode,
  findProfile,
  fixtureColorUpdates,
  fixtureEndAddress,
  fixtureParameterUpdate,
  fixtureTransform,
  isPatchDocument,
  isPatchedFixture,
  makePatchDocument,
  migratePatchedFixture,
  parameterChannel,
  readFixtureParameter,
  validatePatch,
  type FixtureParameter,
  type PatchedFixture
} from './lib/fixtures';
import {
  isFixtureLook,
  STARTER_LOOKS,
  type FixtureLook,
  type FixtureLookValues
} from './lib/looks';
import {
  applyLightingOffset,
  DEFAULT_EXTERNAL_TRACK_SYNC,
  cueChanges,
  diffUniverse,
  EMPTY_SHOW,
  isShowFile,
  MAX_RECORDING_FRAMES,
  midiSongPositionToMs,
  moveCue,
  removeCuePreservingTracking,
  resolveShowCueFrame,
  sanitizeShow,
  renumberCues,
  type CueTimingFamily,
  type CueTimingRule,
  type FixtureGroup,
  type PositionPalette,
  type ShowCue,
  type ShowFile,
  type ShowRecording,
  type ShowRecordingFrame
} from './lib/show';
import {
  assignFixturesToGroup,
  effectSupportedByFixtures,
  fixtureIntensityPercent,
  fixtureSupportsColor,
  fixturesInGroup,
  makeFixtureGroup,
  reconcileFixtureGroups,
  removeFixtureGroup,
  renameFixtureGroup
} from './core/console-domain';
import {
  ColorDeck,
  EffectsPanel,
  FixtureBrowser,
  LooksStrip,
  VerticalFader,
  compatibleColorFixtures,
  fixtureBrowserSubtitle
} from './components/ConsoleComponents';
import { DesktopLiveController } from './components/DesktopLiveController';
import './desktop-live-controller.css';
import FixtureFaderBank from './components/FixtureFaderBank';
import { loadSectionPresets } from './lib/section-presets';
import {
  STAGE_WAREHOUSE,
  clampStageElement,
  isStageDocument,
  isStageElement,
  makeStageDocument,
  makeStageWarehouseElement,
  migrateStageElement,
  stageElementPosition,
  type StageElement
} from './lib/stage';
import { STAGE_PRESETS, instantiateStagePreset, type StagePresetId } from './lib/stage-presets';
import {
  DEFAULT_MIDI_MAPPINGS,
  midiBindingLabel,
  midiValueToRange,
  sanitizeMidiMappings,
  type MidiAssignableControl,
  type MidiMapping,
  type MidiSourceKind
} from './lib/midi';
import { controlCommand, type ControlCommand, type ControlSource } from './core/control-command';
import { buildControlRegistry } from './core/control-registry';
import { solveFixtureCalibration } from './core/calibration';
import { intersectBeamWithStage } from './core/beam-intersection';
import { aimFixtureAtTarget, fixtureGeometryState, fixtureMovementUpdates } from './core/fixture-geometry';
import {
  DEFAULT_STAGE_DIMENSIONS,
  EMPTY_CALIBRATION,
  distance,
  displayToMeters,
  metersToDisplay,
  pointAlongRay,
  type CalibrationObservation,
  type StageDimensions,
  type StageUnit,
  type Vec3
} from './core/geometry';
import { CallbackOutputDriver, OutputRouter, VirtualOutputDriver } from './core/output-router';
import { ArtNetOutputDriver } from './core/artnet-output';
import { ShowRuntime, type RuntimeDispatchResult } from './core/show-runtime';
import { projectStagePoint, unprojectStagePoint, type StagePoint2D, type StageView } from './core/stage-projection';
import { arrangeTargetPoints, buildStageTargets, type TargetArrangement, type TargetPoint } from './core/targets';
import { cuePlaybackDuration, renderCueTimedFrame } from './core/cue-timing';
import { orderFixtures, type FixtureOrderMode } from './core/fixture-order';
import { phaserStepValue, type PhaserStep } from './core/phaser-engine';
import { makeSelectionGrid, moveFixtureInSelectionGrid, normalizeSelectionGrid, type SelectionGridTraversal } from './core/selection-grid';
import { RemoteRelay, type RelayCommandEnvelope, type RemoteRelayConfig, type RemoteRelayStatus } from './core/remote-relay';
import { desktopDeviceId } from './core/supabase-client';
import { StudioBridgeDispatcher } from './core/studio-bridge-dispatcher';
import { TransportEngine, type TransportSource, type TransportUpdate } from './core/transport-engine';
import { ConnectionManager, type ConnectionRecord } from './core/connection-manager';
import { lumaLivePositionMs, loadLumaLiveConnection, pairLumaLive, readLumaLiveState, saveLumaLiveConnection, scanLumaLive, sendLumaLiveCommand, type LumaLiveConnection, type LumaLiveEndpoint, type LumaLiveState } from './core/lumalive-client';
import { loadProPresenterUrl, proPresenterSummary, readProPresenterStatus, saveProPresenterUrl, sendProPresenterCommand, type ProPresenterStatus } from './core/propresenter-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  createCloudShowFolder,
  createControllerPairing,
  currentCloudAccount,
  fetchCloudRecordingLabels,
  fetchCloudShowLibrary,
  fetchCloudSongLibrary,
  listPairedControllers,
  registerCloudDesktop,
  revokePairedController,
  saveCloudRecordingLabel,
  saveCloudShow,
  saveCloudSong,
  signInCloudAccount,
  signOutCloudAccount,
  touchCloudDesktop,
  uploadCloudShowMedia,
  downloadCloudShowMedia,
  watchCloudLibrary,
  type CloudAccount,
  type CloudRecordingLabel,
  type CloudShowDocument,
  type CloudShowFolder,
  type CloudSongDocument,
  type ControllerPairingSession,
  type PairedController
} from './core/cloud-services';
import type { StudioBridgeCommand, StudioSongIdentity } from './core/studio-bridge-protocol';

const ShowCreator = lazy(() => import('./components/ShowCreator'));
const ShowTimelineEditor = lazy(() => import('./components/ShowTimelineEditor'));

type Workspace = 'build' | 'create' | 'show' | 'visualizer' | 'live';
type SetupView = 'fixtures' | 'groups' | 'stage' | 'settings';
type ProgramMode = 'stage' | 'looks' | 'fx' | 'colors' | 'media' | 'presets';
type ShowMode = 'songs' | 'creator' | 'cues' | 'timeline' | 'tracks' | 'media' | 'library' | 'sync' | 'recordings';
type LiveView = 'performance' | 'overrides' | 'groups' | 'masters' | 'shortcuts' | 'settings';
type LiveBank = 'fixtures' | 'groups';
type LivePaletteFamily = 'groups' | 'intensity' | 'position' | 'color' | 'beam' | 'fx';

type ShowProjectSnapshot = {
  id: string;
  name: string;
  savedAt: string;
  status: 'template' | 'draft' | 'show';
  templateId?: string;
  revision?: number;
  lastEditor?: 'lumarig' | 'lumaviz';
  cloudRevision?: number;
  cloudFolderId?: string | null;
  show: ShowFile;
  patch: PatchedFixture[];
  stageElements: StageElement[];
  stageSettings: StageSettings;
  looks: FixtureLook[];
};
type StageDesignerMode = 'select' | 'move' | 'rotate' | 'aim' | 'measure' | 'target' | 'patch';

function initialConsoleValue<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  let saved: string | null = null;
  try { saved = localStorage.getItem('lumarig-navigation:' + key); } catch { /* optional preference */ }
  const value = (new URLSearchParams(window.location.search).get(key) ?? saved) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

const STAGE_DESIGNER_MODES: Array<{ id: StageDesignerMode; label: string; hint: string }> = [
  { id: 'select', label: 'Select', hint: 'Select fixtures and stage objects.' },
  { id: 'move', label: 'Move', hint: 'Edit fixture and object X/Y/Z positions.' },
  { id: 'rotate', label: 'Rotate', hint: 'Edit fixture yaw, pitch, and roll.' },
  { id: 'aim', label: 'Aim', hint: 'Click a target to aim the selected moving fixtures.' },
  { id: 'measure', label: 'Measure', hint: 'Select a target to inspect throw distance and angles.' },
  { id: 'target', label: 'Target', hint: 'Inspect the reusable targets in this stage model.' },
  { id: 'patch', label: 'Patch', hint: 'Edit profile, universe, address, mounting, and mode.' }
];

type UdmxDeviceInfo = {
  device_key: string;
  bus: number;
  address: number;
  vid: number;
  pid: number;
  manufacturer?: string | null;
  product?: string | null;
  serial_number?: string | null;
  identity_verified: boolean;
  likely_udmx: boolean;
};

type DmxStatus = {
  connected: boolean;
  device_key?: string | null;
  device_name?: string | null;
  blackout: boolean;
  usb_writes: number;
  channels_sent: number;
  last_error?: string | null;
};

type MidiInputInfo = { id: number; name: string };
type MidiStatus = {
  connected: boolean;
  input_name?: string | null;
  messages_received: number;
  last_event?: string | null;
  last_error?: string | null;
};
type MidiEvent = {
  kind: 'note_on' | 'note_off' | 'control_change' | 'clock' | 'start' | 'continue' | 'stop' | 'song_position';
  channel?: number | null;
  number?: number | null;
  value?: number | null;
  song_position?: number | null;
  timestamp: number;
};
type AppSettings = {
  masterLimit: number;
  confirmBlackoutRelease: boolean;
  audioSensitivity: number;
  visualizerArtNetEnabled: boolean;
  visualizerArtNetTarget: string;
};

type UpdateMetadata = {
  version: string;
  currentVersion: string;
  notes?: string | null;
};
type UpdateStatus = 'idle' | 'checking' | 'available' | 'current' | 'installing' | 'error';
type StudioBridgeStatus = {
  listening: boolean;
  port: number;
  connectedClients: number;
  lastError?: string | null;
};

const STATUS_POLL_MS = 350;
const MIDI_POLL_MS = 35;
const FRAME_MS = 25;
const RECORDING_SAMPLE_MS = 50;
const LOOKS_STORAGE_KEY = 'dmx-controller.saved-looks.v1';
const CUSTOM_FX_STORAGE_KEY = 'dmx-controller.custom-fx.v1';
const SHOW_STORAGE_KEY = 'dmx-controller.show.v1';
const SHOW_BACKUP_STORAGE_KEY = 'dmx-controller.show.backup.v1';
const SHOW_LIBRARY_STORAGE_KEY = 'dmx-controller.show-library.v1';
const PATCH_STORAGE_KEY = 'dmx-controller.patch.v1';
const PATCH_BACKUP_STORAGE_KEY = 'dmx-controller.patch.backup.v1';
const MIDI_STORAGE_KEY = 'dmx-controller.midi-map.v1';
const SETTINGS_STORAGE_KEY = 'dmx-controller.settings.v1';
const STAGE_STORAGE_KEY = 'dmx-controller.stage-elements.v1';
const STAGE_BACKUP_STORAGE_KEY = 'dmx-controller.stage-elements.backup.v1';
const STAGE_SETTINGS_STORAGE_KEY = 'dmx-controller.stage-settings.v2';
const STAGE_PRESET_STORAGE_KEY = 'dmx-controller.stage-preset.v1';
const REMOTE_RELAY_STORAGE_KEY = 'dmx-controller.remote-relay.v1';
// Publishable Supabase credentials are safe to ship in desktop/web clients; RLS is the security boundary.
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jtvrrsyqvahslelpmtvv.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_mxvEMBRj6KAEBtS_N2uHaw_dXd5bMlj';
const REMOTE_APP_URL = import.meta.env.VITE_REMOTE_APP_URL || 'https://mycontroller-three.vercel.app';
const FADE_TIMES = [0, 500, 1000, 2000, 5000] as const;

const DEFAULT_SETTINGS: AppSettings = {
  masterLimit: 100,
  confirmBlackoutRelease: false,
  audioSensitivity: 58,
  visualizerArtNetEnabled: false,
  visualizerArtNetTarget: '127.0.0.1'
};

const COLOR_PRESETS = [
  ...SHOW_COLORS.map(c=>({name:c.name,rgb:hexToRgb(c.hex)})),
  { name: 'Red', rgb: [255, 0, 0] },
  { name: 'Amber', rgb: [255, 92, 0] },
  { name: 'Yellow', rgb: [255, 220, 0] },
  { name: 'Green', rgb: [0, 255, 70] },
  { name: 'Cyan', rgb: [0, 220, 255] },
  { name: 'Blue', rgb: [0, 70, 255] },
  { name: 'Magenta', rgb: [255, 0, 210] },
  { name: 'White', rgb: [255, 255, 255] }
] as const;

const MOVING_CONTROLS: ReadonlyArray<{ parameter: FixtureParameter; label: string }> = [
  { parameter: 'pan', label: 'Pan' },
  { parameter: 'panFine', label: 'Pan fine' },
  { parameter: 'tilt', label: 'Tilt' },
  { parameter: 'tiltFine', label: 'Tilt fine' },
  { parameter: 'movementSpeed', label: 'Movement speed' },
  { parameter: 'colorWheel', label: 'Color wheel' },
  { parameter: 'gobo', label: 'Gobo' },
  { parameter: 'focus', label: 'Focus' },
  { parameter: 'prism', label: 'Prism' },
  { parameter: 'strobe', label: 'Fixture strobe' }
];

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => clampDmx(value).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function percentToDmx(percent: number, limit = 100) {
  return clampDmx((Math.min(percent, limit) / 100) * 255);
}

function formatUsbId(value?: number | null) {
  return value == null ? '----' : value.toString(16).padStart(4, '0').toUpperCase();
}

function addressLabel(address: number) {
  return `A${String(address).padStart(3, '0')}`;
}

function formatShowTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function deviceLabel(device: UdmxDeviceInfo) {
  const name = device.product || 'uDMX-compatible USB device';
  const maker = device.manufacturer ? `${device.manufacturer} • ` : '';
  return `${device.identity_verified ? '✓ ' : '⚠ '}${name} • ${maker}USB ${formatUsbId(device.vid)}:${formatUsbId(device.pid)}`;
}

function lookSwatch(values: FixtureLookValues) {
  const color = values.red + values.green + values.blue > 0
    ? `rgb(${values.red} ${values.green} ${values.blue})`
    : 'rgb(112 62 255)';
  return `radial-gradient(circle at 36% 30%, ${color}, rgb(12 15 22) 72%)`;
}

function writeCompatibilityStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Transactional autosave reports durable save failures. */ }
}

function loadJson<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadSavedLooks(): FixtureLook[] {
  return loadJson<FixtureLook[]>(LOOKS_STORAGE_KEY, [], (value): value is FixtureLook[] => (
    Array.isArray(value) && value.every(isFixtureLook)
  )).slice(0, 24);
}

const CUSTOM_FX_LANE_PARAMETERS: readonly FixtureParameter[] = [
  'dimmer', 'pan', 'tilt', 'uv', 'strobe', 'zoom', 'iris', 'focus', 'gobo', 'colorWheel', 'prism'
];

function isPhaserStep(value: unknown): value is PhaserStep {
  if (!value || typeof value !== 'object') return false;
  const step = value as Partial<PhaserStep>;
  return typeof step.value === 'number'
    && Number.isFinite(step.value)
    && [step.width, step.transition, step.acceleration, step.deceleration]
      .every((part) => part === undefined || (typeof part === 'number' && Number.isFinite(part)));
}

function isCustomEffectLane(value: unknown): value is CustomEffectLane {
  if (!value || typeof value !== 'object') return false;
  const lane = value as Partial<CustomEffectLane>;
  return CUSTOM_FX_LANE_PARAMETERS.includes(lane.parameter as FixtureParameter)
    && ['sine', 'triangle', 'square', 'saw', 'reverse-saw', 'step'].includes(String(lane.waveform))
    && [lane.depth, lane.offset].every((part) => typeof part === 'number' && Number.isFinite(part))
    && [lane.phaseOffset, lane.rateMultiplier].every((part) => part === undefined || (typeof part === 'number' && Number.isFinite(part)))
    && (lane.mode === undefined || ['absolute', 'relative'].includes(String(lane.mode)))
    && (lane.steps === undefined || (Array.isArray(lane.steps) && lane.steps.every(isPhaserStep)));
}

function isCustomEffect(value: unknown): value is CustomEffect { return isEffectRecipe(value); }

function loadCustomEffects(): CustomEffect[] {
  return loadJson<CustomEffect[]>(CUSTOM_FX_STORAGE_KEY, [], (value): value is CustomEffect[] => (
    Array.isArray(value) && value.every(isCustomEffect)
  )).slice(0, 32);
}

function loadShowFile(): ShowFile {
  if (typeof window === 'undefined') return { ...EMPTY_SHOW, cues: [], groups: [], positionPalettes: [] };
  try {
    const raw = window.localStorage.getItem(SHOW_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw || 'null');
    if (isShowFile(parsed)) {
      if (parsed.version < 4 && raw && !window.localStorage.getItem(SHOW_BACKUP_STORAGE_KEY)) {
        writeCompatibilityStorage(SHOW_BACKUP_STORAGE_KEY, raw);
      }
      return sanitizeShow(parsed);
    }
  } catch { /* preserve the stored value and start with a known-good show */ }
  return { ...EMPTY_SHOW, cues: [], groups: [], positionPalettes: [] };
}

function isShowProjectSnapshot(item: unknown): item is ShowProjectSnapshot {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Partial<ShowProjectSnapshot>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.savedAt === 'string'
    && (candidate.status === 'template' || candidate.status === 'draft' || candidate.status === 'show')
    && (candidate.cloudRevision === undefined || (typeof candidate.cloudRevision === 'number' && Number.isFinite(candidate.cloudRevision)))
    && (candidate.cloudFolderId === undefined || candidate.cloudFolderId === null || typeof candidate.cloudFolderId === 'string')
    && Boolean(candidate.show && isShowFile(candidate.show))
    && Array.isArray(candidate.patch)
    && candidate.patch.every(isPatchedFixture)
    && Array.isArray(candidate.stageElements)
    && candidate.stageElements.every(isStageElement)
    && Array.isArray(candidate.looks)
    && candidate.looks.every(isFixtureLook)
    && Boolean(candidate.stageSettings && isStageSettings(candidate.stageSettings));
}

function loadShowLibrary(): ShowProjectSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SHOW_LIBRARY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isShowProjectSnapshot).slice(0, 40) : [];
  } catch {
    return [];
  }
}

type AppWorkspaceCheckpoint = {
  patch: PatchedFixture[]; stageElements: StageElement[]; stageSettings: StageSettings;
  looks: FixtureLook[]; customEffects: CustomEffect[]; projects: ShowProjectSnapshot[];
  midiMappings: MidiMapping[]; settings: AppSettings;
  tempo?: { bpm:number; locked:boolean };
  sectionPresets?: ShowSection[];
};
function isAppWorkspaceCheckpoint(value: unknown): value is AppWorkspaceCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const c = value as AppWorkspaceCheckpoint;
  return (c.tempo === undefined || (c.tempo && Number.isFinite(c.tempo.bpm) && c.tempo.bpm >= 20 && c.tempo.bpm <= 300 && typeof c.tempo.locked === 'boolean'))
    && (c.sectionPresets === undefined || (Array.isArray(c.sectionPresets) && c.sectionPresets.every(isShowSection)))
    && Array.isArray(c.patch) && c.patch.every(isPatchedFixture)
    && Array.isArray(c.stageElements) && c.stageElements.every(isStageElement) && isStageSettings(c.stageSettings)
    && Array.isArray(c.looks) && c.looks.every(isFixtureLook)
    && Array.isArray(c.customEffects) && c.customEffects.every(isCustomEffect)
    && Array.isArray(c.projects) && c.projects.every(p => p && typeof p.id === 'string' && typeof p.name === 'string'
      && typeof p.savedAt === 'string' && ['template','draft','show'].includes(p.status) && isShowFile(p.show)
      && Array.isArray(p.patch) && p.patch.every(isPatchedFixture) && Array.isArray(p.stageElements)
      && p.stageElements.every(isStageElement) && isStageSettings(p.stageSettings) && Array.isArray(p.looks) && p.looks.every(isFixtureLook))
    && Array.isArray(c.midiMappings) && c.midiMappings.every(m => m && typeof m.id === 'string' && typeof m.target === 'string'
      && (m.kind === null || m.kind === 'note' || m.kind === 'cc')
      && (m.channel === null || Number.isFinite(m.channel)) && (m.number === null || Number.isFinite(m.number)))
    && !!c.settings && Object.entries(DEFAULT_SETTINGS).every(([key, fallback]) => {
      const part = c.settings[key as keyof AppSettings];
      return typeof part === typeof fallback && (typeof part !== 'number' || Number.isFinite(part));
    });
}

/** Validate the app checkpoint before committing it, as well as on restart. */
async function saveAppProgramState(show: ShowFile, options: Parameters<typeof saveProgramState>[1] = {}) {
  if (options?.workspace && !isAppWorkspaceCheckpoint(options.workspace)) throw Error('Workspace save failed validation. Your previous saved work is intact.');
  if (options?.recoverWorkspace && !isAppWorkspaceCheckpoint(options.recoverWorkspace)) throw Error('Recovery save failed validation. Your previous saved work is intact.');
  return saveProgramState(show, options);
}

function loadPatch(): PatchedFixture[] {
  if (typeof window === 'undefined') return DEFAULT_PATCH;
  try {
    const raw = window.localStorage.getItem(PATCH_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw || 'null');
    if (isPatchDocument(parsed)) {
      return parsed.fixtures.map((fixture, index) => migratePatchedFixture(fixture, index, parsed.fixtures.length));
    }
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPatchedFixture)) {
      if (raw && !window.localStorage.getItem(PATCH_BACKUP_STORAGE_KEY)) {
        writeCompatibilityStorage(PATCH_BACKUP_STORAGE_KEY, raw);
      }
      return parsed.map((fixture, index) => migratePatchedFixture(fixture, index, parsed.length));
    }
  } catch { /* use the known-good starter patch */ }
  return DEFAULT_PATCH.map((fixture, index) => migratePatchedFixture(fixture, index, DEFAULT_PATCH.length));
}

type StageSettings = { schemaVersion: 2; unit: StageUnit; dimensions: StageDimensions };

function isStageSettings(value: unknown): value is StageSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<StageSettings>;
  const dimensions = settings.dimensions as Partial<StageDimensions> | undefined;
  return settings.schemaVersion === 2
    && (settings.unit === 'feet' || settings.unit === 'meters')
    && Boolean(dimensions)
    && [dimensions?.width, dimensions?.depth, dimensions?.height, dimensions?.roomWidth, dimensions?.roomDepth, dimensions?.roomHeight]
      .every((part) => typeof part === 'number' && Number.isFinite(part) && part > 0)
    && typeof dimensions?.trimHeight === 'number' && Number.isFinite(dimensions.trimHeight) && dimensions.trimHeight >= 0;
}

function loadStageSettings(): StageSettings {
  return loadJson<StageSettings>(STAGE_SETTINGS_STORAGE_KEY, {
    schemaVersion: 2,
    unit: 'feet',
    dimensions: DEFAULT_STAGE_DIMENSIONS
  }, isStageSettings);
}

function loadMidiMappings(): MidiMapping[] {
  if (typeof window === 'undefined') return DEFAULT_MIDI_MAPPINGS.map((mapping) => ({ ...mapping }));
  try { return sanitizeMidiMappings(JSON.parse(window.localStorage.getItem(MIDI_STORAGE_KEY) || 'null')); }
  catch { return DEFAULT_MIDI_MAPPINGS.map((mapping) => ({ ...mapping })); }
}

function loadSettings(): AppSettings {
  const value = loadJson<Partial<AppSettings>>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS, (item): item is Partial<AppSettings> => (
    Boolean(item) && typeof item === 'object'
  ));
  return { ...DEFAULT_SETTINGS, ...value };
}

function loadRemoteRelayConfig(): RemoteRelayConfig {
  const fallback: RemoteRelayConfig = {
    url: DEFAULT_SUPABASE_URL,
    publishableKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
    email: '',
    roomCode: '',
    password: '',
  };
  const value = loadJson<Partial<RemoteRelayConfig>>(REMOTE_RELAY_STORAGE_KEY, fallback, (item): item is Partial<RemoteRelayConfig> => (
    Boolean(item) && typeof item === 'object'
  ));
  return { ...fallback, ...value, password: '' };
}

function loadStageElements(): StageElement[] {
  if (typeof window === 'undefined') return [];
  const dimensions = loadStageSettings().dimensions;
  try {
    const raw = window.localStorage.getItem(STAGE_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw || 'null');
    if (isStageDocument(parsed)) return parsed.elements.map((element) => migrateStageElement(element, dimensions));
    if (Array.isArray(parsed) && parsed.every(isStageElement)) {
      if (raw && !window.localStorage.getItem(STAGE_BACKUP_STORAGE_KEY)) {
        writeCompatibilityStorage(STAGE_BACKUP_STORAGE_KEY, raw);
      }
      return parsed.map((element) => migrateStageElement(element, dimensions));
    }
  } catch { /* preserve the original key and start with an empty stage */ }
  return [];
}

function selectedFixtures(patch: readonly PatchedFixture[]) {
  return patch.filter((fixture) => fixture.selected);
}

function fixtureValues(universe: readonly number[], fixture?: PatchedFixture): FixtureLookValues {
  if (!fixture) return { red: 0, green: 0, blue: 0, uv: 0, dimmer: 0 };
  return {
    red: readFixtureParameter(universe, fixture, 'red'),
    green: readFixtureParameter(universe, fixture, 'green'),
    blue: readFixtureParameter(universe, fixture, 'blue'),
    uv: readFixtureParameter(universe, fixture, 'uv'),
    dimmer: readFixtureParameter(universe, fixture, 'dimmer')
  };
}

function lookUpdates(look: FixtureLookValues, fixtures: readonly PatchedFixture[]): DmxUpdate[] {
  return fixtures.flatMap((fixture) => (
    [
      fixtureParameterUpdate(fixture, 'red', look.red),
      fixtureParameterUpdate(fixture, 'green', look.green),
      fixtureParameterUpdate(fixture, 'blue', look.blue),
      fixtureParameterUpdate(fixture, 'uv', look.uv),
      fixtureParameterUpdate(fixture, 'dimmer', look.dimmer)
    ].filter((update): update is DmxUpdate => Boolean(update))
  ));
}

function FixturePatchEditor({ fixture, onSave, onRemove, onToggleSelected, onToggleCollapsed }: {
  fixture: PatchedFixture;
  onSave: (fixture: PatchedFixture) => void;
  onRemove: () => void;
  onToggleSelected: () => void;
  onToggleCollapsed: () => void;
}) {
  const [draft, setDraft] = useState(fixture);
  useEffect(() => setDraft(fixture), [fixture]);
  const profile = findProfile(draft.profileId);
  const mode = findMode(draft);
  return (
    <article className={`patch-card ${fixture.selected ? 'selected' : ''}`} style={{ borderLeftColor: fixture.labelColor ?? '#586473' }}>
      <header className="patch-card-header">
        <button className="select-light" aria-pressed={fixture.selected} onClick={onToggleSelected}><span /> {fixture.selected ? 'Selected' : 'Select'}</button>
        <div className="patch-title"><strong>{fixture.name}</strong><small>{profile?.manufacturer} {profile?.model} • {addressLabel(fixture.address)}–{String(fixtureEndAddress(fixture)).padStart(3, '0')}</small></div>
        <span className={`profile-badge ${profile?.verified ? 'verified' : ''}`}>{profile?.verified ? 'Verified' : 'Check manual'}</span>
        <button className="collapse-button" onClick={onToggleCollapsed}>{fixture.collapsed ? 'Expand' : 'Collapse'}</button>
      </header>
      {!fixture.collapsed && (
        <div className="patch-card-body">
          <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label><span>Group</span><input value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value })} /></label>
          <label><span>Mode</span><select value={draft.modeId} onChange={(event) => setDraft({ ...draft, modeId: event.target.value })}>{profile?.modes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>DMX address</span><input type="number" min="1" max="512" value={draft.address} onChange={(event) => setDraft({ ...draft, address: Number(event.target.value) })} /></label>
          <label><span>Stage X</span><input type="number" min="5" max="95" value={Math.round(draft.stageX ?? 50)} onChange={(event) => setDraft({ ...draft, stageX: Number(event.target.value) })} /></label>
          <label><span>Stage height</span><input type="number" min="5" max="65" value={Math.round(draft.stageY ?? 14)} onChange={(event) => setDraft({ ...draft, stageY: Number(event.target.value) })} /></label>
          <label className="patch-label-color"><span>Label color</span><input type="color" value={draft.labelColor ?? '#55d982'} onChange={(event) => setDraft({ ...draft, labelColor: event.target.value })} /></label>
          <div className="patch-footprint"><span>Footprint</span><strong>{mode?.channelCount ?? 0} channels</strong></div>
          <div className="patch-card-actions"><button className="primary" onClick={() => onSave(draft)}>Apply patch</button><button className="secondary danger-outline" onClick={onRemove}>Remove</button></div>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => initialConsoleValue('workspace', ['build', 'create', 'show', 'visualizer', 'live'], 'create'));
  const [setupView, setSetupView] = useState<SetupView>(() => initialConsoleValue('setup', ['fixtures', 'groups', 'stage', 'settings'], 'stage'));
  const [programMode, setProgramMode] = useState<ProgramMode>(() => initialConsoleValue('program', ['stage', 'looks', 'fx', 'colors', 'media', 'presets'], 'stage'));
  const [programStageView, setProgramStageView] = useState<'visualizer' | 'plot'>('visualizer');
  const [visualizerToolsOpen, setVisualizerToolsOpen] = useState(false);
  const [showMode, setShowMode] = useState<ShowMode>(() => initialConsoleValue('show', ['songs', 'creator', 'cues', 'timeline', 'tracks', 'media', 'library', 'sync', 'recordings'], 'cues'));
  const [liveView, setLiveView] = useState<LiveView>(() => initialConsoleValue('live', ['performance', 'overrides', 'groups', 'masters', 'shortcuts', 'settings'], 'performance'));
  useEffect(() => { try { for (const [key,value] of Object.entries({workspace,setup:setupView,program:programMode,show:showMode,live:liveView})) writeCompatibilityStorage('lumarig-navigation:' + key, value); } catch { /* optional preferences */ } }, [workspace,setupView,programMode,showMode,liveView]);
  const [fixtureSearch, setFixtureSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [universe, setUniverse] = useState<number[]>(makeUniverse);
  const universeRef = useRef<number[]>(makeUniverse());
  const [outputUniverse, setOutputUniverse] = useState<number[]>(makeUniverse);
  const outputUniverseRef = useRef<number[]>(makeUniverse());
  const [patch, setPatch] = useState<PatchedFixture[]>(loadPatch);
  const patchRef = useRef(patch);
  const [sectionPresets, setSectionPresets] = useState(loadSectionPresets);
  const [savedLooks, setSavedLooks] = useState<FixtureLook[]>(loadSavedLooks);
  const [showFile, setShowFile] = useState<ShowFile>(loadShowFile);
  const [songLibrary, setSongLibrary] = useState<SongProgram[]>([]);
  const [showRecovery, setShowRecovery] = useState<Recovery[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryOpening, setLibraryOpening] = useState(true);
  const [saveStatus, setSaveStatus] = useState('Opening Song Library…');
  const [transitionBusy, setTransitionBusy] = useState(false);
  const transitionRef = useRef(false);
  const showFileRef = useRef(showFile);
  showFileRef.current = showFile;
  const saveSequence = useRef(0);
  const [showLibrary, setShowLibrary] = useState<ShowProjectSnapshot[]>(loadShowLibrary);
  const [cloudFolders, setCloudFolders] = useState<CloudShowFolder[]>([]);
  const [cloudShows, setCloudShows] = useState<CloudShowDocument[]>([]);
  const [cloudFolderId, setCloudFolderId] = useState('');
  const [cloudFolderName, setCloudFolderName] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'offline' | 'loading' | 'synced' | 'error'>('offline');
  const [cloudError, setCloudError] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [liveBank, setLiveBank] = useState<LiveBank>('fixtures');
  const [liveProgrammerOpen, setLiveProgrammerOpen] = useState(false);
  const [livePaletteFamily, setLivePaletteFamily] = useState<LivePaletteFamily>('groups');
  const buskLayerRef = useRef<Map<number, number>>(new Map());
  const [buskActive, setBuskActive] = useState(false);
  const [buskChannelCount, setBuskChannelCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  const [artNetTelemetry, setArtNetTelemetry] = useState({ framesSent: 0, lastError: "" });
  const [directStatus, setDirectStatus] = useState<LumaVizDirectStatus>({ listening: false, port: 9460, clients: 0, framesSent: 0 });
  const [lumaVizPreview, setLumaVizPreview] = useState<{ dataUrl: string; timestamp: number; view?: string } | null>(null);
  const transportEngineRef = useRef<TransportEngine | null>(null);
  if (!transportEngineRef.current) transportEngineRef.current = new TransportEngine({ bpm: 120 });

  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  if (!connectionManagerRef.current) {
    const manager = new ConnectionManager();
    manager.upsert({ id:'studio', kind:'studio', name:'LumaStudio', status:'off', capabilities:['transport','show-control','recording'] });
    manager.upsert({ id:'midi', kind:'midi', name:'MIDI / DAW', status:'off', capabilities:['clock','transport','controls'] });
    manager.upsert({ id:'ableton', kind:'ableton', name:'Ableton Live', status:'off', capabilities:['transport','tempo','song-position'] });
    manager.upsert({ id:'lumalive', kind:'lumalive', name:'LumaLive', status:'off', capabilities:['transport','song-recall','performance'] });
    manager.upsert({ id:'propresenter', kind:'propresenter', name:'ProPresenter', status:'off', capabilities:['cue-trigger','transport','media'] });
    connectionManagerRef.current = manager;
  }
  const [sharedTransport, setSharedTransport] = useState(() => transportEngineRef.current!.snapshot());
  const [connectionRecords, setConnectionRecords] = useState<ConnectionRecord[]>(() => connectionManagerRef.current!.snapshot());
  const refreshConnectionRecords = () => setConnectionRecords(connectionManagerRef.current!.snapshot());
  const [lumaLiveConnection, setLumaLiveConnection] = useState<LumaLiveConnection | null>(loadLumaLiveConnection);
  const [lumaLiveEndpoint, setLumaLiveEndpoint] = useState<LumaLiveEndpoint | null>(null);
  const [lumaLivePairCode, setLumaLivePairCode] = useState('');
  const [lumaLiveState, setLumaLiveState] = useState<LumaLiveState | null>(null);
  const [lumaLiveBusy, setLumaLiveBusy] = useState(false);
  const [lumaLiveError, setLumaLiveError] = useState('');
  const lumaLiveLastPositionRef = useRef(0);
  const [proPresenterUrl, setProPresenterUrl] = useState(loadProPresenterUrl);
  const [proPresenterStatus, setProPresenterStatus] = useState<ProPresenterStatus | null>(null);
  const [proPresenterWatching, setProPresenterWatching] = useState(false);
  const [proPresenterBusy, setProPresenterBusy] = useState(false);
  const [proPresenterError, setProPresenterError] = useState('');

  const [studioBridgeStatus, setStudioBridgeStatus] = useState<StudioBridgeStatus>({ listening: false, port: 47777, connectedClients: 0 });
  useEffect(() => {
    const refresh = () => {
      void invoke<StudioBridgeStatus>('studio_bridge_status')
        .then((status) => {
          setStudioBridgeStatus(status);
          connectionManagerRef.current!.upsert({
            id:'studio',
            kind:'studio',
            name:'LumaStudio',
            status: status.lastError ? 'error' : status.connectedClients > 0 ? 'connected' : status.listening ? 'connecting' : 'off',
            capabilities:['transport','show-control','recording'],
            lastSeenAt: status.connectedClients > 0 ? Date.now() : null,
            lastError: status.lastError ?? '',
            detail: status.connectedClients > 0 ? `${status.connectedClients} client${status.connectedClients === 1 ? '' : 's'} · ws://127.0.0.1:${status.port}` : `Listening on ${status.port}`
          });
          refreshConnectionRecords();
        })
        .catch((error) => {
          const message=String(error);
          setStudioBridgeStatus((current) => ({ ...current, lastError: message }));
          connectionManagerRef.current!.fail('studio',message);
          refreshConnectionRecords();
        });
    };
    refresh();
    const timer = window.setInterval(refresh, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const sharedShowRevisionRef = useRef(1);
  const [activeLocation, setActiveLocation] = useState<{id:string;name:string;estimated:boolean}|null>(null);
  const directSequenceRef = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void pollLumaVizDirectMessages().then((messages) => {
        for (const message of messages) {
          if (!message || typeof message !== 'object') continue;
          if ((message as { type?: string }).type === 'preview-frame') {
            const frame = message as { dataUrl?: unknown; timestamp?: unknown; view?: unknown };
            if (typeof frame.dataUrl === 'string' && frame.dataUrl.startsWith('data:image/')) {
              setLumaVizPreview({
                dataUrl: frame.dataUrl,
                timestamp: typeof frame.timestamp === 'number' ? frame.timestamp : Date.now(),
                view: typeof frame.view === 'string' ? frame.view : undefined
              });
            }
            continue;
          }
          if (isSharedShowActivation(message)) {
            sharedShowRevisionRef.current = Math.max(sharedShowRevisionRef.current, message.revision);
            const match = showLibrary.find((item) => item.id === message.showId);
            if (match) { loadShowProject(match); setMessage(`${match.name} loaded from Shared Show Library · outputs unchanged.`); }
            else { setMessage(`Shared show ${message.showId} requested but no matching LumaRig document is stored locally.`); }
            continue;
          }
          if ((message as { type?: string }).type === 'shared-location.update') {
            const incoming = message as { revision?:number; location?:SharedLocationPreset };
            if (incoming.location) {
              setActiveLocation({id:incoming.location.id,name:incoming.location.name,estimated:incoming.location.estimated});
              sharedShowRevisionRef.current = Math.max(sharedShowRevisionRef.current, incoming.revision ?? sharedShowRevisionRef.current);
              setMessage(`Location loaded from LumaViz: ${incoming.location.name}${incoming.location.estimated ? ' · estimated geometry' : ''}`);
            }
            continue;
          }
          if ((message as { type?: string }).type !== 'shared-show.patch.update') continue;
          const mutation = message as SharedShowPatchMutation;
          if (mutation.source !== 'lumaviz') continue;
          if (mutation.revision <= sharedShowRevisionRef.current) {
            void sendLumaVizDirectMessage({ type: 'shared-show.conflict', accepted: false, revision: sharedShowRevisionRef.current, reason: 'stale-revision' });
            continue;
          }
          setPatch((current) => {
            const index = current.findIndex((fixture) => fixture.id === mutation.fixture.id);
            if (index < 0) return current;
            const existing = current[index];
            const candidate = migratePatchedFixture({
              ...existing,
              name: mutation.fixture.name || existing.name,
              profileId: mutation.fixture.profileId,
              modeId: mutation.fixture.modeId,
              universe: mutation.fixture.universe,
              address: mutation.fixture.address,
              group: mutation.fixture.group ?? existing.group,
              transform: mutation.fixture.position && mutation.fixture.rotation ? {
                position: mutation.fixture.position,
                rotation: { yaw: mutation.fixture.rotation.y, pitch: mutation.fixture.rotation.x, roll: mutation.fixture.rotation.z }
              } : existing.transform
            }, index, current.length, stageSettings.dimensions);
            const error = validatePatch(candidate, current);
            if (error) { setMessage(`LumaViz patch rejected: ${error}`); return current; }
            sharedShowRevisionRef.current = mutation.revision;
            setMessage(`${candidate.name} updated from LumaViz · shared revision ${sharedShowRevisionRef.current}.`);
            return current.map((fixture) => fixture.id === candidate.id ? candidate : fixture);
          });
        }
      }).catch(() => {});
    }, 150);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!directStatus.clients) return;
    void sendLumaVizDirectMessage({
      type: 'shared-show.snapshot',
      revision: sharedShowRevisionRef.current,
      source: 'lumarig',
      show: { id: showFile.name, name: showFile.name, location: activeLocation },
      patch: patch.map((fixture) => ({
        id: fixture.id, name: fixture.name, profileId: fixture.profileId, modeId: fixture.modeId,
        universe: fixture.universe ?? 1, address: fixture.address, group: fixture.group,
        transform: fixture.transform
      })),
      library: showLibrary.map((item) => ({ id: item.id, name: item.name, savedAt: item.savedAt, status: item.status }))
    });
  }, [patch, showFile.name, showLibrary, directStatus.clients, activeLocation]);

  const [remoteRelayConfig, setRemoteRelayConfig] = useState<RemoteRelayConfig>(loadRemoteRelayConfig);
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null);
  const [cloudLoginEmail, setCloudLoginEmail] = useState(() => loadRemoteRelayConfig().email);
  const [cloudLoginPassword, setCloudLoginPassword] = useState('');
  const [cloudAccountBusy, setCloudAccountBusy] = useState(false);
  const [cloudSongDocuments, setCloudSongDocuments] = useState<CloudSongDocument[]>([]);
  const [cloudRecordingLabels, setCloudRecordingLabels] = useState<CloudRecordingLabel[]>([]);
  const cloudLibraryUnsubscribeRef = useRef<(() => void) | null>(null);
  const [remoteRelayStatus, setRemoteRelayStatus] = useState<RemoteRelayStatus>('disconnected');
  const [remoteRelayError, setRemoteRelayError] = useState('');
  const [pairingSession, setPairingSession] = useState<ControllerPairingSession | null>(null);
  const [pairingNow, setPairingNow] = useState(Date.now());
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairedControllers, setPairedControllers] = useState<PairedController[]>([]);
  const [pairedControllersError, setPairedControllersError] = useState('');
  const remoteRelayRef = useRef<RemoteRelay | null>(null);
  const remoteCommandHandlerRef = useRef<((envelope: RelayCommandEnvelope) => void) | null>(null);
  const remoteSnapshotHandlerRef = useRef<(() => void) | null>(null);
  const remotePublishTimerRef = useRef<number | null>(null);
  const remoteFlashLeaseRef = useRef<Map<string, number>>(new Map());
  const remoteEffectLeaseRef = useRef<Map<string, number>>(new Map());
  if (!remoteRelayRef.current) remoteRelayRef.current = new RemoteRelay();
  const pairingSecondsRemaining = pairingSession
    ? Math.max(0, Math.ceil((new Date(pairingSession.expiresAt).getTime() - pairingNow) / 1000))
    : 0;
  useEffect(() => {
    if (!pairingSession) return;
    setPairingNow(Date.now());
    const timer = window.setInterval(() => setPairingNow(Date.now()), 1000);
    const devicesTimer = window.setInterval(() => { void refreshPairedControllerList(); }, 3000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(devicesTimer);
    };
  }, [pairingSession]);
  useEffect(() => {
    let active = true;
    void currentCloudAccount(remoteRelayConfig).then(async (account) => {
      if (!active || !account) return;
      const nextConfig: RemoteRelayConfig = {
        ...remoteRelayConfig,
        email: account.email,
        roomCode: remoteRelayConfig.roomCode || (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')),
        password: '',
      };
      await registerCloudDesktop(nextConfig).catch(() => {});
      if (!active) return;
      setCloudAccount(account);
      setCloudLoginEmail(account.email);
      setRemoteRelayConfig(nextConfig);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cloudAccount) return;
    let disposed = false;
    void refreshCloudAccountLibrary();
    void watchCloudLibrary(remoteRelayConfig, () => { if (!disposed) void refreshCloudAccountLibrary(); })
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else {
          cloudLibraryUnsubscribeRef.current?.();
          cloudLibraryUnsubscribeRef.current = unsubscribe;
        }
      })
      .catch((error) => setCloudError(error instanceof Error ? error.message : String(error)));
    return () => {
      disposed = true;
      cloudLibraryUnsubscribeRef.current?.();
      cloudLibraryUnsubscribeRef.current = null;
    };
  }, [cloudAccount?.userId, remoteRelayConfig.url, remoteRelayConfig.publishableKey]);

  useEffect(() => {
    if (remoteRelayStatus !== 'connected') return;
    void refreshCloudLibrary();
    void refreshPairedControllerList();
    void refreshCloudAccountLibrary();
  }, [remoteRelayStatus]);
  useEffect(() => {
    if (!cloudAccount || remoteRelayStatus !== 'disconnected' || !remoteRelayConfig.roomCode) return;
    void connectRemoteRelay();
  }, [cloudAccount?.userId, remoteRelayConfig.roomCode]);
  const [message, setMessage] = useState('Control station ready. Connect DMX when you want physical output.');
  const [appVersion, setAppVersion] = useState('0.2.7');
  useEffect(() => {
    if (!cloudAccount) return;
    void registerCloudDesktop(remoteRelayConfig, appVersion).catch(() => {});
    const timer = window.setInterval(() => { void touchCloudDesktop(remoteRelayConfig).catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, [cloudAccount?.userId, remoteRelayConfig.url, remoteRelayConfig.publishableKey, appVersion]);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateMetadata | null>(null);
  const [updateError, setUpdateError] = useState('');

  const [devices, setDevices] = useState<UdmxDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [dmxStatus, setDmxStatus] = useState<DmxStatus>({ connected: false, blackout: false, usb_writes: 0, channels_sent: 0 });
  // The runtime is the authoritative programmed blackout state. Hardware status
  // is still polled separately, but a delayed USB status refresh must not make
  // editor/Visualizer previews latch black.
  const [runtimeBlackout, setRuntimeBlackout] = useState(false);
  const dmxConnectedRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const [fadeMs, setFadeMs] = useState(1000);
  const [isFading, setIsFading] = useState(false);
  const fadeAnimationRef = useRef<number | null>(null);
  const fadeLastFrameRef = useRef(0);
  const [lookName, setLookName] = useState('');
  const [globalColor, setGlobalColor] = useState('#ff5618');
  const [globalMaster, setGlobalMaster] = useState(100);

  const [activeEffect, setActiveEffect] = useState<EffectId | null>(null);
  const activeEffectRef = useRef<EffectId | null>(null);
  const [activeCustomEffectId, setActiveCustomEffectId] = useState<string | null>(null);
  const activeCustomEffectIdRef = useRef<string | null>(null);
  const [customEffects, setCustomEffects] = useState<CustomEffect[]>(loadCustomEffects);
  const [fxEditor, setFxEditor] = useState<CustomEffect>({
    id: 'custom-preview',
    name: 'New FX',
    parameter: 'dimmer',
    waveform: 'sine',
    bpm: 100,
    depth: 100,
    phaseSpread: 0,
    offset: 0,
    orderMode: 'forward',
    blocks: 1,
    groups: 1,
    wings: 1,
    shift: 0,
    direction: 'forward',
    cycleBeats: 1,
    mode: 'absolute'
  });
  const [selectedFxBankId, setSelectedFxBankId] = useState<string>('pulse');
  const effectTargetIdsRef = useRef<string[]>([]);
  const effectAnimationRef = useRef<number | null>(null);
  const effectStartedRef = useRef(0);
  const effectBaseUniverseRef = useRef<number[]>(makeUniverse());
  const momentaryEffectRef = useRef<{ effect: EffectId } | null>(null);
  const [effectBpm, setEffectBpm] = useState(120);
  const [effectDepth, setEffectDepth] = useState(100);
  const effectBpmRef = useRef(effectBpm);
  const effectDepthRef = useRef(effectDepth);
  const [tempoSource, setTempoSource] = useState<'manual' | 'midi'>('manual');
  const tempoSourceRef = useRef<'manual' | 'midi'>('manual');
  const [tempoLocked, setTempoLocked] = useState(true);
  const tempoLockedRef = useRef(true);
  const [midiBpm, setMidiBpm] = useState<number | null>(null);
  const masterTempoBpm = !tempoLocked && tempoSource === 'midi' && midiBpm ? midiBpm : effectBpm;
  const midiBpmRef = useRef<number | null>(null);
  const midiClockTimesRef = useRef<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);

  const [cueName, setCueName] = useState('');
  const [cueFadeMs, setCueFadeMs] = useState(1000);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [activeTimelineClipId, setActiveTimelineClipId] = useState('');
  const activeTimelineClipRef = useRef('');
  const [timelinePositionBar, setTimelinePositionBar] = useState(0);
  const timelinePositionRef = useRef(0);
  const timelineHeldFrame = useRef<number[] | null>(null);
  const cueLaunchGeneration = useRef(0);
  const timelineContextCueRef = useRef('');
  const timelineUiTimeRef = useRef(0);
  const cueFollowTimerRef = useRef<number | null>(null);

  const [showTrackUrl, setShowTrackUrl] = useState('');
  const showTrackUrlRef = useRef('');
  const [showTrackName, setShowTrackName] = useState('');
  const [showTrackDurationMs, setShowTrackDurationMs] = useState(0);
  const [showTrackPositionMs, setShowTrackPositionMs] = useState(0);
  const showTrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoOutputOverrideRef=useRef<MediaOutputFrame|null>(null);
  const timelinePlayingRef=useRef(false);
  const [timelinePlaying,setTimelinePlaying]=useState(false);
  const videoAssetsRef=useRef<Map<string,string>>(new Map());
  useMediaOutputPublisher(showTrackAudioRef, showTrackUrl, showTrackName,videoOutputOverrideRef);
  const cueLaunchGenerationRef = useRef(0);
  const timelineBaseRef = useRef<number[] | null>(null);
  const timelineRecordingOrigin=useRef<{id:string;startBar:number;barMs:number;timeline:typeof EMPTY_TIMELINE;cues:ShowCue[];overdub:boolean;sourceStartMs:number;leadInMs:number;sourceEndMs:number;audioStarted:boolean;manual:ManualOverdub}|null>(null);
  const [recordingTakeName, setRecordingTakeName] = useState('');
  const [showRecordingActive, setShowRecordingActive] = useState(false);
  const showRecordingActiveRef = useRef(false);
  const [recordingPaused,setRecordingPaused]=useState(false);
  const recordingPausedRef=useRef(false);
  const recordingPausedAt=useRef(0);
  const recordingElapsedRef=useRef(0);
  const [selectedRecordingId,setSelectedRecordingId]=useState('');
  const pausedTakeRef=useRef<{id:string;position:number}|null>(null);
  const [showRecordingElapsedMs, setShowRecordingElapsedMs] = useState(0);
  const showRecordingStartedRef = useRef(0);
  const showRecordingLastSampleRef = useRef(0);
  const showRecordingFramesRef = useRef<ShowRecordingFrame[]>([]);
  const showRecordingLastUniverseRef = useRef<number[]>(makeUniverse());
  const showRecordingAnimationRef = useRef<number | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const playingRecordingIdRef = useRef<string | null>(null);
  const recordingPlaybackStartedRef = useRef(0);
  const recordingPlaybackLastUiRef = useRef(0);
  const recordingPlaybackIndexRef = useRef(0);
  const recordingPlaybackUniverseRef = useRef<number[]>(makeUniverse());
  const recordingPlaybackAnimationRef = useRef<number | null>(null);
  const recordingPlaybackExternalRef = useRef(false);
  const [externalTransportRunning, setExternalTransportRunning] = useState(false);
  const externalTransportRunningRef = useRef(false);
  const [externalSongPositionMs, setExternalSongPositionMs] = useState(0);
  const externalSongPositionMsRef = useRef(0);
  const externalClockUiTicksRef = useRef(0);
  const externalLightingOffsetRef = useRef(0);

  function applySharedTransport(update: TransportUpdate, now = performance.now()) {
    const result = transportEngineRef.current!.apply(update, now);
    if (!result.accepted) return result;
    const state = result.state;
    setSharedTransport(state);
    externalSongPositionMsRef.current = state.positionMs;
    externalTransportRunningRef.current = state.playing;
    setExternalSongPositionMs(state.positionMs);
    setExternalTransportRunning(state.playing);
    if (update.bpm != null && !tempoLockedRef.current) {
      if (update.source === 'midi') {
        setMidiBpm(state.bpm);
        midiBpmRef.current = state.bpm;
        setTempoSource('midi');
        tempoSourceRef.current = 'midi';
      } else {
        setEffectBpm(state.bpm);
        effectBpmRef.current = state.bpm;
      }
    }
    return result;
  }

  function releaseSharedTransport(source: TransportSource, positionMs = externalSongPositionMsRef.current) {
    return applySharedTransport({
      source,
      playing:false,
      positionMs,
      release:true
    });
  }

  async function detectLumaLive() {
    setLumaLiveBusy(true);
    setLumaLiveError('');
    try {
      const endpoint=await scanLumaLive();
      setLumaLiveEndpoint(endpoint);
      if(endpoint){
        connectionManagerRef.current!.upsert({
          id:'lumalive',kind:'lumalive',name:'LumaLive',status:lumaLiveConnection?'connected':'connecting',
          capabilities:['transport','song-recall','performance'],lastSeenAt:Date.now(),
          detail:`v${endpoint.version} · ${endpoint.baseUrl}`
        });
        refreshConnectionRecords();
        setMessage(lumaLiveConnection?'LumaLive detected. Checking paired transport…':'LumaLive detected. Enter its six-digit pairing code.');
      }else{
        connectionManagerRef.current!.disconnect('lumalive','LumaLive not detected on this computer');
        connectionManagerRef.current!.disconnect('ableton','Waiting for LumaLive');
        refreshConnectionRecords();
        setMessage('LumaLive was not found on this computer. Open LumaLive, then scan again.');
      }
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setLumaLiveError(message);
      connectionManagerRef.current!.fail('lumalive',message);
      refreshConnectionRecords();
    } finally {
      setLumaLiveBusy(false);
    }
  }

  async function pairDetectedLumaLive() {
    if(!lumaLiveEndpoint) return setLumaLiveError('Scan for LumaLive first.');
    setLumaLiveBusy(true);
    setLumaLiveError('');
    try {
      const paired=await pairLumaLive(
        lumaLiveEndpoint.baseUrl,
        lumaLivePairCode,
        `LumaRig · ${desktopDeviceId().replace(/-/g,'').slice(-4).toUpperCase()}`
      );
      const connection={baseUrl:paired.baseUrl,token:paired.token,version:lumaLiveEndpoint.version};
      saveLumaLiveConnection(connection);
      setLumaLiveConnection(connection);
      setLumaLivePairCode('');
      connectionManagerRef.current!.upsert({
        id:'lumalive',kind:'lumalive',name:'LumaLive',status:'connected',
        capabilities:['transport','song-recall','performance'],lastSeenAt:Date.now(),
        detail:`Paired · v${lumaLiveEndpoint.version}`
      });
      refreshConnectionRecords();
      setMessage('LumaLive paired. Ableton-backed transport can now drive LumaRig.');
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setLumaLiveError(message);
      connectionManagerRef.current!.fail('lumalive',message);
      refreshConnectionRecords();
    } finally {
      setLumaLiveBusy(false);
    }
  }

  function forgetLumaLive() {
    saveLumaLiveConnection(null);
    setLumaLiveConnection(null);
    setLumaLiveState(null);
    setLumaLiveError('');
    releaseSharedTransport('lumalive');
    connectionManagerRef.current!.disconnect('lumalive','Pairing removed');
    connectionManagerRef.current!.disconnect('ableton','LumaLive pairing removed');
    refreshConnectionRecords();
    setMessage('LumaLive pairing removed from this LumaRig computer.');
  }

  async function controlLumaLive(type:'start_playback'|'stop_playback') {
    if(!lumaLiveConnection) return setLumaLiveError('Pair LumaLive first.');
    try {
      await sendLumaLiveCommand(lumaLiveConnection,type);
      setMessage(type==='start_playback'?'LumaLive / Ableton playback started.':'LumaLive / Ableton playback stopped.');
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setLumaLiveError(message);
      connectionManagerRef.current!.fail('lumalive',message,true);
      refreshConnectionRecords();
    }
  }

  async function detectProPresenter() {
    setProPresenterBusy(true);
    setProPresenterError('');
    try {
      const clean=proPresenterUrl.trim().replace(/\/$/,'');
      const status=await readProPresenterStatus(clean);
      saveProPresenterUrl(clean);
      setProPresenterUrl(clean);
      setProPresenterStatus(status);
      setProPresenterWatching(true);
      const summary=proPresenterSummary(status);
      connectionManagerRef.current!.upsert({
        id:'propresenter',kind:'propresenter',name:'ProPresenter',status:'connected',
        capabilities:['cue-trigger','transport','media'],lastSeenAt:Date.now(),lastError:'',
        detail:summary.presentation || summary.current || clean
      });
      refreshConnectionRecords();
      setMessage('ProPresenter API connected. Slide and presentation transport controls are available.');
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setProPresenterError(message);
      setProPresenterWatching(false);
      setProPresenterStatus(null);
      connectionManagerRef.current!.fail('propresenter',message);
      refreshConnectionRecords();
    } finally {
      setProPresenterBusy(false);
    }
  }

  async function controlProPresenter(operation:'next'|'previous'|'retrigger'|'play'|'pause'|'timeline-play'|'timeline-pause'|'timeline-rewind') {
    setProPresenterError('');
    try {
      await sendProPresenterCommand(proPresenterUrl,operation);
      const status=await readProPresenterStatus(proPresenterUrl);
      setProPresenterStatus(status);
      const summary=proPresenterSummary(status);
      connectionManagerRef.current!.heartbeat('propresenter',summary.presentation || summary.current || operation);
      refreshConnectionRecords();
      setMessage(`ProPresenter · ${operation.replace(/-/g,' ')}.`);
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setProPresenterError(message);
      connectionManagerRef.current!.fail('propresenter',message,true);
      refreshConnectionRecords();
    }
  }

  useEffect(() => {
    if(!proPresenterWatching)return;
    let cancelled=false;
    const poll=async()=>{
      try{
        const status=await readProPresenterStatus(proPresenterUrl);
        if(cancelled)return;
        setProPresenterStatus(status);
        const summary=proPresenterSummary(status);
        connectionManagerRef.current!.upsert({
          id:'propresenter',kind:'propresenter',name:'ProPresenter',status:'connected',
          capabilities:['cue-trigger','transport','media'],lastSeenAt:Date.now(),lastError:'',
          detail:summary.presentation || summary.current || proPresenterUrl
        });
        refreshConnectionRecords();
      }catch(error){
        if(cancelled)return;
        const message=error instanceof Error?error.message:String(error);
        setProPresenterError(message);
        connectionManagerRef.current!.fail('propresenter',message,true);
        refreshConnectionRecords();
      }
    };
    void poll();
    const timer=window.setInterval(()=>void poll(),750);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[proPresenterWatching,proPresenterUrl]);


  const [newProfileId, setNewProfileId] = useState(FIXTURE_LIBRARY[0].id);
  const [newModeId, setNewModeId] = useState(FIXTURE_LIBRARY[0].modes[0].id);
  const [newFixtureName, setNewFixtureName] = useState('');
  const [newFixtureAddress, setNewFixtureAddress] = useState(6);
  const [newFixtureQuantity, setNewFixtureQuantity] = useState(1);
  const [newFixtureGroup, setNewFixtureGroup] = useState(DEFAULT_PATCH[0].group);
  const [profileAcknowledged, setProfileAcknowledged] = useState(false);
  const [stageFixtureId, setStageFixtureId] = useState(DEFAULT_PATCH[0].id);
  const [organizerDraft, setOrganizerDraft] = useState<PatchedFixture>(DEFAULT_PATCH[0]);
  const [stageLabels,setStageLabels]=useState(()=>localStorage.getItem('lumarig.visualizer.labels.v1')!=='off');
  useEffect(()=>{const sync=()=>setStageLabels(localStorage.getItem('lumarig.visualizer.labels.v1')!=='off');window.addEventListener('lumarig-labels-changed',sync);return()=>window.removeEventListener('lumarig-labels-changed',sync);},[]);
  const [stageElements, setStageElements] = useState<StageElement[]>(loadStageElements);
  const [selectedStageElementId, setSelectedStageElementId] = useState<string | null>(null);
  const [stageSettings, setStageSettings] = useState<StageSettings>(loadStageSettings);
  const [activeStagePresetId, setActiveStagePresetId] = useState<StagePresetId | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STAGE_PRESET_STORAGE_KEY);
    return STAGE_PRESETS.some((preset) => preset.id === stored) ? stored as StagePresetId : null;
  });
  const [stageVideoInputs, setStageVideoInputs] = useState<StageVideoInputOption[]>([]);
  const [stageVideoInputError, setStageVideoInputError] = useState('');
  const [stageVideoInputPermissionBlocked, setStageVideoInputPermissionBlocked] = useState(false);
  const [screenImageAssets, setScreenImageAssets] = useState<MediaAsset[]>([]);
  useEffect(() => {
    let active = true;
    void readMediaLibrary().then((library) => {
      if (!active) return;
      setScreenImageAssets(library.assets.filter((asset) => asset.kind === 'image' && !asset.missing));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [stageMonitorOpen,setStageMonitorOpen]=useState(false);
  const [midiMapOpen,setMidiMapOpen]=useState(false);
  const [timelineShowId,setTimelineShowId]=useState('');
  const [activeSongId, setActiveSongId] = useState(() => { try { return localStorage.getItem('lumarig-active-song:' + showFile.name) ?? ''; } catch { return ''; } });
  const mediaLoadToken = useRef(0);
  const restoredSong = useRef(false);
  const [cueTimelineSong,setCueTimelineSong]=useState<string|null>(null);
  const [timelineStartBar,setTimelineStartBar]=useState(0);
  const [stageView, setStageView] = useState<StageView>('perspective');
  const [stageMode, setStageMode] = useState<StageDesignerMode>('select');
  const stageDragRef = useRef<{ pointerId: number; kind: 'fixture' | 'element'; id: string; preserved: Vec3; moved: boolean } | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('target-center-stage');
  const [aimArrangement, setAimArrangement] = useState<TargetArrangement>('converge');
  const [aimOrderMode, setAimOrderMode] = useState<FixtureOrderMode>('forward');
  const [aimSpreadMeters, setAimSpreadMeters] = useState(4);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [positionPaletteName, setPositionPaletteName] = useState('');
  const [positionPaletteKind, setPositionPaletteKind] = useState<'spatial' | 'absolute'>('spatial');
  const [groupMasters, setGroupMasters] = useState<Record<string, number>>({});
  const [groupGridFixtureId, setGroupGridFixtureId] = useState<string | null>(null);

  const [midiInputs, setMidiInputs] = useState<MidiInputInfo[]>([]);
  const [selectedMidiInput, setSelectedMidiInput] = useState('');
  const [midiStatus, setMidiStatus] = useState<MidiStatus>({ connected: false, messages_received: 0 });
  const [midiMappings, setMidiMappings] = useState<MidiMapping[]>(loadMidiMappings);
  const midiMappingsRef = useRef(midiMappings);
  const [midiLearnMappingId, setMidiLearnMappingId] = useState<string | null>(null);
  const midiLearnMappingIdRef = useRef<string | null>(null);
  const midiButtonGateRef = useRef<Record<string, boolean>>({});
  const [newMidiTarget, setNewMidiTarget] = useState('go');
  const [midiClockSeen, setMidiClockSeen] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioArmed, setAudioArmed] = useState(false);
  const audioArmedRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioError, setAudioError] = useState('');
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const audioBaseUniverseRef = useRef<number[]>(makeUniverse());

  const runtimeRef = useRef<ShowRuntime | null>(null);
  const virtualOutputRef = useRef<VirtualOutputDriver | null>(null);
  const outputRouterRef = useRef<OutputRouter | null>(null);
  if (!runtimeRef.current) runtimeRef.current = new ShowRuntime({ frame: universeRef.current, patch });
  if (!virtualOutputRef.current) virtualOutputRef.current = new VirtualOutputDriver();
  if (!outputRouterRef.current) {
    const router = new OutputRouter();
    router.register(virtualOutputRef.current);
    router.register(new CallbackOutputDriver('udmx', 'Anyma uDMX', async (outputUniverse, frame) => {
      if (outputUniverse !== 1 || !dmxConnectedRef.current) return;
      await invoke('set_universe', { values: frame });
    }));
    router.register(new ArtNetOutputDriver(() => ({
      enabled: settingsRef.current.visualizerArtNetEnabled,
      target: settingsRef.current.visualizerArtNetTarget.trim() || '127.0.0.1'
    })));
    outputRouterRef.current = router;
  }

  const primaryFixture = patch.find((fixture) => fixture.selected) ?? patch[0];
  const primaryValues = fixtureValues(universe, primaryFixture);
  const activeCueIndex = showFile.cues.findIndex((cue) => cue.id === activeCueId);
  const activeCue = activeCueIndex >= 0 ? showFile.cues[activeCueIndex] : null;
  const nextCue = activeCueIndex < 0 ? showFile.cues[0] ?? null : showFile.cues[activeCueIndex + 1] ?? null;
  const activeRecordingPlayback = showFile.recordings?.find((recording) => recording.id === playingRecordingId) ?? null;
  const externalTrack = showFile.externalTrack ?? DEFAULT_EXTERNAL_TRACK_SYNC;
  const externalTrackRecording = showFile.recordings?.find((recording) => recording.id === externalTrack.recordingId) ?? null;
  useEffect(() => {
    if (!lumaLiveConnection) return;
    let cancelled=false;
    const poll=async()=>{
      try{
        const state=await readLumaLiveState(lumaLiveConnection);
        if(cancelled)return;
        const positionMs=lumaLivePositionMs(state);
        const previousPosition=lumaLiveLastPositionRef.current;
        const previousPlaying=externalTransportRunningRef.current;
        lumaLiveLastPositionRef.current=positionMs;
        setLumaLiveState(state);
        connectionManagerRef.current!.upsert({
          id:'lumalive',kind:'lumalive',name:'LumaLive',status:'connected',
          capabilities:['transport','song-recall','performance'],lastSeenAt:Date.now(),lastError:'',
          detail:[state.currentSongTitle,state.currentSectionName].filter(Boolean).join(' · ') || `v${lumaLiveConnection.version || 'connected'}`
        });
        connectionManagerRef.current!.upsert({
          id:'ableton',kind:'ableton',name:'Ableton Live',status:state.bridgeConnected?'connected':'degraded',
          capabilities:['transport','tempo','song-position'],lastSeenAt:state.bridgeConnected?Date.now():null,
          lastError:state.bridgeConnected?'':'LumaLive is running but its Ableton adapter is offline.',
          detail:state.bridgeConnected?`${state.tempo.toFixed(1)} BPM · ${state.playing?'Playing':'Stopped'}`:'Open Ableton with the Luma Live Max adapter'
        });
        refreshConnectionRecords();

        const result=applySharedTransport({
          source:'lumalive',
          playing:state.playing,
          positionMs,
          bpm:state.tempo,
          claim:state.playing,
          release:!state.playing
        });
        if(!result.accepted)return;

        if(externalTrack.armed && externalTrackRecording){
          const lightingPositionMs=applyLightingOffset(positionMs,externalTrack.lightingOffsetMs);
          const jumped=Math.abs(positionMs-previousPosition)>500;
          const wrongTake=playingRecordingIdRef.current!==externalTrackRecording.id;
          if(state.playing && (!previousPlaying || jumped || wrongTake)){
            playShowRecording(externalTrackRecording,{external:true,positionMs:lightingPositionMs});
          }else if(!state.playing && recordingPlaybackExternalRef.current){
            stopRecordedShowPlayback(false);
          }
        }
      }catch(error){
        if(cancelled)return;
        const message=error instanceof Error?error.message:String(error);
        setLumaLiveError(message);
        connectionManagerRef.current!.fail('lumalive',message,true);
        connectionManagerRef.current!.disconnect('ableton','LumaLive state unavailable');
        refreshConnectionRecords();
      }
    };
    void poll();
    const timer=window.setInterval(()=>void poll(),250);
    return()=>{cancelled=true;window.clearInterval(timer);};
  }, [lumaLiveConnection?.baseUrl,lumaLiveConnection?.token,externalTrack.armed,externalTrack.recordingId,externalTrack.lightingOffsetMs,externalTrackRecording?.id]);

  const selectedInfo = devices.find((device) => device.device_key === selectedDevice);
  const newProfile = findProfile(newProfileId) ?? FIXTURE_LIBRARY[0];
  const stageFixture = patch.find((fixture) => fixture.id === stageFixtureId) ?? patch[0];
  const activeStageTransform = stageFixture
    ? fixtureTransform(stageFixture, patch.indexOf(stageFixture), patch.length, stageSettings.dimensions)
    : { position: { x: 0, y: 0, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } };
  const activeStageGeometry = stageFixture
    ? fixtureGeometryState(universe, stageFixture, patch.indexOf(stageFixture), patch.length, stageSettings.dimensions)
    : null;
  const stageUnitLabel = stageSettings.unit === 'feet' ? 'ft' : 'm';
  const stageTargets = useMemo(() => buildStageTargets(stageElements, stageSettings.dimensions), [stageElements, stageSettings.dimensions]);
  const selectedTarget = stageTargets.find((target) => target.id === selectedTargetId) ?? stageTargets[0];
  const selectedMovingFixtures = selectedFixtures(patch).filter((fixture) => Boolean(findProfile(fixture.profileId)?.movement));
  const selectedTargetMetrics = activeStageGeometry && selectedTarget ? {
    distance: distance(activeStageGeometry.beam.origin, selectedTarget.position),
    horizontal: Math.atan2(selectedTarget.position.x - activeStageGeometry.beam.origin.x, selectedTarget.position.z - activeStageGeometry.beam.origin.z) * 180 / Math.PI,
    vertical: Math.atan2(selectedTarget.position.y - activeStageGeometry.beam.origin.y, Math.hypot(selectedTarget.position.x - activeStageGeometry.beam.origin.x, selectedTarget.position.z - activeStageGeometry.beam.origin.z)) * 180 / Math.PI
  } : null;
  const activeStageIntersection = activeStageGeometry ? intersectBeamWithStage(activeStageGeometry.beam, stageSettings.dimensions) : null;
  const selectedStageElement = stageElements.find((element) => element.id === selectedStageElementId) ?? null;
  const selectedStagePosition = selectedStageElement
    ? stageElementPosition(selectedStageElement, stageSettings.dimensions)
    : { x: 0, y: 0, z: 0 };
  const stageSnapshot=useMemo(()=>({patch,output:outputUniverse,dimensions:stageSettings.dimensions,elements:stageElements,blackout:runtimeBlackout}),[patch,outputUniverse,stageSettings.dimensions,stageElements,runtimeBlackout]);
  useStagePublisher(stageSnapshot);
  const midiControls = useMemo(() => [...buildControlRegistry(patch),...FX_RECIPES.map(recipe=>({id:'recipe:'+recipe.id,label:recipe.name,group:'FX recipes',type:'button' as const,commandPath:'effect.start',supportsPressRelease:false}))], [patch]);
  const midiControlGroups = useMemo(() => {
    const groups = new Map<string, MidiAssignableControl[]>();
    midiControls.forEach((control) => groups.set(control.group, [...(groups.get(control.group) ?? []), control]));
    return [...groups.entries()];
  }, [midiControls]);
  const fixtureGroups = useMemo(
    () => reconcileFixtureGroups(showFile.groups ?? [], patch),
    [showFile.groups, patch]
  );
  const selectedGroup = fixtureGroups.find((group) => group.id === selectedGroupId) ?? fixtureGroups[0] ?? null;
  const selectedGroupFixtures = selectedGroup ? fixturesInGroup(patch, selectedGroup) : [];
  const selectedGroupGrid = selectedGroup ? normalizeSelectionGrid(selectedGroup.selectionGrid, selectedGroup.fixtureOrder) : null;
  const selectedFixtureTargets = selectedFixtures(patch);

  useEffect(() => {
    if (JSON.stringify(showFile.groups ?? []) === JSON.stringify(fixtureGroups)) return;
    setShowFile((current) => ({ ...current, groups: fixtureGroups }));
  }, [fixtureGroups, showFile.groups]);

  useEffect(() => { setGroupGridFixtureId(null); }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId && fixtureGroups[0]) setSelectedGroupId(fixtureGroups[0].id);
    if (selectedGroupId && !fixtureGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(fixtureGroups[0]?.id ?? null);
    }
  }, [fixtureGroups, selectedGroupId]);

  useEffect(() => {
    setGroupMasters((current) => {
      const next = { ...current };
      let changed = false;
      fixtureGroups.forEach((group) => {
        if (next[group.id] === undefined) {
          next[group.id] = group.masterDefault;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [fixtureGroups]);

  useEffect(() => {
    patchRef.current = patch;
    runtimeRef.current?.configurePatch(patch);
  }, [patch]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    const refresh = () => {
      const status = outputRouterRef.current?.status().find((driver) => driver.id === 'artnet');
      if (status) setArtNetTelemetry({ framesSent: status.framesSent, lastError: status.lastError ?? '' });
    };
    refresh();
    const timer = window.setInterval(refresh, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    void startLumaVizDirect().then(setDirectStatus).catch((error) => {
      setDirectStatus((current) => ({ ...current, lastError: String(error) }));
    });
    const timer = window.setInterval(() => {
      void lumaVizDirectStatus().then(setDirectStatus).catch(() => {});
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { dmxConnectedRef.current = dmxStatus.connected; }, [dmxStatus.connected]);
  useEffect(() => {
    void invoke<string>('app_version').then(setAppVersion).catch(() => {});
    const timer = window.setTimeout(() => { void checkForUpdates(true); }, 2500);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { effectBpmRef.current = effectBpm; }, [effectBpm]);
  useEffect(() => { effectDepthRef.current = effectDepth; }, [effectDepth]);
  useEffect(() => { activeCustomEffectIdRef.current = activeCustomEffectId; }, [activeCustomEffectId]);
  useEffect(() => { tempoSourceRef.current = tempoSource; }, [tempoSource]);
  useEffect(() => { midiBpmRef.current = midiBpm; }, [midiBpm]);
  useEffect(() => { midiMappingsRef.current = midiMappings; }, [midiMappings]);
  useEffect(() => { externalLightingOffsetRef.current = externalTrack.lightingOffsetMs; }, [externalTrack.lightingOffsetMs]);
  useEffect(() => { midiLearnMappingIdRef.current = midiLearnMappingId; }, [midiLearnMappingId]);
  useEffect(() => { audioArmedRef.current = audioArmed; }, [audioArmed]);
  useEffect(() => { showTrackUrlRef.current = showTrackUrl; }, [showTrackUrl]);
  useEffect(() => {
    if (stageFixture) setOrganizerDraft(stageFixture);
  }, [stageFixture?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => writeCompatibilityStorage(PATCH_STORAGE_KEY, JSON.stringify(makePatchDocument(patch))), 120);
    return () => window.clearTimeout(timer);
  }, [patch]);
  useEffect(() => writeCompatibilityStorage(LOOKS_STORAGE_KEY, JSON.stringify(savedLooks)), [savedLooks]);
  useEffect(() => writeCompatibilityStorage(CUSTOM_FX_STORAGE_KEY, JSON.stringify(customEffects)), [customEffects]);
  const workspaceCheckpointRef = useRef<Record<string, unknown>>({});
  workspaceCheckpointRef.current = { patch, stageElements, stageSettings, looks:savedLooks, customEffects, projects:showLibrary, midiMappings, settings, sectionPresets, tempo:{bpm:effectBpm,locked:tempoLocked} };
  const editHistory=useEditHistory({show:{...showFile,groups:fixtureGroups},patch,stageElements,stageSettings,looks:savedLooks,customEffects,sectionPresets},value=>{
    window.dispatchEvent(new Event('lumarig-stop-timeline'));stopTimeline();stopFade();stopEffect(false);
    setShowFile(value.show);setPatch(value.patch);setStageElements(value.stageElements);setStageSettings(value.stageSettings);setSavedLooks(value.looks);setCustomEffects(value.customEffects);setSectionPresets(value.sectionPresets);setActiveStagePresetId(null);
  },libraryReady);
  const editClipboard=useRef<Array<ShowCue|StageElement|CustomEffect|PatchedFixture|FixtureLook>>([]);
  const lastEditingLook=useRef<FixtureLook|null>(null);
  const allEditingSelected=useRef(false);
  useEffect(()=>{allEditingSelected.current=false;},[workspace,showMode,programMode,setupView,activeCueId,selectedStageElementId]);
  function currentWorkspaceCheckpoint(): Record<string, unknown> { return workspaceCheckpointRef.current; }
  function applyWorkspaceCheckpoint(value: Record<string, unknown>) {
    if (!isAppWorkspaceCheckpoint(value)) throw Error('Saved workspace is invalid. Existing data is preserved.');
    setPatch(value.patch); setStageElements(value.stageElements); setStageSettings(value.stageSettings);
    setSavedLooks(value.looks); setCustomEffects(value.customEffects); setShowLibrary(value.projects);
    if (value.sectionPresets) setSectionPresets(value.sectionPresets);
    setMidiMappings(value.midiMappings); setSettings(value.settings);
    if (value.tempo) { setEffectBpm(value.tempo.bpm); effectBpmRef.current=value.tempo.bpm; setTempoLocked(value.tempo.locked); tempoLockedRef.current=value.tempo.locked; }
  }
  useEffect(() => {
    let cancelled = false;
    void readProgramState().then(async state => {
      if (cancelled) return;
      const working = state.working ?? showFileRef.current;
      if (state.workspace && !isAppWorkspaceCheckpoint(state.workspace)) throw Error('Saved workspace is invalid. Existing data is preserved.');
      if (state.recovery.some(r => r.workspace && !isAppWorkspaceCheckpoint(r.workspace))) throw Error('Recovery workspace is invalid. Existing data is preserved.');
      const saved = await saveAppProgramState(working, { workspace: state.workspace ?? currentWorkspaceCheckpoint(), seed: showLibrary.map(item => item.show) });
      if (cancelled) return;
      if (state.workspace) applyWorkspaceCheckpoint(state.workspace);
      setSongLibrary(saved.programs); setShowRecovery(saved.recovery);
      setShowFile({ ...working, songs: songsForShow(working).map(song => ({ ...song, libraryId: programId(working, song) })) }); setLibraryReady(true); setLibraryOpening(false); setSaveStatus('Saved');
    }).catch(error => { if (!cancelled) { setLibraryOpening(false); setSaveStatus('Save unavailable'); setMessage(String(error)); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!libraryReady || transitionRef.current) return;
    const sequence = ++saveSequence.current;
    setSaveStatus('Saving…');
    void saveAppProgramState(showFile, { workspace: currentWorkspaceCheckpoint() }).then(state => {
      if (sequence !== saveSequence.current) return;
      setSongLibrary(state.programs); setShowRecovery(state.recovery); setSaveStatus('Saved');
    }).catch(error => {
      if (sequence === saveSequence.current) { setSaveStatus('Save failed'); setMessage(String(error)); }
    });
    // Compatibility copy. The transactional checkpoint is authoritative on restart.
    try { writeCompatibilityStorage(SHOW_STORAGE_KEY, JSON.stringify(showFile)); } catch { /* checkpoint reports its own failures */ }
  }, [showFile, libraryReady, patch, stageElements, stageSettings, savedLooks, customEffects, showLibrary, midiMappings, settings, effectBpm, tempoLocked, sectionPresets]);
  useEffect(() => {
    try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(showLibrary)); }
    catch { setMessage('Show library storage is full. Delete an older saved show or large recording.'); }
  }, [showLibrary]);
  useEffect(() => writeCompatibilityStorage(MIDI_STORAGE_KEY, JSON.stringify(midiMappings)), [midiMappings]);
  useEffect(() => writeCompatibilityStorage(SETTINGS_STORAGE_KEY, JSON.stringify(settings)), [settings]);
  useEffect(() => {
    const { password: _password, ...safeConfig } = remoteRelayConfig;
    writeCompatibilityStorage(REMOTE_RELAY_STORAGE_KEY, JSON.stringify(safeConfig));
  }, [remoteRelayConfig]);
  useEffect(() => () => { void remoteRelayRef.current?.disconnect(); }, []);
  useEffect(() => () => {
    if (remotePublishTimerRef.current !== null) window.clearTimeout(remotePublishTimerRef.current);
  }, []);
  useEffect(() => writeCompatibilityStorage(STAGE_STORAGE_KEY, JSON.stringify(makeStageDocument(stageElements, stageSettings.dimensions))), [stageElements, stageSettings.dimensions]);
  useEffect(() => writeCompatibilityStorage(STAGE_SETTINGS_STORAGE_KEY, JSON.stringify(stageSettings)), [stageSettings]);
  useEffect(() => {
    if (activeStagePresetId) writeCompatibilityStorage(STAGE_PRESET_STORAGE_KEY, activeStagePresetId);
    else window.localStorage.removeItem(STAGE_PRESET_STORAGE_KEY);
  }, [activeStagePresetId]);

  const refreshDmxStatus = useCallback(async () => {
    try { setDmxStatus(await invoke<DmxStatus>('dmx_status')); } catch { /* browser preview */ }
  }, []);

  const scanDevices = useCallback(async () => {
    try {
      const found = await invoke<UdmxDeviceInfo[]>('list_udmx_devices');
      setDevices(found);
      const preferred = found.find((device) => device.likely_udmx) ?? found[0];
      if (preferred) {
        setSelectedDevice((current) => found.some((device) => device.device_key === current) ? current : preferred.device_key);
        setMessage('uDMX found. Ready to connect.');
      } else {
        setSelectedDevice('');
        setMessage('No uDMX found. Check the USB cable or adapter, then scan again.');
      }
    } catch (error) { setMessage(`USB scan failed: ${String(error)}`); }
  }, []);

  const scanMidi = useCallback(async () => {
    try {
      const inputs = await invoke<MidiInputInfo[]>('list_midi_inputs');
      setMidiInputs(inputs);
      if (inputs.length > 0) setSelectedMidiInput((current) => inputs.some((input) => String(input.id) === current) ? current : String(inputs[0].id));
    } catch { setMidiInputs([]); }
  }, []);

  useEffect(() => {
    void scanDevices();
    void scanMidi();
    const interval = window.setInterval(refreshDmxStatus, STATUS_POLL_MS);
    return () => {
      window.clearInterval(interval);
      if (fadeAnimationRef.current !== null) window.cancelAnimationFrame(fadeAnimationRef.current);
      if (effectAnimationRef.current !== null) window.cancelAnimationFrame(effectAnimationRef.current);
      if (audioAnimationRef.current !== null) window.cancelAnimationFrame(audioAnimationRef.current);
      if (showRecordingAnimationRef.current !== null) window.cancelAnimationFrame(showRecordingAnimationRef.current);
      if (recordingPlaybackAnimationRef.current !== null) window.cancelAnimationFrame(recordingPlaybackAnimationRef.current);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
      showTrackAudioRef.current?.pause();
      if (showTrackUrlRef.current) URL.revokeObjectURL(showTrackUrlRef.current);
    };
  }, [refreshDmxStatus, scanDevices, scanMidi]);

  function stopFade() {
    cueLaunchGenerationRef.current += 1;
    if (fadeAnimationRef.current !== null) window.cancelAnimationFrame(fadeAnimationRef.current);
    fadeAnimationRef.current = null;
    setIsFading(false);
  }

  function stopEffect(announce = true, clearLayer = true, clearHit = true) {
    activeEffectRef.current = null;
    activeCustomEffectIdRef.current = null;
    effectTargetIdsRef.current = [];
    setActiveEffect(null);
    setActiveCustomEffectId(null);
    if (effectAnimationRef.current !== null) window.cancelAnimationFrame(effectAnimationRef.current);
    effectAnimationRef.current = null;

    if (clearLayer && runtimeRef.current) {
      void dispatchControl({
        type: 'playback.layer.clear',
        universe: 1,
        layerId: 'fx'
      }, 'fx');
    }

    if (clearHit && runtimeRef.current) {
      momentaryEffectRef.current = null;
      void dispatchControl({
        type: 'playback.layer.clear',
        universe: 1,
        layerId: 'hit'
      }, 'surface');
    }

    if (announce) setMessage('Effects stopped. The underlying cue/programmer look is restored.');
  }

  async function publishRuntimeResult(result: RuntimeDispatchResult) {
    universeRef.current = result.baseFrame;
    setUniverse(result.baseFrame);
    outputUniverseRef.current = result.frame;
    setOutputUniverse(result.frame);
    setRuntimeBlackout(runtimeRef.current?.snapshot.blackout ?? false);
    try { await outputRouterRef.current?.route(result.universe, result.frame); }
    catch (error) { setMessage(`Output update failed: ${String(error)}`); }
    directSequenceRef.current += 1;
    const directFrame = semanticFrameFromResolvedOutput(
      directSequenceRef.current,
      result.frame,
      patchRef.current,
      result.universe,
      showFile.name
    );
    void sendLumaVizDirectFrame(directFrame).catch(() => {
      // Direct visualization is non-fatal and must never interrupt physical output.
    });
  }

  async function dispatchControl(command: ControlCommand, source: ControlSource = 'ui') {
    const before=runtimeRef.current!.baseFrame;
    const result = runtimeRef.current!.dispatch(controlCommand(source, command));
    const origin=timelineRecordingOrigin.current;
    if(origin?.overdub && showRecordingActiveRef.current && source!=='recorder' && source!=='system')origin.manual.observe(command,before,result.baseFrame,result.frame,patchRef.current);
    if (result.patchChanged) {
      const nextPatch = [...runtimeRef.current!.snapshot.patch];
      patchRef.current = nextPatch;
      setPatch(nextPatch);
    }
    await publishRuntimeResult(result);
    if (result.warnings.length) setMessage(result.warnings.join(' '));
    return result;
  }

  async function commitUniverse(next: number[], source: ControlSource = 'system') {
    await dispatchControl({ type: 'frame.replace', universe: 1, values: next }, source);
  }

  async function commitOutputUniverse(next: number[], source: ControlSource = 'recorder') {
    await dispatchControl({ type: 'frame.output.replace', universe: 1, values: next }, source);
  }

  async function setChannels(updates: ReadonlyArray<DmxUpdate>, interrupt = true, source: ControlSource = 'ui') {
    if (interrupt) {
      stopFade();
      if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
      if (audioArmedRef.current) setAudioArmed(false);
    }
    await dispatchControl({ type: 'frame.update', universe: 1, updates }, source);
  }

  async function setChannel(channel: number, value: number, source: ControlSource = 'ui') {
    await setChannels([[channel, value]], true, source);
  }

  async function setFixtureAttribute(fixture: PatchedFixture, parameter: FixtureParameter, value: number, source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    await dispatchControl({ type: 'fixture.attribute', fixtureIds: [fixture.id], parameter, value }, source);
  }

  async function setFixtureColor(fixture: PatchedFixture, rgb: readonly [number, number, number], source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    await dispatchControl({ type: 'fixture.color', fixtureIds: [fixture.id], color: { red: rgb[0], green: rgb[1], blue: rgb[2] } }, source);
  }

  function toggleFixtureSelection(fixtureId: string, source: ControlSource = 'ui') {
    void dispatchControl({ type: 'fixture.select', fixtureIds: [fixtureId], mode: 'toggle' }, source);
  }

  function fadeToUniverse(name: string, target: number[], duration: number, source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    const from = [...universeRef.current];
    if (duration === 0) {
      void commitUniverse(target, source);
      setMessage(`${name} is live.`);
      return;
    }
    const startedAt = performance.now();
    fadeLastFrameRef.current = startedAt - FRAME_MS;
    setIsFading(true);
    const tick = (now: number) => {
      const raw = Math.min(1, (now - startedAt) / duration);
      const eased = raw < .5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      if (now - fadeLastFrameRef.current >= FRAME_MS || raw === 1) {
        fadeLastFrameRef.current = now;
        void commitUniverse(interpolateUniverse(from, target, eased), source);
      }
      if (raw < 1) fadeAnimationRef.current = requestAnimationFrame(tick);
      else {
        fadeAnimationRef.current = null;
        setIsFading(false);
        setMessage(`${name} is live.`);
      }
    };
    fadeAnimationRef.current = requestAnimationFrame(tick);
  }

  function fadeCueToUniverse(
    cue: ShowCue,
    target: number[],
    source: ControlSource = 'cue',
    onComplete?: () => void
  ) {
    stopFade();
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    const generation = cueLaunchGenerationRef.current;
    const completed = () => { if (generation !== cueLaunchGenerationRef.current) return; if (cue.effectStack?.length) startEffectStack(cue.effectStack, cue.name); onComplete?.(); };
    const from = [...universeRef.current];
    const totalDuration = cuePlaybackDuration(cue, from, target, patchRef.current);

    if (totalDuration === 0) {
      void commitUniverse(target, source).then(() => {
        setMessage(`Cue ${cue.number}: ${cue.name} is live.`);
        completed();
      });
      return;
    }

    const startedAt = performance.now();
    fadeLastFrameRef.current = startedAt - FRAME_MS;
    setIsFading(true);

    const tick = (now: number) => {
      const elapsed = Math.min(totalDuration, now - startedAt);
      const shouldCommit = now - fadeLastFrameRef.current >= FRAME_MS || elapsed >= totalDuration;
      const frame = shouldCommit
        ? renderCueTimedFrame(cue, from, target, elapsed, patchRef.current)
        : null;
      if (shouldCommit) fadeLastFrameRef.current = now;

      if (elapsed < totalDuration) {
        if (frame) void commitUniverse(frame, source);
        fadeAnimationRef.current = requestAnimationFrame(tick);
      } else {
        fadeAnimationRef.current = null;
        setIsFading(false);
        const landed = frame ? commitUniverse(frame, source) : Promise.resolve();
        void landed.then(() => {
          setMessage(`Cue ${cue.number}: ${cue.name} is live.`);
          completed();
        });
      }
    };

    fadeAnimationRef.current = requestAnimationFrame(tick);
  }

  function applyBuskUpdates(updates: ReadonlyArray<DmxUpdate>, label: string) {
    if (!updates.length) {
      setMessage(`${label}: no supported attributes on the current selection.`);
      return;
    }

    for (const [channel, value] of updates) {
      buskLayerRef.current.set(channel, clampDmx(value));
    }

    const merged = [...buskLayerRef.current.entries()] as DmxUpdate[];
    setBuskActive(merged.length > 0);
    setBuskChannelCount(merged.length);

    void dispatchControl({
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'busk',
      priority: 50,
      mode: 'ltp',
      updates: merged
    }, 'surface');

    setMessage(`${label} added to BUSK · ${merged.length} overridden channel${merged.length === 1 ? '' : 's'}.`);
  }

  function clearBusk(announce = true) {
    buskLayerRef.current.clear();
    setBuskActive(false);
    setBuskChannelCount(0);
    void dispatchControl({
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'busk'
    }, 'surface').then(() => {
      if (announce) setMessage('BUSK released. The running cue and FX are visible again.');
    });
  }

  function applyBuskIntensity(percent: number) {
    const value = percentToDmx(Math.max(0, Math.min(100, percent)));
    const updates = selectedFixtureTargets
      .map((fixture) => fixtureParameterUpdate(fixture, 'dimmer', value))
      .filter((update): update is DmxUpdate => Boolean(update));
    applyBuskUpdates(updates, `BUSK intensity ${Math.round(percent)}%`);
  }

  function applyBuskColor(hex: string) {
    stopFade();
    stopEffect(false);
    stopTimeline();
    setGlobalColor(hex);
    const rgb = hexToRgb(hex);
    const updates = selectedFixtureTargets.flatMap((fixture) => fixtureColorUpdates(fixture, rgb));
    applyBuskUpdates(updates, `BUSK color ${hex.toUpperCase()}`);
  }

  function applyBuskBeam(name: string, zoom: number, focus: number, iris: number) {
    const updates = selectedFixtureTargets.flatMap((fixture) => {
      const values: DmxUpdate[] = [];
      const zoomUpdate = fixtureParameterUpdate(fixture, 'zoom', zoom);
      const focusUpdate = fixtureParameterUpdate(fixture, 'focus', focus);
      const irisUpdate = fixtureParameterUpdate(fixture, 'iris', iris);
      if (zoomUpdate) values.push(zoomUpdate);
      if (focusUpdate) values.push(focusUpdate);
      if (irisUpdate) values.push(irisUpdate);
      return values;
    });
    applyBuskUpdates(updates, `BUSK beam ${name}`);
  }

  function applyBuskPositionPalette(palette: PositionPalette) {
    const movingFixtures = selectedMovingFixtures;
    if (!movingFixtures.length) {
      setMessage('Select at least one moving fixture before busking a position.');
      return;
    }

    if (palette.kind === 'absolute') {
      const selectedIds = new Set(movingFixtures.map((fixture) => fixture.id));
      const updates = palette.positions.flatMap((position) => {
        if (!selectedIds.has(position.fixtureId)) return [];
        const fixture = patchRef.current.find((item) => item.id === position.fixtureId);
        return fixture
          ? fixtureMovementUpdates(fixture, position.panNormalized, position.tiltNormalized)
          : [];
      });
      applyBuskUpdates(updates, `BUSK position ${palette.name}`);
      return;
    }

    const stageTarget = stageTargets.find((candidate) => candidate.id === palette.targetId);
    const target = stageTarget?.position ?? palette.fallbackTarget;
    const ordered = orderFixtures(
      movingFixtures.map((fixture) => ({
        fixture,
        patchIndex: patchRef.current.findIndex((item) => item.id === fixture.id)
      })),
      palette.orderMode ?? 'forward'
    );
    const targets = arrangeTargetPoints(target, ordered.length, palette.arrangement, palette.spreadMeters);
    const warnings: string[] = [];
    const updates = ordered.flatMap(({ fixture, patchIndex }, targetIndex) => {
      const solution = aimFixtureAtTarget(
        outputUniverseRef.current,
        fixture,
        targets[targetIndex],
        patchIndex,
        patchRef.current.length,
        stageSettings.dimensions
      );
      if (!solution) {
        warnings.push(`${fixture.name} has no Pan/Tilt geometry`);
        return [];
      }
      if (!solution.reachable) {
        warnings.push(`${fixture.name} cannot reach ${palette.targetName}`);
        return [];
      }
      return solution.updates;
    });

    applyBuskUpdates(updates, `BUSK position ${palette.name}`);
    if (warnings.length) setMessage(`${palette.name}: ${warnings.join(' · ')}`);
  }

  function runLook(look: FixtureLook, duration = fadeMs) {
    lastEditingLook.current=look;
    const target = applyUniverseUpdates(universeRef.current, lookUpdates(look.values, selectedFixtures(patch)));
    fadeToUniverse(look.name, target, duration);
  }

  function applyGlobalColor(hex: string, source: ControlSource = 'ui') {
    setGlobalColor(hex);
    const rgb = hexToRgb(hex);
    const targets = selectedFixtures(patch);
    const updates = targets.flatMap((fixture) => {
      const result = fixtureColorUpdates(fixture, rgb);
      const dimmer = parameterChannel(fixture, 'dimmer');
      if (dimmer && universeRef.current[dimmer - 1] === 0) result.push([dimmer, percentToDmx(globalMaster, settings.masterLimit)]);
      return result;
    });
    void setChannels(updates, true, source);
    setMessage(`Color applied to ${targets.length} light${targets.length === 1 ? '' : 's'}.`);
  }

  function applyGlobalMaster(percent: number, source: ControlSource = 'ui') {
    const limited = Math.min(percent, settings.masterLimit);
    setGlobalMaster(limited);
    void dispatchControl({ type: 'master.set', value: limited / 100 }, source);
    setMessage(`Grand master at ${Math.round(limited)}%. Fixture values remain preserved underneath.`);
  }

  function startEffect(effect: EffectId, requestedFixtureIds?: readonly string[]): boolean {
    const requested = requestedFixtureIds?.length
      ? [...requestedFixtureIds]
      : selectedFixtures(patchRef.current).map((fixture) => fixture.id);
    const targets = requested
      .map((id) => patchRef.current.find((fixture) => fixture.id === id))
      .filter((fixture): fixture is PatchedFixture => Boolean(fixture));
    if (!effectSupportedByFixtures(effect, targets)) {
      setMessage(targets.length ? 'That effect is not supported by the selected fixture capabilities.' : 'Select a fixture or group before starting an effect.');
      return false;
    }
    stopFade();
    stopEffect(false, false, false);
    setAudioArmed(false);
    const preset = EFFECT_PRESETS.find((item) => item.id === effect);
    effectTargetIdsRef.current = targets.map((fixture) => fixture.id);
    effectBaseUniverseRef.current = [...universeRef.current];
    effectStartedRef.current = performance.now();
    activeEffectRef.current = effect;
    setActiveEffect(effect);
    const tick = (now: number) => {
      if (activeEffectRef.current !== effect) return;
      const effectFixtures = effectTargetIdsRef.current
        .map((id) => patchRef.current.find((fixture) => fixture.id === id))
        .filter((fixture): fixture is PatchedFixture => Boolean(fixture))
        .map((fixture) => ({ ...fixture, selected: true }));
      const bpm = tempoSourceRef.current === 'midi' && midiBpmRef.current ? midiBpmRef.current : effectBpmRef.current;
      const elapsed = now - effectStartedRef.current;
      if (effect === 'finale' && elapsed >= (60000 / bpm) * 8) {
        const finaleHold = renderEffect('blinder', effectFixtures, elapsed, bpm, 1);
        const dimmerChannels = new Set(patchRef.current.map((fixture) => parameterChannel(fixture, 'dimmer')).filter(Boolean));
        const masterCap = percentToDmx(settingsRef.current.masterLimit);
        const cappedHold = finaleHold.map(([channel, value]) => [channel, dimmerChannels.has(channel) ? Math.min(value, masterCap) : value] as const);
        const holdFrame = applyUniverseUpdates(effectBaseUniverseRef.current, cappedHold);
        void commitUniverse(holdFrame, 'fx').then(() => {
          stopEffect(false);
          setMessage('Finale complete — holding the full-white finish.');
        });
        return;
      }
      const dimmerChannels = new Set(patchRef.current.map((fixture) => parameterChannel(fixture, 'dimmer')).filter(Boolean));
      const masterCap = percentToDmx(settingsRef.current.masterLimit);
      const updates = renderEffect(effect, effectFixtures, elapsed, bpm, effectDepthRef.current / 100)
        .map(([channel, value]) => [channel, dimmerChannels.has(channel) ? Math.min(value, masterCap) : value] as const);
      void dispatchControl({
        type: 'playback.layer.set',
        universe: 1,
        layerId: 'fx',
        priority: preset?.momentary ? 80 : 30,
        mode: effect === 'bump' ? 'htp' : 'ltp',
        updates
      }, 'fx');
      effectAnimationRef.current = requestAnimationFrame(tick);
    };
    effectAnimationRef.current = requestAnimationFrame(tick);
    setMessage(`${preset?.name ?? effect} running on selected lights.`);
    return true;
  }

  function toggleEffect(effect: EffectId, targetIds?: readonly string[]) {
    if (activeEffectRef.current === effect) {
      stopEffect();
      return;
    }
    startEffect(effect, targetIds);
  }

  function startMomentaryEffect(effect: EffectId, targetIds?: readonly string[]) {
    if (momentaryEffectRef.current?.effect === effect) return;

    const requested = targetIds?.length
      ? [...targetIds]
      : selectedFixtures(patchRef.current).map((fixture) => fixture.id);
    const targets = requested
      .map((id) => patchRef.current.find((fixture) => fixture.id === id))
      .filter((fixture): fixture is PatchedFixture => Boolean(fixture));

    if (!effectSupportedByFixtures(effect, targets)) {
      setMessage(targets.length ? 'That hit is not supported by the selected fixture capabilities.' : 'Select a fixture or group before firing a hit.');
      return;
    }

    const preset = EFFECT_PRESETS.find((item) => item.id === effect);
    if (!preset?.momentary) {
      startEffect(effect, requested);
      return;
    }

    const hitFixtures = targets.map((fixture) => ({ ...fixture, selected: true }));
    const bpm = tempoSourceRef.current === 'midi' && midiBpmRef.current ? midiBpmRef.current : effectBpmRef.current;
    const dimmerChannels = new Set(patchRef.current.map((fixture) => parameterChannel(fixture, 'dimmer')).filter(Boolean));
    const masterCap = percentToDmx(settingsRef.current.masterLimit);
    const updates = renderEffect(effect, hitFixtures, 0, bpm, effectDepthRef.current / 100)
      .map(([channel, value]) => [channel, dimmerChannels.has(channel) ? Math.min(value, masterCap) : value] as const);

    momentaryEffectRef.current = { effect };
    void dispatchControl({
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'hit',
      priority: 80,
      mode: effect === 'bump' ? 'htp' : 'ltp',
      updates
    }, 'surface');

    setMessage(`${preset.name} held over the current cue/FX. Release removes only the hit.`);
  }

  function releaseMomentaryEffect(effect: EffectId) {
    const held = momentaryEffectRef.current;
    if (!held || held.effect !== effect) return;

    momentaryEffectRef.current = null;
    const preset = EFFECT_PRESETS.find((item) => item.id === effect);

    void dispatchControl({
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'hit'
    }, 'surface').then(() => {
      setMessage(`${preset?.name ?? effect} released. Running FX continues underneath.`);
    });
  }

  function setMasterTempo(value: number, persistSong = true) {
    if(timelineRecordingOrigin.current && showRecordingActiveRef.current){setMessage('Stop Timeline recording before changing its tempo.');return;}
    const bpm = Math.max(20, Math.min(300, Number.isFinite(value) ? value : effectBpmRef.current));
    setTempoSource('manual');
    tempoSourceRef.current = 'manual';
    if (persistSong) { setTempoLocked(true); tempoLockedRef.current = true; }
    setEffectBpm(bpm);
    effectBpmRef.current = bpm;
    if (persistSong) setShowFile(current => ({ ...current, creatorSections: current.creatorSections?.map(section => section.song === songsForShow(current).find(s => s.id === activeSongId)?.name ? { ...section, bpm } : section), timeline: !timelineShowId && current.timeline ? { ...current.timeline, bpm } : current.timeline, songs: songsForShow(current).map(s => s.id === activeSongId ? { ...s, bpm, tempoLocked:true } : s), timelineShows: current.timelineShows?.map(t => t.id === timelineShowId ? {...t,timeline:{...t.timeline,bpm}} : t) }));
  }

  function changeTempoLock(locked: boolean) {
    setTempoLocked(locked); tempoLockedRef.current = locked;
    if (locked) { setTempoSource('manual'); tempoSourceRef.current = 'manual'; }
    setShowFile(current => ({ ...current, songs:songsForShow(current).map(s => s.id === activeSongId ? { ...s, tempoLocked:locked } : s) }));
  }

  function tapTempo() {
    const now = performance.now();
    const recent = [...tapTimesRef.current, now].filter((time) => now - time < 2500).slice(-6);
    tapTimesRef.current = recent;
    setTempoSource('manual');
    if (recent.length < 2) {
      setMessage('Tap again to set the effect tempo.');
      return;
    }
    const gaps = recent.slice(1).map((time, index) => time - recent[index]);
    const bpm = Math.max(30, Math.min(240, Math.round(60000 / (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length))));
    setMasterTempo(bpm);
    setMessage(`Tap tempo set to ${bpm} BPM.`);
  }

  function saveCurrentLook() {
    if (savedLooks.length >= 24) return setMessage('The look deck is full. Delete a look first.');
    const name = lookName.trim() || `Look ${savedLooks.length + 1}`;
    setSavedLooks((current) => [...current, { id: `look-${Date.now().toString(36)}`, name, values: { ...primaryValues } }]);
    setLookName('');
    setMessage(`${name} saved from ${primaryFixture?.name ?? 'the current output'}.`);
  }

  function captureCue() {
    const number = showFile.cues.length + 1;
    const name = cueName.trim() || `Cue ${number}`;
    const output = [...universeRef.current];
    const previous = resolveShowCueFrame(showFile.cues, showFile.cues.length - 1);
    const cue: ShowCue = {
      id: `cue-${Date.now().toString(36)}`,
      number,
      name,
      fadeMs: cueFadeMs,
      fadeOutMs: cueFadeMs,
      delayMs: 0,
      followMs: 0,
      color: globalColor,
      description: '',
      linkedLookId: '',
      linkedEffectId: '',
      trackName: '',
      trackKind: 'song',
      rundownSectionId: showFile.rundownSections?.[0]?.id ?? '',
      values: { ...primaryValues },
      changes: cueChanges(previous, output),
      timing: [],
      universe: output
    };
    setShowFile((current) => ({ ...current, cues: [...current.cues, cue] }));
    setCueName('');
    setMessage(`${name} captured as a tracked cue with ${cue.changes?.length ?? 0} channel instruction${cue.changes?.length === 1 ? '' : 's'}.`);
  }

  function selectCueTargets(cue: ShowCue) {
    const layers=cue.effectStack?.filter(layer=>layer.enabled !== false) ?? [];
    const section=showFile.creatorSections?.find(item=>item.id===cue.sourceSectionId);
    const group=fixtureGroups.find(item=>item.id===section?.groupId);
    const targets=cueTargetIds(showFile,cue,patchRef.current,fixtureGroups);
    void dispatchControl({type:'fixture.select',fixtureIds:targets,mode:'replace'});
    const first=patchRef.current.find(item=>item.id===targets[0]);
    if (first) { setStageFixtureId(first.id); setOrganizerDraft(first); setSelectedStageElementId(null); }
    const targetGroup=group ?? fixtureGroups.find(item=>fixturesInGroup(patchRef.current,item).some(fixture=>fixture.id===first?.id));
    setSelectedGroupId(targetGroup?.id ?? null);
    if (layers[0]) { setFxEditor(structuredClone(layers[0].effect)); setSelectedFxBankId(layers[0].effect.id); }
  }
  function takeEditingPlaybackAuthority() {
    stopRecordedShowPlayback(false);
    audioArmedRef.current=false; setAudioArmed(false);
  }
  function adoptCueContext(cue: ShowCue, clipId?: string, position?: number) {
    if(timelineRecordingOrigin.current && showRecordingActiveRef.current){setActiveCueId(cue.id);setActiveSectionId(cue.sourceSectionId??'');selectCueTargets(cue);return;}
    takeEditingPlaybackAuthority();
    const context = cueContext(showFile, cue.id, timelineShowId, clipId);
    const song = songsForShow(showFile).find(item => item.name === cue.trackName);
    if (song && song.id !== activeSongId) void selectBankSong(song);
    else if (!song) { ++mediaLoadToken.current; setActiveSongId(''); setTimelineShowId(context.timelineId); }
    setActiveCueId(cue.id);
    setActiveSectionId(cue.sourceSectionId ?? '');
    setActiveTimelineClipId(context.clipId); activeTimelineClipRef.current=context.clipId;
    if (context.timeline) setTimelineShowId(context.timelineId);
    const bar = position ?? context.bar;
    timelinePositionRef.current = bar; setTimelinePositionBar(bar);
    const timeline = context.timeline;
    const audio = showTrackAudioRef.current;
    if (audio && audio.readyState >= 1 && timeline && (!song || song.id === activeSongId)) {
      const source = mediaPosition(bar * 60000 / (song?.bpm ?? masterTempoBpm) * timeline.beatsPerBar,
        timeline.audioOffsetBars * 60000 / (song?.bpm ?? masterTempoBpm) * timeline.beatsPerBar,
        mediaWindow(timeline, showTrackDurationMs));
      const bounds=mediaWindow(timeline,showTrackDurationMs);
      const boundary=bar<timeline.audioOffsetBars ? bounds.startMs : bounds.endMs;
      audio.currentTime = (source ?? (Number.isFinite(boundary) ? boundary : bounds.startMs)) / 1000;
    }
    timelineContextCueRef.current=cue.id;
    selectCueTargets(cue);
  }
  function selectTimelineClip(clipId: string, bar: number) {
    const clip = editingTimeline.clips.find(item => item.id === clipId);
    const cue = showFile.cues.find(item => item.id === clip?.cueId);
    if (cue) adoptCueContext(cue, clipId, bar);
    else { activeTimelineClipRef.current=clipId; setActiveTimelineClipId(clipId); timelinePositionRef.current=bar; setTimelinePositionBar(bar); }
  }
  function runCue(cue: ShowCue) {
    const generation = ++cueLaunchGeneration.current;
    adoptCueContext(cue);
    window.dispatchEvent(new Event('lumarig-stop-timeline'));
    stopTimeline();
    if (cueFollowTimerRef.current !== null) window.clearTimeout(cueFollowTimerRef.current);

    const launch = () => {
      if (generation !== cueLaunchGeneration.current) return;
      const cueIndex = showFile.cues.findIndex((item) => item.id === cue.id);
      setActiveCueId(cue.id);
      const target = cueIndex >= 0
        ? resolveShowCueFrame(showFile.cues, cueIndex)
        : cue.universe?.length === 512
          ? [...cue.universe]
          : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));

      void dispatchControl({ type: 'cue.go', cueId: cue.id }, 'cue');

      fadeCueToUniverse(cue, target, 'cue', () => {
        if (!cue.effectStack?.length && cue.linkedEffectId && EFFECT_PRESETS.some((effect) => effect.id === cue.linkedEffectId)) {
          startEffect(cue.linkedEffectId as EffectId);
        }
      });

      if ((cue.followMs ?? 0) > 0) {
        const following = showFile.cues[cueIndex + 1];
        if (following) cueFollowTimerRef.current = window.setTimeout(() => runCue(following), cue.followMs);
      }
    };

    if ((cue.delayMs ?? 0) > 0) window.setTimeout(launch, cue.delayMs);
    else launch();
  }

  function goNextCue() {
    if (nextCue) runCue(nextCue);
    else setMessage(showFile.cues.length ? 'End of cue stack.' : 'Capture a cue before pressing GO.');
  }

  function goPreviousCue() {
    if (!showFile.cues.length) return;
    runCue(showFile.cues[activeCueIndex <= 0 ? 0 : activeCueIndex - 1]);
  }

  function updateCue(id: string) {
    // Update the tracked cue from the programmer/base state, never a transient FX layer.
    const output = [...universeRef.current];
    const outputValues = primaryFixture ? fixtureValues(output, primaryFixture) : primaryValues;
    setShowFile((current) => {
      const cueIndex = current.cues.findIndex((cue) => cue.id === id);
      if (cueIndex < 0) return current;
      const previous = resolveShowCueFrame(current.cues, cueIndex - 1);
      const changes = cueChanges(previous, output);
      return {
        ...current,
        cues: current.cues.map((cue) => cue.id === id
          ? { ...cue, values: { ...outputValues }, changes, universe: output }
          : cue)
      };
    });
    setMessage('Cue updated from live output. Downstream tracked values remain inherited.');
  }

  function cueTimingRule(cue: ShowCue, family: CueTimingFamily): CueTimingRule {
    return cue.timing?.find((rule) => rule.family === family) ?? {
      family,
      fadeMs: cue.fadeMs,
      delayMs: 0,
      curve: 'ease'
    };
  }

  function updateCueTiming(id: string, family: CueTimingFamily, updates: Partial<CueTimingRule>) {
    setShowFile((current) => ({
      ...current,
      cues: current.cues.map((cue) => {
        if (cue.id !== id) return cue;
        const existing = cueTimingRule(cue, family);
        const next = { ...existing, ...updates, family };
        return {
          ...cue,
          timing: [...(cue.timing ?? []).filter((rule) => rule.family !== family), next]
        };
      })
    }));
  }

  function updateCueProperties(id: string, updates: Partial<ShowCue>) {
    setShowFile((current) => ({
      ...current,
      cues: current.cues.map((cue) => cue.id === id ? { ...cue, ...updates } : cue)
    }));
  }

  function deleteCue(id: string) {
    setShowFile((current) => ({
      ...current,
      cues: removeCuePreservingTracking(current.cues, id),
      timeline: current.timeline ? {...current.timeline,clips:current.timeline.clips.filter(c=>c.cueId!==id)} : undefined
    }));
    if (activeCueId === id) setActiveCueId(null);
  }

  function cloudProgramFromDocument(document: CloudSongDocument): SongProgram | null {
    if (!isSongProgram(document.program)) return null;
    let program = structuredClone(document.program);
    const sourceSong = program.show.songs?.[0];
    if (!sourceSong) return null;
    if (sourceSong.name !== document.title) {
      program.show = renameSong(program.show, sourceSong.id, document.title);
    }
    program.id = document.songId;
    program.savedAt = document.updatedAt;
    program.revision = Math.max(program.revision, document.revision);
    program.show = {
      ...program.show,
      name: document.title,
      songs: songsForShow(program.show).map((song, index) => index === 0 ? {
        ...song,
        libraryId: document.songId,
        name: document.title,
        bpm: document.bpm,
        musicalKey: document.musicalKey,
        artist: document.artist,
        arrangement: document.arrangement,
        notes: document.notes,
      } : song),
      timeline: program.show.timeline ? { ...program.show.timeline, bpm: document.bpm } : program.show.timeline,
    };
    return isSongProgram(program) ? program : null;
  }

  async function refreshCloudAccountLibrary() {
    if (!cloudAccount) return;
    try {
      const [songs, labels] = await Promise.all([
        fetchCloudSongLibrary(remoteRelayConfig),
        fetchCloudRecordingLabels(remoteRelayConfig),
      ]);
      setCloudSongDocuments(songs);
      setCloudRecordingLabels(labels);
      for (const document of songs) {
        const program = cloudProgramFromDocument(document);
        if (!program) continue;
        const saved = await upsertSongProgram(program);
        setSongLibrary(saved.programs);
      }
      setShowFile((current) => {
        let nextShow = current;
        for (const document of songs) {
          const matching = songsForShow(nextShow).find((song) => (song.libraryId || song.id) === document.songId);
          if (!matching) continue;
          if (matching.name !== document.title) {
            try { nextShow = renameSong(nextShow, matching.id, document.title); } catch { /* keep current title if a Show name collision exists */ }
          }
          nextShow = {
            ...nextShow,
            songs: songsForShow(nextShow).map((song) => (song.libraryId || song.id) === document.songId ? {
              ...song,
              bpm: document.bpm,
              musicalKey: document.musicalKey,
              artist: document.artist,
              arrangement: document.arrangement,
              notes: document.notes,
            } : song),
            timelineShows: nextShow.timelineShows?.map((timeline) => timeline.name === document.title
              ? { ...timeline, timeline: { ...timeline.timeline, bpm: document.bpm } }
              : timeline),
          };
        }
        return nextShow;
      });
      if (labels.length) {
        const names = new Map(labels.map((item) => [item.takeId, item.label]));
        setShowFile((current) => ({
          ...current,
          recordings: current.recordings?.map((recording) => names.has(recording.id) ? { ...recording, name: names.get(recording.id)! } : recording),
        }));
      }
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    }
  }

  async function syncSongProgramToCloud(program: SongProgram) {
    if (!cloudAccount) return;
    const song = program.show.songs?.[0];
    if (!song) return;
    const known = cloudSongDocuments.find((item) => item.songId === program.id);
    const result = await saveCloudSong(remoteRelayConfig, {
      songId: program.id,
      title: song.name,
      artist: song.artist || '',
      bpm: song.bpm,
      musicalKey: song.musicalKey || '',
      arrangement: song.arrangement || (program.show.creatorSections ?? []).map((section) => section.name),
      notes: song.notes || '',
      program,
      expectedRevision: known?.revision ?? 0,
      deviceId: desktopDeviceId(),
    });
    if (result.conflict) {
      await refreshCloudAccountLibrary();
      throw new Error('This Song changed in the online library. LumaRig pulled the latest cloud version instead of overwriting it.');
    }
    await refreshCloudAccountLibrary();
  }

  async function signInLumaCloud() {
    if (cloudAccountBusy) return;
    setCloudAccountBusy(true);
    setCloudError('');
    try {
      const account = await signInCloudAccount(remoteRelayConfig, cloudLoginEmail, cloudLoginPassword);
      const roomCode = remoteRelayConfig.roomCode || (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''));
      const nextConfig: RemoteRelayConfig = { ...remoteRelayConfig, email: account.email, password: '', roomCode };
      await registerCloudDesktop(nextConfig, appVersion);
      setCloudAccount(account);
      setCloudLoginEmail(account.email);
      setCloudLoginPassword('');
      setRemoteRelayConfig(nextConfig);
      setMessage('LumaRig Cloud signed in. Your library and controller pairing are available on this computer.');
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudAccountBusy(false);
    }
  }

  async function signOutLumaCloud() {
    setCloudAccountBusy(true);
    try {
      await disconnectRemoteRelay();
      await signOutCloudAccount(remoteRelayConfig);
      cloudLibraryUnsubscribeRef.current?.();
      cloudLibraryUnsubscribeRef.current = null;
      setCloudAccount(null);
      setCloudSongDocuments([]);
      setCloudRecordingLabels([]);
      setRemoteRelayConfig((current) => ({ ...current, email: '', password: '' }));
      setMessage('Signed out of LumaRig Cloud. Local Shows, Songs, and DMX continue to work.');
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudAccountBusy(false);
    }
  }
  async function refreshCloudLibrary() {
    setCloudStatus('loading');
    setCloudError('');
    try {
      const library = await fetchCloudShowLibrary(remoteRelayConfig);
      setCloudFolders(library.folders);
      setCloudShows(library.shows);
      setCloudFolderId((current) => current && !library.folders.some((folder) => folder.id === current) ? '' : current);
      setCloudStatus('synced');
    } catch (error) {
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : String(error));
    }
  }

  async function createCloudFolderFromInput() {
    if (!cloudFolderName.trim() || cloudBusy) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      const folder = await createCloudShowFolder(remoteRelayConfig, cloudFolderName.trim());
      setCloudFolderName('');
      setCloudFolders((current) => [...current, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setCloudFolderId(folder.id);
      setCloudStatus('synced');
    } catch (error) {
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudBusy(false);
    }
  }

  async function syncShowSnapshotToCloud(snapshot: ShowProjectSnapshot) {
    const known = cloudShows.find((item) => item.showId === snapshot.id);
    const folderId = cloudFolderId || snapshot.cloudFolderId || null;
    const media = songsForShow(snapshot.show)
      .filter((song): song is SongRecord & { mediaId: string } => Boolean(song.mediaId))
      .filter((song, index, list) => list.findIndex((candidate) => candidate.mediaId === song.mediaId) === index);
    for (let index = 0; index < media.length; index += 1) {
      const song = media[index];
      const blob = await readSongMedia(song.mediaId);
      if (!blob) throw new Error(`Media for "${song.name}" is missing on this computer. Reattach it before cloud sync.`);
      setMessage(`Cloud syncing media ${index + 1}/${media.length} · ${song.mediaName || song.name}`);
      await uploadCloudShowMedia(remoteRelayConfig, snapshot.id, song.mediaId, blob);
    }
    const result = await saveCloudShow(remoteRelayConfig, {
      showId: snapshot.id,
      name: snapshot.name,
      status: snapshot.status,
      snapshot: { ...snapshot, cloudFolderId: folderId },
      folderId,
      expectedRevision: known?.revision ?? snapshot.cloudRevision ?? 0,
      deviceId: desktopDeviceId()
    });
    if (result.conflict) {
      await refreshCloudLibrary();
      throw new Error(`Cloud copy changed on another computer (R${result.revision}). Local save is safe. Load the cloud copy or save again after reviewing it.`);
    }

    const clouded: ShowProjectSnapshot = {
      ...snapshot,
      cloudRevision: result.revision,
      cloudFolderId: folderId
    };
    const projects = [clouded, ...showLibrary.filter((item) => item.id !== clouded.id)].slice(0, 40);
    await saveAppProgramState(showFileRef.current, { workspace: { ...currentWorkspaceCheckpoint(), projects } });
    setShowLibrary(projects);
    try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(projects)); } catch { /* IndexedDB is authoritative. */ }
    await refreshCloudLibrary();
    return result;
  }

  async function importCloudShow(document: CloudShowDocument) {
    if (!isShowProjectSnapshot(document.snapshot)) {
      setCloudError(`${document.name} has an invalid cloud snapshot and was not loaded.`);
      return;
    }
    const snapshot: ShowProjectSnapshot = {
      ...structuredClone(document.snapshot),
      savedAt: document.updatedAt,
      cloudRevision: document.revision,
      cloudFolderId: document.folderId,
      lastEditor: document.lastEditor === 'lumaviz' ? 'lumaviz' : 'lumarig'
    };
    const projects = [snapshot, ...showLibrary.filter((item) => item.id !== snapshot.id)].slice(0, 40);
    try {
      const media = songsForShow(snapshot.show)
        .filter((song): song is SongRecord & { mediaId: string } => Boolean(song.mediaId))
        .filter((song, index, list) => list.findIndex((candidate) => candidate.mediaId === song.mediaId) === index);
      for (let index = 0; index < media.length; index += 1) {
        const song = media[index];
        setMessage(`Downloading cloud media ${index + 1}/${media.length} · ${song.mediaName || song.name}`);
        const blob = await downloadCloudShowMedia(remoteRelayConfig, snapshot.id, song.mediaId);
        const file = blob instanceof File
          ? blob
          : new File([blob], song.mediaName || `${song.mediaId}.media`, { type: blob.type || 'application/octet-stream' });
        await storeSongMedia(song.mediaId, file);
      }
      await saveAppProgramState(showFileRef.current, { workspace: { ...currentWorkspaceCheckpoint(), projects } });
      setShowLibrary(projects);
      try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(projects)); } catch { /* IndexedDB is authoritative. */ }
      setCloudFolderId(document.folderId || '');
      await loadShowProject(snapshot);
      setMessage(`${document.name} downloaded from Cloud Shows and stored locally.`);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveShowProject(status: 'template' | 'draft' | 'show' = 'show') {
    if (!libraryReady) { setMessage('Song Library is not ready to save.'); return; }
    const cleanName = showFile.name.trim() || 'Untitled Show';
    const existing = showLibrary.find((item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.status === status);
    const snapshot: ShowProjectSnapshot = {
      id: existing?.id ?? `show-${Date.now().toString(36)}`,
      name: cleanName,
      savedAt: new Date().toISOString(),
      status,
      templateId: status === 'template' ? undefined : showLibrary.find((item) => item.status === 'template')?.id,
      revision: sharedShowRevisionRef.current,
      lastEditor: 'lumarig',
      cloudRevision: existing?.cloudRevision,
      cloudFolderId: existing?.cloudFolderId,
      show: sanitizeShow({ ...showFile, name: cleanName }),
      patch: patch.map((fixture, index) => migratePatchedFixture(fixture, index, patch.length, stageSettings.dimensions)),
      stageElements: stageElements.map((element) => migrateStageElement(element, stageSettings.dimensions)),
      stageSettings: { ...stageSettings, dimensions: { ...stageSettings.dimensions } },
      looks: [...savedLooks]
    };
    const nextLibrary = [snapshot, ...showLibrary.filter(item => item.id !== snapshot.id)].slice(0, 40);
    try {
      await saveAppProgramState(showFileRef.current, { workspace: { ...currentWorkspaceCheckpoint(), projects: nextLibrary } });
      try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(nextLibrary)); } catch { /* Authoritative checkpoint already committed. */ }
    } catch (error) {
      setSaveStatus('Save failed');
      setMessage(`Show Save failed: ${String(error)}`);
      return;
    }

    setShowLibrary(nextLibrary);
    const localMessage = `${cleanName} saved locally as ${status === 'template' ? 'a template' : status === 'draft' ? 'a draft' : 'a service show'}.`;
    if (remoteRelayStatus !== 'connected') {
      setMessage(`${localMessage} Cloud sync is offline.`);
      return;
    }

    setCloudBusy(true);
    try {
      const result = await syncShowSnapshotToCloud(snapshot);
      setCloudStatus('synced');
      setCloudError('');
      setMessage(`${localMessage} Cloud Shows synced at R${result.revision}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setCloudStatus('error');
      setCloudError(detail);
      setMessage(`${localMessage} Cloud sync failed: ${detail}`);
    } finally {
      setCloudBusy(false);
    }
  }

  async function checkpointShowChange(next: ShowFile, workspace = currentWorkspaceCheckpoint()): Promise<boolean> {
    if (!libraryReady || transitionRef.current) { setMessage('Wait for the Song Library to finish saving before changing Shows.'); return false; }
    transitionRef.current = true; setTransitionBusy(true);
    const current = showFileRef.current;
    const outgoingWorkspace = currentWorkspaceCheckpoint();
    ++saveSequence.current; setSaveStatus('Saving…');
    try {
      const saved = await saveAppProgramState(next, { recover: current, capture: 'none', workspace, recoverWorkspace: outgoingWorkspace });
      if (showFileRef.current !== current || JSON.stringify(currentWorkspaceCheckpoint()) !== JSON.stringify(outgoingWorkspace)) {
        const latest = await saveAppProgramState(showFileRef.current, { workspace: currentWorkspaceCheckpoint() });
        setSongLibrary(latest.programs); setShowRecovery(latest.recovery);
        setSaveStatus('Saved');
        setMessage('The Show changed while saving. Your latest work is saved. Retry the Show change.');
        return false;
      }
      setSongLibrary(saved.programs); setShowRecovery(saved.recovery); setSaveStatus('Saved');
      return true;
    } catch (error) { setSaveStatus('Save failed'); setMessage(`Show change cancelled: ${String(error)}`); return false; }
    finally { transitionRef.current = false; setTransitionBusy(false); }
  }
  async function loadShowProject(snapshot: ShowProjectSnapshot) {
    if (!await checkpointShowChange(sanitizeShow(snapshot.show), { ...currentWorkspaceCheckpoint(), patch:snapshot.patch, stageElements:snapshot.stageElements, stageSettings:snapshot.stageSettings, looks:snapshot.looks })) return;
    setActiveSongId(''); setTimelineShowId(''); setCueTimelineSong(null);
    clearShowAudio();
    stopFade();
    clearBusk(false);
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    const loaded = sanitizeShow(snapshot.show);
    setShowFile({ ...loaded, songs: songsForShow(loaded).map(song => ({ ...song, libraryId: programId(loaded, song) })) });
    setPatch(snapshot.patch.map((fixture, index) => migratePatchedFixture(fixture, index, snapshot.patch.length, snapshot.stageSettings.dimensions)));
    setStageElements(snapshot.stageElements.map((element) => migrateStageElement(element, snapshot.stageSettings.dimensions)));
    setStageSettings(snapshot.stageSettings);
    setSavedLooks(snapshot.looks);
    setCloudFolderId(snapshot.cloudFolderId || '');
    setActiveCueId(null);
    setSelectedStageElementId(null);
    setMessage(`${snapshot.name} loaded from the show library.`);
  }

  async function newShowProject() {
    const usedNames = new Set(showLibrary.map(item => item.name.toLowerCase()));
    let nextName = 'Untitled Show', count = 1;
    while (usedNames.has(nextName.toLowerCase())) nextName = `Untitled Show ${++count}`;
    const next: ShowFile = { ...structuredClone(EMPTY_SHOW), name: nextName };
    if (!await checkpointShowChange(next)) return;
    setActiveSongId(''); setTimelineShowId(''); setCueTimelineSong(null);
    clearShowAudio();
    stopFade();
    clearBusk(false);
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    setShowFile(next);
    setActiveCueId(null);
    setMessage('New Show started. Your songs are saved in Song Library and the previous Show is available in Recovery.');
  }

  async function deleteShowProject(id: string) {
    const item = showLibrary.find((entry) => entry.id === id);
    if (!item || !libraryReady) return;
    const projects = showLibrary.filter((entry) => entry.id !== id);
    try {
      await saveAppProgramState(showFileRef.current, { workspace: { ...currentWorkspaceCheckpoint(), projects } });
      setShowLibrary(projects);
      try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(projects)); } catch { /* IndexedDB is authoritative. */ }
      setMessage(`${item.name} removed from the local show library. Cloud copy is unchanged.`);
    } catch (error) {
      setMessage(`Could not remove ${item.name}: ${String(error)}`);
    }
  }

  async function loadShowAudioFile(file: File) {
    const token = ++mediaLoadToken.current;
    const song = songsForShow(showFile).find(s => s.id === activeSongId || s.name === showFile.timelineShows?.find(t => t.id === timelineShowId)?.name);
    try {
      if (song) await attachBankMedia(song, file);
      else {
        const mediaId=crypto.randomUUID(),id=crypto.randomUUID();
        await storeSongMedia(mediaId,file);
        if(token!==mediaLoadToken.current)return;
        const name=file.name.replace(/\.[^.]+$/,'') || 'Imported media';
        const imported={id,libraryId:id,name,bpm:masterTempoBpm,mediaId,mediaName:file.name};
        const clipIds=new Set(editingTimeline.clips.map(c=>c.cueId));
        setShowFile(current=>({...current,songs:[...songsForShow(current),imported],cues:current.cues.map(c=>clipIds.has(c.id)?{...c,trackName:name,trackKind:'media' as const}:c),timelineShows:[...(current.timelineShows??[]),{id,name,timeline:{...editingTimeline,audioName:file.name}}]}));
        setActiveSongId(id);setTimelineShowId(id);
      }
      if (token !== mediaLoadToken.current) return;
      activateMedia(file, file.name);
      updateEditingTimeline({...editingTimeline,audioName:file.name});
      setMessage(`${file.name} loaded${song ? ' and saved to Song Bank' : ''}.`);
    } catch (error) { setMessage(String(error)); }
  }
  function loadShowTrack(event: ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; if(file) loadShowAudioFile(file); event.target.value='';
  }
  function clearShowAudio() {
    ++mediaLoadToken.current;setActiveSongId('');setTimelineShowId('');setCueTimelineSong(null);
    showTrackAudioRef.current?.pause();
    if(showTrackUrlRef.current) URL.revokeObjectURL(showTrackUrlRef.current);
    showTrackUrlRef.current=''; setShowTrackUrl(''); setShowTrackName('');setShowTrackDurationMs(0);setShowTrackPositionMs(0);stopTimeline();
  }

  function captureShowRecordingFrame(timeMs: number) {
    if (showRecordingFramesRef.current.length >= MAX_RECORDING_FRAMES) return false;
    const next = [...outputUniverseRef.current];
    const origin=timelineRecordingOrigin.current;
    const updates = origin?.overdub ? origin.manual.changes(showRecordingLastUniverseRef.current,next) : diffUniverse(showRecordingLastUniverseRef.current, next);
    if (updates.length > 0) {
      showRecordingFramesRef.current.push({ timeMs: Math.max(0, Math.round(timeMs)), updates });
      showRecordingLastUniverseRef.current = next;
    }
    return showRecordingFramesRef.current.length < MAX_RECORDING_FRAMES;
  }

  function captureElapsedNow() {
    const origin=timelineRecordingOrigin.current,audio=showTrackAudioRef.current;
    if(recordingPausedRef.current)return recordingElapsedRef.current;
    if(origin)return origin.audioStarted && audio && !audio.paused ? Math.max(0,origin.leadInMs+audio.currentTime*1000-origin.sourceStartMs) : Math.max(recordingElapsedRef.current,performance.now()-showRecordingStartedRef.current);
    return showTrackUrlRef.current && audio ? Math.max(recordingElapsedRef.current,audio.currentTime*1000) : Math.max(recordingElapsedRef.current,performance.now()-showRecordingStartedRef.current);
  }
  function stopShowRecording(save = true) {
    if (!showRecordingActiveRef.current) return;
    const audio = showTrackAudioRef.current;
    const origin=timelineRecordingOrigin.current;
    const durationMs = captureElapsedNow();
    captureShowRecordingFrame(durationMs);
    showRecordingActiveRef.current = false;
    recordingPausedRef.current=false;setRecordingPaused(false);
    setShowRecordingActive(false);
    if (showRecordingAnimationRef.current !== null) cancelAnimationFrame(showRecordingAnimationRef.current);
    showRecordingAnimationRef.current = null;
    audio?.pause();
    setShowTrackPositionMs(durationMs);
    timelineRecordingOrigin.current=null;timelinePlayingRef.current=false;setTimelinePlaying(false);
    setWorkspace('show');
    if(origin){setTimelineShowId(origin.id);setShowMode('timeline');setCueTimelineSong(null);timelinePositionRef.current=origin.startBar;setTimelinePositionBar(origin.startBar);}
    if (!save) {
      showRecordingFramesRef.current = [];
      setMessage('Show recording canceled.');
      return;
    }
    const recording: ShowRecording = {
      id: `recording-${Date.now().toString(36)}`,
      name: recordingTakeName.trim() || `Recorded take ${(showFile.recordings?.length ?? 0) + 1}`,
      trackName: showTrackName,
      durationMs: Math.round(durationMs),
      createdAt: new Date().toISOString(),
      frames: showRecordingFramesRef.current
    };
    const clip=origin?timelineCaptureClip(recording,origin.startBar,60000/origin.barMs*origin.timeline.beatsPerBar,origin.timeline.beatsPerBar):null;
    setShowFile(current=>{
      const next={...current,recordings:[...current.recordings??[],recording].slice(-24)};
      if(!clip || !origin)return next;
      if(origin.id)return {...next,timelineShows:next.timelineShows?.map(item=>item.id===origin.id?{...item,timeline:appendTimelineCapture(item.timeline,clip)}:item)};
      return {...next,timeline:appendTimelineCapture(next.timeline??EMPTY_TIMELINE,clip)};
    });
    if(clip){activeTimelineClipRef.current=clip.id;setActiveTimelineClipId(clip.id);stopEffect(false);}
    if (cloudAccount) {
      const song = songsForShow(showFileRef.current).find((item) => item.id === activeSongId);
      void saveCloudRecordingLabel(remoteRelayConfig, {
        takeId: recording.id,
        songId: song ? programId(showFileRef.current, song) : null,
        showId: showFileRef.current.name,
        label: recording.name,
      }).then(() => refreshCloudAccountLibrary()).catch((error) => setCloudError(error instanceof Error ? error.message : String(error)));
    }

    setMessage(`${recording.name}${origin?' recorded directly into Timeline':''} saved with ${recording.frames.length.toLocaleString()} lighting changes.`);
  }

  function startShowRecording() {
    if (showRecordingActiveRef.current) return;
    if (playingRecordingIdRef.current) stopRecordedShowPlayback(false);
    const initialFrame: ShowRecordingFrame = {
      timeMs: 0,
      updates: timelineRecordingOrigin.current?.overdub ? [] : outputUniverseRef.current.map((value, index) => [index + 1, value] as const)
    };
    showRecordingFramesRef.current = [initialFrame];
    showRecordingLastUniverseRef.current = [...outputUniverseRef.current];
    showRecordingStartedRef.current = performance.now();
    recordingElapsedRef.current=0;recordingPausedRef.current=false;setRecordingPaused(false);
    showRecordingLastSampleRef.current = 0;
    showRecordingActiveRef.current = true;
    setShowRecordingActive(true);
    setShowRecordingElapsedMs(0);
    const audio = showTrackAudioRef.current;
    if (audio && showTrackUrlRef.current) {
      const origin=timelineRecordingOrigin.current;
      audio.currentTime=(origin?.sourceStartMs??0)/1000;
      setShowTrackPositionMs(origin?.sourceStartMs??0);
      if(!origin || (!origin.leadInMs && origin.sourceStartMs<origin.sourceEndMs)){if(origin)origin.audioStarted=true;void audio.play().catch(() => setMessage('Lighting is recording, but the desktop audio engine did not start the track. Press Stop, then try Record again.'));}
    }
    const tick = (now: number) => {
      if (!showRecordingActiveRef.current) return;
      if(recordingPausedRef.current){showRecordingAnimationRef.current=requestAnimationFrame(tick);return;}
      const origin=timelineRecordingOrigin.current,currentAudio=showTrackAudioRef.current;
      if(origin && !origin.audioStarted && showTrackUrlRef.current && currentAudio && now-showRecordingStartedRef.current>=origin.leadInMs && origin.sourceStartMs<origin.sourceEndMs){origin.audioStarted=true;void currentAudio.play().catch(error=>setMessage(String(error)));}
      const elapsed = captureElapsedNow();
      if(origin){
        const absolute=origin.startBar*origin.barMs+elapsed;
        timelinePositionRef.current=absolute/origin.barMs;setTimelinePositionBar(timelinePositionRef.current);updateTimelineVideoFrame(absolute);
        if(origin.overdub){
          const frame=applyUniverseUpdates(makeUniverse(),renderShowTimeline(origin.timeline,origin.cues,patchRef.current,absolute,makeUniverse()));
          void commitUniverse(origin.manual.mix(frame),'recorder');
        }
        if(currentAudio && origin.audioStarted && currentAudio.currentTime*1000>=origin.sourceEndMs){stopShowRecording(true);return;}
      }
      if (elapsed - showRecordingLastSampleRef.current >= RECORDING_SAMPLE_MS) {
        showRecordingLastSampleRef.current = elapsed;
        const hasRoom = captureShowRecordingFrame(elapsed);
        recordingElapsedRef.current=elapsed;
        setShowRecordingElapsedMs(elapsed);
        setShowTrackPositionMs(elapsed);
        if (!hasRoom) {
          stopShowRecording(true);
          setMessage('Recording reached its 15-minute event limit and was saved.');
          return;
        }
      }
      showRecordingAnimationRef.current = requestAnimationFrame(tick);
    };
    showRecordingAnimationRef.current = requestAnimationFrame(tick);
    setMessage(showTrackName ? `Recording lights live with ${showTrackName}.` : 'Recording lights live without an audio track.');
  }

  function stopRecordedShowPlayback(announce = true) {
    if (!playingRecordingIdRef.current) return;
    playingRecordingIdRef.current = null;
    setPlayingRecordingId(null);
    recordingPlaybackExternalRef.current = false;
    if (recordingPlaybackAnimationRef.current !== null) cancelAnimationFrame(recordingPlaybackAnimationRef.current);
    recordingPlaybackAnimationRef.current = null;
    showTrackAudioRef.current?.pause();
    if (announce) setMessage('Recorded-show playback stopped. Current lighting output is held.');
  }

  function prepareRecordingAt(recording: ShowRecording, positionMs: number) {
    let playbackUniverse = makeUniverse();
    let frameIndex = 0;
    while (frameIndex < recording.frames.length && recording.frames[frameIndex].timeMs <= positionMs) {
      playbackUniverse = applyUniverseUpdates(playbackUniverse, recording.frames[frameIndex].updates);
      frameIndex += 1;
    }
    recordingPlaybackUniverseRef.current = playbackUniverse;
    recordingPlaybackIndexRef.current = frameIndex;
    void commitOutputUniverse(playbackUniverse, recordingPlaybackExternalRef.current ? 'sync' : 'recorder');
  }

  function playShowRecording(recording: ShowRecording, options: { external?: boolean; positionMs?: number } = {}) {
    if (showRecordingActiveRef.current) return setMessage('Stop the active recording before playing a saved take.');
    stopRecordedShowPlayback(false);
    stopFade();
    if (activeEffectRef.current || activeCustomEffectIdRef.current) stopEffect(false);
    setAudioArmed(false);
    audioArmedRef.current = false;
    const external = Boolean(options.external);
    const startPosition = Math.max(0, Math.min(recording.durationMs, options.positionMs ?? 0));
    setSelectedRecordingId(recording.id);
    playingRecordingIdRef.current = recording.id;
    setPlayingRecordingId(recording.id);
    recordingPlaybackExternalRef.current = external;
    recordingPlaybackStartedRef.current = performance.now() - startPosition;
    recordingPlaybackLastUiRef.current = startPosition;
    prepareRecordingAt(recording, startPosition);
    setShowTrackPositionMs(startPosition);
    const audio = showTrackAudioRef.current;
    const hasMatchingTrack = !external && Boolean(showTrackUrlRef.current && showTrackName === recording.trackName && audio);
    if (hasMatchingTrack && audio) {
      audio.currentTime = startPosition / 1000;
      void audio.play().catch(() => setMessage('The lighting take is playing, but the desktop audio engine did not start the audio track.'));
    }
    const tick = (now: number) => {
      if (playingRecordingIdRef.current !== recording.id) return;
      const currentAudio = showTrackAudioRef.current;
      const elapsed = recordingPlaybackExternalRef.current
        ? applyLightingOffset(externalSongPositionMsRef.current, externalLightingOffsetRef.current)
        : hasMatchingTrack && currentAudio && !currentAudio.paused
        ? currentAudio.currentTime * 1000
        : now - recordingPlaybackStartedRef.current;
      let changed = false;
      while (recordingPlaybackIndexRef.current < recording.frames.length
        && recording.frames[recordingPlaybackIndexRef.current].timeMs <= elapsed) {
        const frame = recording.frames[recordingPlaybackIndexRef.current];
        recordingPlaybackUniverseRef.current = applyUniverseUpdates(recordingPlaybackUniverseRef.current, frame.updates);
        recordingPlaybackIndexRef.current += 1;
        changed = true;
      }
      if (changed) void commitOutputUniverse(recordingPlaybackUniverseRef.current, recordingPlaybackExternalRef.current ? 'sync' : 'recorder');
      if (elapsed - recordingPlaybackLastUiRef.current >= 100 || elapsed >= recording.durationMs) {
        recordingPlaybackLastUiRef.current = elapsed;
        setShowTrackPositionMs(Math.min(elapsed, recording.durationMs));
      }
      if (elapsed < recording.durationMs) recordingPlaybackAnimationRef.current = requestAnimationFrame(tick);
      else {
        stopRecordedShowPlayback(false);
        setMessage(`${recording.name} playback complete.`);
      }
    };
    recordingPlaybackAnimationRef.current = requestAnimationFrame(tick);
    if (external) setMessage(`${recording.name} is following ${externalTrack.songName || 'the external song'} at ${formatShowTime(startPosition)}.`);
    else setMessage(hasMatchingTrack ? `Playing ${recording.name} with ${recording.trackName}.` : `Playing ${recording.name} lights only. Load ${recording.trackName || 'its track'} for synchronized audio.`);
  }

  function pauseRecorderTransport() {
    if(showRecordingActiveRef.current){if(timelineRecordingOrigin.current){timelinePlayingRef.current=false;setTimelinePlaying(false);updateTimelineVideoFrame(timelinePositionRef.current*timelineRecordingOrigin.current.barMs);}recordingPausedRef.current=true;recordingPausedAt.current=performance.now();setRecordingPaused(true);showTrackAudioRef.current?.pause();return;}
    if(playingRecordingIdRef.current){pausedTakeRef.current={id:playingRecordingIdRef.current,position:showTrackPositionMs};stopRecordedShowPlayback(false);}
    showTrackAudioRef.current?.pause();
  }
  function playRecorderTransport() {
    if(showRecordingActiveRef.current){
      if(recordingPausedRef.current){if(timelineRecordingOrigin.current){timelinePlayingRef.current=true;setTimelinePlaying(true);}showRecordingStartedRef.current+=performance.now()-recordingPausedAt.current;recordingPausedRef.current=false;setRecordingPaused(false);if(showTrackUrlRef.current)void showTrackAudioRef.current?.play().catch(error=>setMessage(String(error)));}
      return;
    }
    const take=showFile.recordings?.find(t=>t.id===selectedRecordingId);
    if(take){playShowRecording(take,{positionMs:pausedTakeRef.current?.id===take.id?pausedTakeRef.current.position:showTrackPositionMs});pausedTakeRef.current=null;}
    else if(showTrackUrlRef.current)void showTrackAudioRef.current?.play().catch(error=>setMessage(String(error)));
  }
  function seekRecorderTransport(position:number) {
    if(showRecordingActiveRef.current)return;
    const take=showFile.recordings?.find(t=>t.id===selectedRecordingId);
    const next=Math.max(0,Math.min(take?.durationMs ?? showTrackDurationMs,position));
    const wasPlaying=Boolean(playingRecordingIdRef.current);
    stopRecordedShowPlayback(false);showTrackAudioRef.current?.pause();
    if(showTrackAudioRef.current && showTrackAudioRef.current.readyState>=1)showTrackAudioRef.current.currentTime=next/1000;
    setShowTrackPositionMs(next);
    timelinePositionRef.current=next*masterTempoBpm/60000/editingTimeline.beatsPerBar;setTimelinePositionBar(timelinePositionRef.current);
    if(take){prepareRecordingAt(take,next);pausedTakeRef.current={id:take.id,position:next};if(wasPlaying)playShowRecording(take,{positionMs:next});}
  }
  function toggleShowTrackPreview() {
    const audio = showTrackAudioRef.current;
    if (!audio || !showTrackUrlRef.current || showRecordingActive || playingRecordingId) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function deleteShowRecording(recording: ShowRecording) {
    if (!window.confirm(`Delete ${recording.name}? This recorded lighting timeline cannot be recovered.`)) return;
    if (playingRecordingId === recording.id) stopRecordedShowPlayback(false);
    setShowFile((current) => ({
      ...current,
      recordings: (current.recordings ?? []).filter((item) => item.id !== recording.id),
      externalTrack: current.externalTrack?.recordingId === recording.id
        ? { ...current.externalTrack, recordingId: '', armed: false }
        : current.externalTrack
    }));
    setMessage(`${recording.name} deleted.`);
  }

  function handleShowTrackEnded() {
    if (showRecordingActiveRef.current) stopShowRecording(true);
    else if (playingRecordingIdRef.current) {
      const name = showFile.recordings?.find((recording) => recording.id === playingRecordingIdRef.current)?.name ?? 'Recorded show';
      stopRecordedShowPlayback(false);
      setMessage(`${name} playback complete.`);
    }
  }

  function updateExternalTrack(updates: Partial<typeof DEFAULT_EXTERNAL_TRACK_SYNC>) {
    setShowFile((current) => ({
      ...current,
      externalTrack: { ...DEFAULT_EXTERNAL_TRACK_SYNC, ...current.externalTrack, ...updates }
    }));
  }

  function assignExternalRecording(recordingId: string) {
    const recording = showFile.recordings?.find((item) => item.id === recordingId);
    externalTransportRunningRef.current = false;
    setExternalTransportRunning(false);
    if (recordingPlaybackExternalRef.current) stopRecordedShowPlayback(false);
    updateExternalTrack({
      recordingId,
      armed: false,
      songName: externalTrack.songName || recording?.trackName.replace(/\.[^.]+$/, '') || recording?.name || ''
    });
    setExternalSongPositionMs(0);
    externalSongPositionMsRef.current = 0;
    setMessage(recording ? `${recording.name} assigned to the external song.` : 'External song assignment cleared.');
  }

  function toggleExternalTrackArm() {
    if (externalTrack.armed) {
      externalTransportRunningRef.current = false;
      setExternalTransportRunning(false);
      if (recordingPlaybackExternalRef.current) stopRecordedShowPlayback(false);
      updateExternalTrack({ armed: false });
      setMessage('External track sync disarmed.');
      return;
    }
    if (!externalTrackRecording) {
      setMessage('Choose a recorded lighting take before arming external sync.');
      return;
    }
    updateExternalTrack({ armed: true });
    if (!tempoLockedRef.current) { setTempoSource('midi'); tempoSourceRef.current = 'midi'; }
    setMessage(midiStatus.connected
      ? `External sync armed for ${externalTrack.songName || externalTrackRecording.name}. Press Play in your DAW.`
      : 'External sync armed. Connect your DAW MIDI input in Connect, then press Play in the DAW.');
  }

  async function checkForUpdates(silent = false) {
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const update = await invoke<UpdateMetadata | null>('check_for_update');
      if (update) {
        setUpdateInfo(update);
        setAppVersion(update.currentVersion);
        setUpdateStatus('available');
        if (!silent) setMessage(`LumaRig ${update.version} is ready to install.`);
      } else {
        setUpdateInfo(null);
        setUpdateStatus('current');
        if (!silent) setMessage(`LumaRig ${appVersion} is up to date.`);
      }
    } catch (error) {
      if (silent) {
        setUpdateStatus('idle');
        return;
      }
      const detail = String(error);
      setUpdateError(detail);
      setUpdateStatus('error');
      setMessage(`Update check failed: ${detail}`);
    }
  }

  async function installAvailableUpdate() {
    if (!updateInfo || updateStatus === 'installing') return;
    setUpdateStatus('installing');
    setUpdateError('');
    setMessage(`Preparing LumaRig ${updateInfo.version}. Lighting output will be safely disconnected before restart.`);
    try {
      stopFade();
      stopEffect(false);
      setAudioArmed(false);
      if (dmxStatus.connected) {
        await invoke('disconnect_dmx');
        await refreshDmxStatus();
      }
      await invoke('install_update');
      setMessage('Update installed. Restarting LumaRig…');
    } catch (error) {
      const detail = String(error);
      setUpdateError(detail);
      setUpdateStatus('error');
      setMessage(`Update failed: ${detail}`);
    }
  }

  async function connectDmx() {
    if (!selectedDevice) return;
    setBusy(true);
    try {
      await invoke('connect_dmx', { deviceKey: selectedDevice });
      await invoke('set_universe', { values: universeRef.current });
      await refreshDmxStatus();
      setMessage('uDMX connected. The current control-station output is live.');
    } catch (error) { setMessage(`Connection failed: ${String(error)}`); }
    finally { setBusy(false); }
  }

  async function disconnectDmx() {
    stopFade(); stopEffect(false); setAudioArmed(false); setBusy(true);
    try {
      await invoke('disconnect_dmx');
      await refreshDmxStatus();
      setMessage('uDMX output zeroed and disconnected.');
    } catch (error) { setMessage(`Disconnect failed: ${String(error)}`); }
    finally { setBusy(false); }
  }

  async function zeroAll() {
    stopFade(); stopEffect(false); setAudioArmed(false);
    await commitUniverse(makeUniverse(), 'ui');
    setMessage('All 512 programmed channels set to zero.');
  }

  async function setBlackoutState(active: boolean, source: ControlSource = 'ui') {
    try {
      const native='__TAURI_INTERNALS__' in window;
      if(native)await invoke('set_blackout', { enabled: active });
      await dispatchControl({ type: 'blackout.set', active }, source);
      setDmxStatus(current=>({...current,blackout:active}));
      if(native)await refreshDmxStatus();
      setMessage(active ? 'BLACKOUT active. Programmed values are preserved.' : 'Blackout released.');
    } catch (error) { setMessage(`Blackout failed: ${String(error)}`); }
  }

  async function toggleBlackout() {
    if (dmxStatus.blackout && settings.confirmBlackoutRelease && !window.confirm('Release blackout and restore programmed output?')) return;
    await setBlackoutState(!dmxStatus.blackout, 'ui');
  }

  async function dispatchStudioBridgeCommand(id: string, command: StudioBridgeCommand) {
    const dispatcher = new StudioBridgeDispatcher({
      createShow: (identity: StudioSongIdentity) => {
        const existing = showLibrary.find((item) => item.name.toLowerCase() === identity.songTitle.toLowerCase());
        if (existing) return existing.id;
        const snapshot: ShowProjectSnapshot = {
          id: `show-${identity.songId}`,
          name: identity.songTitle,
          savedAt: new Date().toISOString(),
          status: 'show',
          templateId: showLibrary.find((item) => item.status === 'template')?.id,
          revision: sharedShowRevisionRef.current,
          lastEditor: 'lumarig',
          show: sanitizeShow({
            ...EMPTY_SHOW,
            name: identity.songTitle,
            cues: [],
            groups: [],
            positionPalettes: [],
            recordings: [],
            externalTrack: {
              ...DEFAULT_EXTERNAL_TRACK_SYNC,
              songName: identity.songTitle,
              bpm: identity.bpm
            }
          }),
          patch: patch.map((fixture, index) =>
            migratePatchedFixture(fixture, index, patch.length, stageSettings.dimensions)
          ),
          stageElements: stageElements.map((element) =>
            migrateStageElement(element, stageSettings.dimensions)
          ),
          stageSettings: {
            ...stageSettings,
            dimensions: { ...stageSettings.dimensions }
          },
          looks: [...savedLooks]
        };
        setShowLibrary((current) =>
          [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 40)
        );
        return snapshot.id;
      },
      loadShow: async (showId) => {
        const snapshot = showLibrary.find((item) => item.id === showId);
        if (!snapshot) throw new Error('The linked LumaRig show is missing from this device.');
        await loadShowProject(snapshot);
      },
      goCue: (cueId) => {
        const cue = cueId ? showFile.cues.find((item) => item.id === cueId) : nextCue;
        if (!cue) throw new Error('No LumaRig cue is available.');
        const cueIndex = showFile.cues.findIndex((item) => item.id === cue.id);
        const target = cueIndex >= 0
          ? resolveShowCueFrame(showFile.cues, cueIndex)
          : cue.universe?.length === 512
            ? [...cue.universe]
            : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));
        fadeCueToUniverse(cue, target, 'remote');
        setActiveCueId(cue.id);
      },
      fireScene: (sceneId) => {
        const cue = showFile.cues.find((item) => item.id === sceneId);
        if (!cue) throw new Error('LumaRig scene was not found.');
        const cueIndex = showFile.cues.findIndex((item) => item.id === cue.id);
        const target = cueIndex >= 0
          ? resolveShowCueFrame(showFile.cues, cueIndex)
          : cue.universe?.length === 512
            ? [...cue.universe]
            : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));
        fadeCueToUniverse(cue, target, 'remote');
        setActiveCueId(cue.id);
      },
      startEffect: (effectId) => {
        if (!EFFECT_PRESETS.some((effect) => effect.id === effectId)) {
          throw new Error('Unknown LumaRig effect.');
        }
        startEffect(effectId as EffectId);
      },
      stopEffect: () => stopEffect(),
      startRecording: (_songId, songTitle, bpm) => {
        setShowTrackName(songTitle);
        setRecordingTakeName(
          `${songTitle} · Studio Take ${(showFile.recordings?.length ?? 0) + 1}`
        );
        if (!tempoLockedRef.current) { setEffectBpm(bpm); effectBpmRef.current = bpm; }
        startShowRecording();
      },
      stopRecording: () => stopShowRecording(true),
      playRecording: (recordingId, offsetMs) => {
        const recording = showFile.recordings?.find((item) => item.id === recordingId);
        if (!recording) throw new Error('Recorded lighting take was not found.');
        playShowRecording(recording, { external: true, positionMs: offsetMs });
      },
      stopRecordingPlayback: () => stopRecordedShowPlayback(false),
      setBlackout: (enabled) => setBlackoutState(enabled, 'remote'),
      syncTransport: (playing, positionMs, bpm) => {
        const result=applySharedTransport({
          source:'studio',
          playing,
          positionMs,
          bpm,
          claim:playing,
          release:!playing
        });
        if(!result.accepted) throw new Error(`Transport authority is currently held by ${result.state.source}.`);
      }
    });
    return dispatcher.dispatch(id, command);
  }

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const requests = await invoke<Array<{ id: string; command: StudioBridgeCommand }>>(
          'drain_studio_bridge'
        );
        for (const request of requests) {
          const response = await dispatchStudioBridgeCommand(request.id, request.command);
          await invoke('reply_studio_bridge', response);
        }
      } catch {
        // Native Studio bridge is optional in browser/Vite development.
      }
    };
    const timer = window.setInterval(() => void poll(), 25);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    showLibrary,
    showFile,
    patch,
    stageElements,
    stageSettings,
    savedLooks,
    nextCue
  ]);

  function addFixture() {
    const mode = newProfile.modes.find((item) => item.id === newModeId) ?? newProfile.modes[0];
    if (!newProfile.verified && !profileAcknowledged) return setMessage('Confirm that you checked the fixture manual before adding this starter profile.');
    const quantity = Math.max(1, Math.min(64, Math.round(newFixtureQuantity)));
    const candidates: PatchedFixture[] = [];
    const existingProfileCount = patch.filter((item) => item.profileId === newProfile.id).length;
    for (let index = 0; index < quantity; index += 1) {
      const sequence = existingProfileCount + index + 1;
      const address = newFixtureAddress + mode.channelCount * index;
      const baseName = newFixtureName.trim();
      const candidate = migratePatchedFixture({
        id: `fixture-${Date.now().toString(36)}-${index}`,
        name: baseName ? (quantity === 1 ? baseName : `${baseName} ${index + 1}`) : `${newProfile.model} ${sequence}`,
        profileId: newProfile.id,
        modeId: mode.id,
        universe: 1,
        address,
        group: newFixtureGroup.trim(),
        selected: true,
        collapsed: false,
        stageX: Math.min(90, 18 + (patch.length + index) * 12),
        stageY: 14,
        stageDepth: 35,
        stageDirection: 0,
        labelColor: newProfile.category === 'Moving Head' ? '#35a7ff' : ['#55e98d', '#b765ff', '#ff4f9f', '#f7be45'][patch.length % 4]
      }, patch.length + index, patch.length + quantity, stageSettings.dimensions);
      const error = validatePatch(candidate, [...patch, ...candidates]);
      if (error) return setMessage(`Cannot add fixture ${index + 1}: ${error}`);
      candidates.push(candidate);
    }
    setPatch((current) => [...current, ...candidates]);
    setNewFixtureName('');
    setNewFixtureAddress(fixtureEndAddress(candidates[candidates.length - 1]) + 1);
    setProfileAcknowledged(false);
    setMessage(`${candidates.length} ${newProfile.model}${candidates.length === 1 ? '' : ' fixtures'} patched from ${addressLabel(candidates[0].address)}.`);
  }

  function savePatchedFixture(next: PatchedFixture) {
    const candidate = migratePatchedFixture({ ...next, name: next.name.trim() || 'Fixture', group: next.group.trim() || 'Ungrouped' }, patch.findIndex((fixture) => fixture.id === next.id), patch.length, stageSettings.dimensions);
    const error = validatePatch(candidate, patch);
    if (error) return setMessage(error);
    setPatch((current) => current.map((fixture) => fixture.id === candidate.id ? candidate : fixture));
    if (candidate.id === stageFixtureId) setOrganizerDraft(candidate);
    setMessage(`${candidate.name} patch updated.`);
  }

  function updateStageFixtureTransform(
    kind: 'position' | 'rotation',
    axis: 'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'roll',
    value: number
  ) {
    if (!stageFixture) return;
    const currentTransform = fixtureTransform(stageFixture, patch.indexOf(stageFixture), patch.length, stageSettings.dimensions);
    const nextTransform = kind === 'position'
      ? { ...currentTransform, position: { ...currentTransform.position, [axis]: value } }
      : { ...currentTransform, rotation: { ...currentTransform.rotation, [axis]: value } };
    const nextFixture = { ...stageFixture, transform: nextTransform };
    setOrganizerDraft(nextFixture);
    setPatch((current) => current.map((fixture) => fixture.id === stageFixture.id ? nextFixture : fixture));
  }

  async function aimAtTarget(target: TargetPoint) {
    if (!selectedMovingFixtures.length) {
      setMessage('Select at least one moving fixture before using AIM.');
      return;
    }
    const orderedFixtures = orderFixtures(selectedMovingFixtures, aimOrderMode);
    const arranged = arrangeTargetPoints(target.position, orderedFixtures.length, aimArrangement, aimSpreadMeters);
    const unreachable = orderedFixtures.filter((fixture, selectedIndex) => {
      const patchIndex = patch.findIndex((item) => item.id === fixture.id);
      return !aimFixtureAtTarget(universeRef.current, fixture, arranged[selectedIndex], patchIndex, patch.length, stageSettings.dimensions)?.reachable;
    });
    setSelectedTargetId(target.id);
    const result = await dispatchControl({
      type: 'fixture.target',
      fixtureIds: selectedMovingFixtures.map((fixture) => fixture.id),
      target: target.position,
      arrangement: aimArrangement,
      spreadMeters: aimSpreadMeters,
      orderMode: aimOrderMode
    }, 'ui');
    if (!result.warnings.length) {
      setMessage(`${selectedMovingFixtures.length} mover${selectedMovingFixtures.length === 1 ? '' : 's'} aimed at ${target.name} · ${aimArrangement.replace('-', ' ')}.`);
    } else if (unreachable.length) {
      setMessage(`${target.name}: ${unreachable.map((fixture) => fixture.name).join(', ')} cannot reach the target. Other reachable fixtures were updated.`);
    }
  }

  function capturePositionPalette(kind: 'spatial' | 'absolute', existing?: PositionPalette): PositionPalette | null {
    const id = existing?.id ?? `position-${Date.now().toString(36)}`;
    const name = (positionPaletteName.trim() || existing?.name || (kind === 'spatial' ? selectedTarget?.name : '') || `Position ${(showFile.positionPalettes?.length ?? 0) + 1}`).slice(0, 64);
    if (kind === 'spatial') {
      if (!selectedTarget) {
        setMessage('Select a stage target before capturing a spatial position palette.');
        return null;
      }
      return {
        id,
        name,
        kind,
        targetId: selectedTarget.id,
        targetName: selectedTarget.name,
        fallbackTarget: { ...selectedTarget.position },
        arrangement: aimArrangement,
        orderMode: aimOrderMode,
        spreadMeters: aimSpreadMeters
      };
    }
    if (!selectedMovingFixtures.length) {
      setMessage('Select at least one moving fixture before capturing an absolute position palette.');
      return null;
    }
    return {
      id,
      name,
      kind,
      positions: selectedMovingFixtures.map((fixture) => {
        const fixtureIndex = patch.findIndex((item) => item.id === fixture.id);
        const geometry = fixtureGeometryState(universeRef.current, fixture, fixtureIndex, patch.length, stageSettings.dimensions);
        return {
          fixtureId: fixture.id,
          fixtureName: fixture.name,
          panNormalized: geometry.movement.panNormalized,
          tiltNormalized: geometry.movement.tiltNormalized
        };
      })
    };
  }

  function savePositionPalette() {
    if ((showFile.positionPalettes?.length ?? 0) >= 64) {
      setMessage('The position palette library is full. Delete an unused palette first.');
      return;
    }
    const palette = capturePositionPalette(positionPaletteKind);
    if (!palette) return;
    setShowFile((current) => ({ ...current, positionPalettes: [...(current.positionPalettes ?? []), palette] }));
    setPositionPaletteName('');
    setMessage(`${palette.name} saved as a ${palette.kind} position palette.`);
  }

  async function runPositionPalette(palette: PositionPalette) {
    if (palette.kind === 'spatial') {
      const target = stageTargets.find((candidate) => candidate.id === palette.targetId);
      if (!target) {
        setMessage(`UNRESOLVED POSITION: ${palette.targetName} no longer exists in this stage design.`);
        return;
      }
      const movingFixtures = selectedMovingFixtures;
      if (!movingFixtures.length) {
        setMessage('Select at least one moving fixture before recalling a spatial position palette.');
        return;
      }
      const result = await dispatchControl({
        type: 'fixture.target',
        fixtureIds: movingFixtures.map((fixture) => fixture.id),
        target: target.position,
        arrangement: palette.arrangement,
        spreadMeters: palette.spreadMeters,
        orderMode: palette.orderMode ?? 'forward'
      }, 'ui');
      if (!result.warnings.length) setMessage(`${palette.name} applied to ${movingFixtures.length} selected mover${movingFixtures.length === 1 ? '' : 's'}.`);
      return;
    }
    const patchIds = new Set(patch.map((fixture) => fixture.id));
    const available = palette.positions.filter((position) => patchIds.has(position.fixtureId));
    if (!available.length) {
      setMessage(`UNRESOLVED POSITION: none of the fixtures stored in ${palette.name} are patched.`);
      return;
    }
    const result = await dispatchControl({
      type: 'fixture.position',
      positions: available.map(({ fixtureId, panNormalized, tiltNormalized }) => ({ fixtureId, panNormalized, tiltNormalized }))
    }, 'ui');
    const missing = palette.positions.length - available.length;
    if (!result.warnings.length) setMessage(`${palette.name} restored ${available.length} fixture position${available.length === 1 ? '' : 's'}${missing ? ` · ${missing} unresolved` : ''}.`);
  }

  function updatePositionPalette(palette: PositionPalette) {
    const captured = capturePositionPalette(palette.kind, palette);
    if (!captured) return;
    setShowFile((current) => ({ ...current, positionPalettes: (current.positionPalettes ?? []).map((item) => item.id === palette.id ? captured : item) }));
    setMessage(`${palette.name} updated from the current ${palette.kind === 'spatial' ? 'target' : 'fixture positions'}.`);
  }

  function deletePositionPalette(id: string) {
    setShowFile((current) => ({ ...current, positionPalettes: (current.positionPalettes ?? []).filter((palette) => palette.id !== id) }));
    setMessage('Position palette deleted.');
  }

  function updateFixtureCalibration(fixtureId: string, calibration: PatchedFixture['calibration']) {
    setPatch((current) => current.map((fixture) => fixture.id === fixtureId ? { ...fixture, calibration } : fixture));
    if (stageFixture?.id === fixtureId) setOrganizerDraft((current) => ({ ...current, calibration }));
  }

  function captureCalibrationObservation() {
    if (!stageFixture || !activeStageGeometry?.movementCapable || !selectedTarget) return;
    const observation: CalibrationObservation = {
      id: `calibration-${Date.now().toString(36)}`,
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      target: { ...selectedTarget.position },
      panNormalized: activeStageGeometry.movement.panNormalized,
      tiltNormalized: activeStageGeometry.movement.tiltNormalized,
      capturedAt: new Date().toISOString()
    };
    const observations = [...(stageFixture.calibration?.observations ?? []), observation].slice(-6);
    updateFixtureCalibration(stageFixture.id, {
      ...EMPTY_CALIBRATION,
      ...stageFixture.calibration,
      status: 'partial',
      observations
    });
    setMessage(`${selectedTarget.name} calibration observation captured (${observations.length}/3 recommended).`);
  }

  function solveActiveFixtureCalibration() {
    if (!stageFixture) return;
    const observations = stageFixture.calibration?.observations ?? [];
    const solved = solveFixtureCalibration(stageFixture, observations, patch.indexOf(stageFixture), patch.length, stageSettings.dimensions);
    if (!solved) {
      setMessage('Capture at least one reachable calibration target first. Two or three well-spaced points are recommended.');
      return;
    }
    updateFixtureCalibration(stageFixture.id, solved);
    setMessage(`${stageFixture.name} calibrated from ${observations.length} point${observations.length === 1 ? '' : 's'} · ${Math.round((solved.confidence ?? 0) * 100)}% confidence.`);
  }

  function resetActiveFixtureCalibration() {
    if (!stageFixture) return;
    updateFixtureCalibration(stageFixture.id, { ...EMPTY_CALIBRATION });
    setMessage(`${stageFixture.name} calibration reset.`);
  }

  function copyActiveCalibrationToSelection() {
    if (!stageFixture?.calibration || selectedMovingFixtures.length < 2) {
      setMessage('Select two or more moving fixtures before copying calibration.');
      return;
    }
    if (!window.confirm('Copy this fixture-specific calibration to every selected mover? Only do this for identical fixtures with matching mounts and orientation.')) return;
    const selectedIds = new Set(selectedMovingFixtures.map((fixture) => fixture.id));
    const copiedCalibration = {
      ...stageFixture.calibration,
      observations: stageFixture.calibration.observations?.map((observation) => ({
        ...observation,
        target: { ...observation.target }
      }))
    };
    setPatch((current) => current.map((fixture) => selectedIds.has(fixture.id)
      ? { ...fixture, calibration: { ...copiedCalibration } }
      : fixture));
    setOrganizerDraft((current) => selectedIds.has(current.id) ? { ...current, calibration: { ...copiedCalibration } } : current);
    setMessage(`${stageFixture.name} calibration copied to ${selectedMovingFixtures.length} selected movers.`);
  }

  function homeActiveFixture() {
    if (!stageFixture) return;
    void setChannels(fixtureMovementUpdates(stageFixture, .5, .5), true, 'ui');
    setMessage(`${stageFixture.name} sent to profile home.`);
  }

  function removeFixture(fixture: PatchedFixture) {
    if (patch.length === 1) return setMessage('Keep at least one fixture in the patch.');
    const mode = findMode(fixture);
    const updates = Array.from({ length: mode?.channelCount ?? 0 }, (_, index) => [fixture.address + index, 0] as const);
    void setChannels(updates);
    setPatch((current) => current.filter((item) => item.id !== fixture.id));
  }

  function deleteSelectedFixtures() {
    const selected = patch.filter((fixture) => fixture.selected);
    if (!selected.length) return setMessage('Select one or more fixtures first.');
    if (selected.length >= patch.length) return setMessage('Keep at least one fixture in the patch.');
    const updates = selected.flatMap((fixture) => {
      const mode = findMode(fixture);
      return Array.from({ length: mode?.channelCount ?? 0 }, (_, index) => [fixture.address + index, 0] as const);
    });
    void setChannels(updates);
    const selectedIds = new Set(selected.map((fixture) => fixture.id));
    setPatch((current) => current.filter((fixture) => !selectedIds.has(fixture.id)));
    if (stageFixtureId && selectedIds.has(stageFixtureId)) setStageFixtureId('');
    setMessage(`${selected.length} fixture${selected.length === 1 ? '' : 's'} deleted from the patch.`);
  }

  async function connectMidi() {
    connectionManagerRef.current!.upsert({
      id:'midi',kind:'midi',name:'MIDI / DAW',status:'connecting',
      capabilities:['clock','transport','controls'],detail:'Opening selected MIDI input'
    });
    refreshConnectionRecords();
    try {
      await invoke('connect_midi', { inputId: Number(selectedMidiInput) });
      const status=await invoke<MidiStatus>('midi_status');
      setMidiStatus(status);
      connectionManagerRef.current!.upsert({
        id:'midi',kind:'midi',name:status.input_name || 'MIDI / DAW',status:'connected',
        capabilities:['clock','transport','controls'],lastSeenAt:Date.now(),detail:status.last_event || 'Waiting for MIDI'
      });
      refreshConnectionRecords();
      setMessage('MIDI connected. Notes, CC, clock, and transport are being monitored.');
    } catch (error) {
      connectionManagerRef.current!.fail('midi',String(error));
      refreshConnectionRecords();
      setMessage(`MIDI connection failed: ${String(error)}`);
    }
  }

  async function disconnectMidi() {
    try {
      await invoke('disconnect_midi');
      const status=await invoke<MidiStatus>('midi_status');
      setMidiStatus(status);
      connectionManagerRef.current!.disconnect('midi','Disconnected by operator');
      refreshConnectionRecords();
      releaseSharedTransport('midi');
      setMessage('MIDI disconnected.');
    } catch (error) {
      connectionManagerRef.current!.fail('midi',String(error));
      refreshConnectionRecords();
      setMessage(`MIDI disconnect failed: ${String(error)}`);
    }
  }

  async function refreshPairedControllerList() {
    setPairedControllersError('');
    try {
      setPairedControllers(await listPairedControllers(remoteRelayConfig));
    } catch (error) {
      setPairedControllersError(error instanceof Error ? error.message : String(error));
    }
  }

  async function startControllerPairing() {
    if (remoteRelayStatus !== 'connected') {
      setRemoteRelayError('Connect Secure Cloud Relay before pairing a controller.');
      return;
    }
    setPairingBusy(true);
    setRemoteRelayError('');
    try {
      const session = await createControllerPairing(remoteRelayConfig, REMOTE_APP_URL);
      setPairingSession(session);
      setPairingNow(Date.now());
      setMessage('Controller pairing opened for two minutes. Scan the QR or enter the six-digit code on the iPad controller.');
    } catch (error) {
      setRemoteRelayError(error instanceof Error ? error.message : String(error));
    } finally {
      setPairingBusy(false);
    }
  }

  async function revokeControllerPairing(deviceId: string) {
    try {
      await revokePairedController(remoteRelayConfig, deviceId);
      await refreshPairedControllerList();
      setMessage('Controller access revoked. Its next relay authorization will be denied.');
    } catch (error) {
      setPairedControllersError(error instanceof Error ? error.message : String(error));
    }
  }

  async function connectRemoteRelay() {
    setRemoteRelayError('');
    try {
      await remoteRelayRef.current!.connect(
        remoteRelayConfig,
        (envelope) => remoteCommandHandlerRef.current?.(envelope),
        (status, detail) => {
          setRemoteRelayStatus(status);
          if (detail) setRemoteRelayError(detail);
        },
        () => remoteSnapshotHandlerRef.current?.()
      );
      setMessage('Remote relay connected. Cloud Shows and paired controllers are available.');
      void refreshCloudLibrary();
      void refreshPairedControllerList();
    } catch (error) {
      setRemoteRelayStatus('error');
      setRemoteRelayError(String(error));
      setMessage(`Remote relay failed: ${String(error)}`);
    }
  }

  async function disconnectRemoteRelay() {
    clearAllRemoteEffectLeases();
    clearAllRemoteFlashLeases(true);
    await remoteRelayRef.current?.disconnect();
    setRemoteRelayStatus('disconnected');
    setPairingSession(null);
    setCloudStatus('offline');
    setMessage('Remote relay disconnected. Local lighting output and local Show saves continue unchanged.');
  }

  function beginMidiAssignment(target = newMidiTarget) {
    const control = midiControls.find((item) => item.id === target);
    if (!control) return;
    const existing = midiMappings.find((mapping) => mapping.target === target);
    if (existing) {
      setMidiLearnMappingId(existing.id);
      setMessage(`Move or press the MIDI control for ${control.label}.`);
      return;
    }
    const mapping: MidiMapping = {
      id: `midi-${Date.now().toString(36)}`,
      target,
      kind: null,
      channel: null,
      number: null
    };
    setMidiMappings((current) => [...current, mapping]);
    setMidiLearnMappingId(mapping.id);
    setMessage(`Move or press the MIDI control for ${control.label}.`);
  }

  function removeMidiAssignment(id: string) {
    setMidiMappings((current) => current.filter((mapping) => mapping.id !== id));
    if (midiLearnMappingId === id) setMidiLearnMappingId(null);
    delete midiButtonGateRef.current[id];
    setMessage('MIDI assignment removed.');
  }

  function changeMidiAssignmentTarget(id: string, target: string) {
    setMidiMappings((current) => current.map((mapping) => mapping.id === id ? { ...mapping, target } : mapping));
    setMessage('MIDI assignment target updated.');
  }

  function momentaryEffectForControl(control?: MidiAssignableControl) {
    if (!control?.id.startsWith('effect:')) return null;
    const effect = control.id.slice('effect:'.length) as EffectId;
    return EFFECT_PRESETS.find((item) => item.id === effect && item.momentary)?.id ?? null;
  }

  function executeMidiControl(control: MidiAssignableControl, value: number) {
    if (control.type === 'button') {
      if (control.id === 'go') goNextCue();
      else if (control.id === 'previous') goPreviousCue();
      else if (control.id === 'blackout') void toggleBlackout();
      else if (control.id === 'tap-tempo') tapTempo();
      else if (control.id === 'stop-effect') stopEffect();
      else if (control.id.startsWith('recipe:')) {
        const recipe=FX_RECIPES.find(item=>'recipe:'+item.id===control.id);
        if(recipe)runCustomFx({...structuredClone(recipe.effect),id:control.id},selectedFixtureTargets.map(f=>f.id));
      }
      else if (control.id.startsWith('effect:')) {
        const effect = control.id.slice('effect:'.length) as EffectId;
        const preset = EFFECT_PRESETS.find((item) => item.id === effect);
        if (preset?.momentary) startMomentaryEffect(effect);
        else if (preset) startEffect(effect);
      } else if (control.id.startsWith('color:')) {
        const preset = COLOR_PRESETS.find((item) => item.name.toLowerCase() === control.id.slice('color:'.length));
        if (preset) applyGlobalColor(rgbToHex(preset.rgb[0], preset.rgb[1], preset.rgb[2]), 'midi');
      } else if (control.id.startsWith('fixture-select:')) {
        const fixtureId = control.id.slice('fixture-select:'.length);
        toggleFixtureSelection(fixtureId, 'midi');
      }
      return;
    }

    const scaled = midiValueToRange(value, control.min ?? 0, control.max ?? 127);
    if (control.id === 'master') applyGlobalMaster(scaled, 'midi');
    else if (control.id === 'tempo') {
      const bpm = Math.round(scaled);
      setMasterTempo(bpm);
      setMessage(`MIDI set effect tempo to ${bpm} BPM.`);
    } else if (control.id === 'effect-depth') {
      setEffectDepth(Math.round(scaled));
      effectDepthRef.current = Math.round(scaled);
    } else if (control.id.startsWith('global-')) {
      const rgb = hexToRgb(globalColor);
      const index = control.id === 'global-red' ? 0 : control.id === 'global-green' ? 1 : 2;
      rgb[index] = Math.round(scaled);
      applyGlobalColor(rgbToHex(rgb[0], rgb[1], rgb[2]), 'midi');
    } else if (control.id.startsWith('fixture:')) {
      const [, fixtureId, parameter] = control.id.split(':');
      const fixture = patchRef.current.find((item) => item.id === fixtureId);
      if (!fixture) return;
      void setFixtureAttribute(fixture, parameter as FixtureParameter, Math.round(scaled), 'midi');
    }
  }

  const midiActionRef = useRef<(event: MidiEvent) => void>(() => undefined);
  midiActionRef.current = (event) => {
    if (event.kind === 'clock') {
      setMidiClockSeen(true);
      const now = performance.now();
      const times = [...midiClockTimesRef.current, now].slice(-25);
      midiClockTimesRef.current = times;
      if (times.length >= 13) {
        const gaps = times.slice(1).map((time, index) => time - times[index]);
        const averageTick = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        const bpm = Math.round(60000 / (averageTick * 24));
        if (bpm >= 20 && bpm <= 300) {
          setMidiBpm(bpm);
          midiBpmRef.current = bpm;
        }
      }
      if (externalTrack.armed && externalTransportRunningRef.current) {
        const transportBpm = midiBpmRef.current ?? externalTrack.bpm;
        const result=transportEngineRef.current!.advance('midi',60000/Math.max(20,transportBpm)/24,transportBpm,now);
        if(result.accepted){
          externalSongPositionMsRef.current=result.state.positionMs;
          externalClockUiTicksRef.current += 1;
          if (externalClockUiTicksRef.current % 6 === 0) {
            setExternalSongPositionMs(result.state.positionMs);
            setSharedTransport(result.state);
          }
        }
      }
      return;
    }
    if (event.kind === 'song_position' && externalTrack.armed) {
      const positionMs = midiSongPositionToMs(event.song_position ?? 0, midiBpmRef.current ?? externalTrack.bpm);
      const result=applySharedTransport({
        source:'midi',
        positionMs,
        bpm:midiBpmRef.current ?? externalTrack.bpm,
        claim:externalTransportRunningRef.current
      });
      if(!result.accepted)return;
      const lightingPositionMs = applyLightingOffset(result.state.positionMs, externalTrack.lightingOffsetMs);
      setShowTrackPositionMs(lightingPositionMs);
      if (result.state.playing && externalTrackRecording) {
        playShowRecording(externalTrackRecording, { external: true, positionMs: lightingPositionMs });
      }
      setMessage(`External song position: ${formatShowTime(result.state.positionMs)}.`);
      return;
    }
    if ((event.kind === 'start' || event.kind === 'continue') && externalTrack.armed) {
      const dawPositionMs = event.kind === 'start' ? 0 : externalSongPositionMsRef.current;
      if (event.kind === 'start') {
        midiClockTimesRef.current = [];
        midiBpmRef.current = null;
        setMidiBpm(null);
      }
      const result=applySharedTransport({
        source:'midi',
        playing:true,
        positionMs:dawPositionMs,
        bpm:midiBpmRef.current ?? externalTrack.bpm,
        claim:true
      });
      if(!result.accepted){
        setMessage(`MIDI transport ignored while ${result.state.source} owns transport.`);
        return;
      }
      externalClockUiTicksRef.current = 0;
      const startAt = applyLightingOffset(result.state.positionMs, externalTrack.lightingOffsetMs);
      if (externalTrackRecording) playShowRecording(externalTrackRecording, { external: true, positionMs: startAt });
      else setMessage('External transport started, but no recorded lighting take is assigned.');
      return;
    }
    if (event.kind === 'stop' && externalTrack.armed) {
      const result=releaseSharedTransport('midi');
      if(!result.accepted)return;
      if (recordingPlaybackExternalRef.current) stopRecordedShowPlayback(false);
      setMessage(`${externalTrack.songName || 'External song'} stopped at ${formatShowTime(result.state.positionMs)}.`);
      return;
    }
    if (event.kind === 'note_off' && event.number != null && event.channel != null) {
      midiMappingsRef.current
        .filter((mapping) => mapping.kind === 'note' && mapping.channel === event.channel && mapping.number === event.number)
        .forEach((mapping) => {
          const control = midiControls.find((item) => item.id === mapping.target);
          const effect = momentaryEffectForControl(control);
          if (effect) releaseMomentaryEffect(effect);
        });
      return;
    }
    const sourceKind: MidiSourceKind | null = event.kind === 'note_on' ? 'note' : event.kind === 'control_change' ? 'cc' : null;
    if (!sourceKind || event.number == null || event.channel == null) return;
    const learningId = midiLearnMappingIdRef.current;
    if (learningId) {
      const learnedControl = midiMappingsRef.current.find((mapping) => mapping.id === learningId);
      setMidiMappings((current) => current.map((mapping) => mapping.id === learningId ? { ...mapping, kind: sourceKind, channel: event.channel!, number: event.number! } : mapping));
      setMidiLearnMappingId(null);
      const label = midiControls.find((control) => control.id === learnedControl?.target)?.label ?? 'Control';
      setMessage(`${label} learned ${sourceKind === 'cc' ? 'CC' : 'Note'} ${event.number} on channel ${event.channel}.`);
      return;
    }
    const matches = midiMappingsRef.current.filter((mapping) => mapping.kind === sourceKind && mapping.channel === event.channel && mapping.number === event.number);
    matches.forEach((mapping) => {
      const control = midiControls.find((item) => item.id === mapping.target);
      if (!control) return;
      const value = event.value ?? 127;
      if (control.type === 'slider') {
        executeMidiControl(control, value);
        return;
      }
      if (sourceKind === 'note') {
        executeMidiControl(control, value);
        return;
      }
      const pressed = value >= 64;
      const wasPressed = midiButtonGateRef.current[mapping.id] ?? false;
      midiButtonGateRef.current[mapping.id] = pressed;
      if (pressed && !wasPressed) executeMidiControl(control, value);
      if (!pressed && wasPressed) {
        const effect = momentaryEffectForControl(control);
        if (effect) releaseMomentaryEffect(effect);
      }
    });
  };

  useEffect(() => {
    if (!midiStatus.connected) {
      connectionManagerRef.current!.disconnect('midi');
      refreshConnectionRecords();
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const events = await invoke<MidiEvent[]>('drain_midi_events');
        events.forEach((event) => midiActionRef.current(event));
        const status=await invoke<MidiStatus>('midi_status');
        setMidiStatus(status);
        if(status.connected){
          connectionManagerRef.current!.upsert({
            id:'midi',kind:'midi',name:status.input_name || 'MIDI / DAW',status:'connected',
            capabilities:['clock','transport','controls'],
            lastSeenAt:status.messages_received>0?Date.now():connectionManagerRef.current!.get('midi')?.lastSeenAt ?? null,
            lastError:status.last_error ?? '',
            detail:status.last_event || (midiClockSeen?'Clock received':'Waiting for MIDI')
          });
        }else{
          connectionManagerRef.current!.disconnect('midi','Native MIDI input closed');
        }
        refreshConnectionRecords();
      } catch (error) {
        connectionManagerRef.current!.fail('midi',String(error),true);
        refreshConnectionRecords();
      }
    }, MIDI_POLL_MS);
    return () => window.clearInterval(interval);
  }, [midiStatus.connected, midiClockSeen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key === 'Escape') {
        setCalibrationOpen(false);
        return;
      }
      if(!typing && (event.ctrlKey || event.metaKey)) {
        const key=event.key.toLowerCase();
        // Timeline owns its clip clipboard and history while it is mounted.
        const timelineEditing=workspace==='show' && (showMode==='timeline' || (showMode==='cues' && cueTimelineSong!==null));
        if(!timelineEditing && (key==='z' || key==='y')){event.preventDefault();editHistory(key==='y'||event.shiftKey?'redo':'undo');return;}
        if(workspace==='show' && showMode==='creator' && ['a','c','v'].includes(key))return;
        const fixtureEditing=(workspace==='build' && setupView==='fixtures') || (workspace==='create' && programMode==='stage');
        if(!timelineEditing && key==='a'){event.preventDefault();allEditingSelected.current=true;if(fixtureEditing)selectAllFixtures();else setMessage('All '+(workspace==='build'||workspace==='visualizer'?stageElements.length:workspace==='create'?customEffects.length:showFile.cues.length)+' editing items selected.');return;}
        if(!timelineEditing && key==='c'){
          if(fixtureEditing){event.preventDefault();editClipboard.current=structuredClone(patch.filter(f=>f.selected));return;}
          if(workspace==='create' && programMode==='looks'){event.preventDefault();editClipboard.current=structuredClone(allEditingSelected.current?[...allLooks]:lastEditingLook.current?[lastEditingLook.current]:[]);return;}
          const item=workspace==='create' && programMode==='fx' ? fxEditor : workspace==='build' || workspace==='visualizer' ? selectedStageElement : activeCue;
          if(item || allEditingSelected.current){event.preventDefault();editClipboard.current=structuredClone(allEditingSelected.current?(workspace==='create' && programMode==='fx'?customEffects:workspace==='build'||workspace==='visualizer'?stageElements:showFile.cues):item?[item]:[]);}return;
        }
        if(!timelineEditing && key==='v' && editClipboard.current.length){event.preventDefault();
          const copied=editClipboard.current;
          if(copied.every(item=>'profileId' in item)){try{setPatch(pasteFixtures(patch,copied));}catch(error){setMessage(String(error));}return;}
          if(showFile.cues.length+copied.filter(item=>'number' in item).length>200 || customEffects.length+copied.filter(item=>'parameter' in item).length>32){setMessage('Paste exceeds the editor item limit. Existing items are preserved.');return;}
          for(const item of editClipboard.current){
          if('parameter' in item){const copy={...structuredClone(item),id:crypto.randomUUID(),name:item.name+' copy'};setFxEditor(copy);setCustomEffects(all=>[...all,copy]);continue;}
          if('profileId' in item)continue;
          if('values' in item && !('number' in item)){setSavedLooks(all=>[...all,{...structuredClone(item),id:crypto.randomUUID(),name:item.name+' copy'}]);continue;}
          if('label' in item){const copy={...structuredClone(item),id:crypto.randomUUID(),label:item.label+' copy'};setStageElements(all=>[...all,copy]);setSelectedStageElementId(copy.id);}
          else if(showFile.cues.length<200){const copy={...structuredClone(item),id:crypto.randomUUID(),name:item.name+' copy',sourceSectionId:undefined};setShowFile(all=>({...all,cues:renumberCues([...all.cues,copy])}));setActiveCueId(copy.id);}
          }return;
        }
      }
      const performanceContext = workspace === 'live' || (workspace === 'show' && showMode === 'cues');
      if (!typing && performanceContext && (event.code === 'Space' || event.key === 'ArrowRight')) {
        event.preventDefault();
        goNextCue();
      } else if (!typing && performanceContext && event.key === 'ArrowLeft') {
        event.preventDefault();
        goPreviousCue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspace, showMode, nextCue?.id, cueTimelineSong, activeCue, selectedStageElement, showFile, editHistory, programMode, fxEditor,stageElements,customEffects,setupView,patch,savedLooks]);

  async function startAudioInput() {
    setAudioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      audioStreamRef.current = stream;
      audioContextRef.current = context;
      audioBaseUniverseRef.current = [...universeRef.current];
      setAudioEnabled(true);
      let lastOutput = 0;
      const tick = (now: number) => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
        const rms = Math.sqrt(sum / samples.length);
        const sensitivity = settingsRef.current.audioSensitivity / 100;
        const level = Math.max(0, Math.min(1, rms * (3 + sensitivity * 14)));
        setAudioLevel(level);
        if (audioArmedRef.current && now - lastOutput >= FRAME_MS) {
          lastOutput = now;
          const updates = selectedFixtures(patchRef.current)
            .map((fixture) => fixtureParameterUpdate(fixture, 'dimmer', level * percentToDmx(settingsRef.current.masterLimit)))
            .filter((update): update is DmxUpdate => Boolean(update));
          void commitUniverse(applyUniverseUpdates(audioBaseUniverseRef.current, updates), 'audio');
        }
        audioAnimationRef.current = requestAnimationFrame(tick);
      };
      audioAnimationRef.current = requestAnimationFrame(tick);
      setMessage('Audio input enabled. Preview the meter before arming selected lights.');
    } catch (error) { setAudioError(`Audio input unavailable: ${String(error)}`); }
  }

  function stopAudioInput() {
    setAudioArmed(false);
    audioArmedRef.current = false;
    if (audioAnimationRef.current !== null) cancelAnimationFrame(audioAnimationRef.current);
    audioAnimationRef.current = null;
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setAudioEnabled(false);
    setAudioLevel(0);
  }

  function selectFixtureFromConsole(fixtureId: string, additive = false) {
    const fixture = patch.find((item) => item.id === fixtureId);
    if (fixture) {
      setStageFixtureId(fixture.id);
      setOrganizerDraft(fixture);
      setSelectedStageElementId(null);
    }
    void dispatchControl({ type: 'fixture.select', fixtureIds: [fixtureId], mode: additive ? 'toggle' : 'replace' });
  }

  function selectAllFixtures() {
    void dispatchControl({ type: 'fixture.select', fixtureIds: patch.map((fixture) => fixture.id), mode: 'replace' });
  }

  function clearFixtureSelection() {
    void dispatchControl({ type: 'fixture.select', fixtureIds: [], mode: 'replace' });
  }

  function selectFixtureGroup(groupId: string) {
    const group = fixtureGroups.find((item) => item.id === groupId);
    if (!group) return;
    setSelectedGroupId(group.id);
    const members = fixturesInGroup(patch, group);
    if (members[0]) {
      setStageFixtureId(members[0].id);
      setOrganizerDraft(members[0]);
    }
    void dispatchControl({ type: 'fixture.select', fixtureIds: members.map((fixture) => fixture.id), mode: 'replace' });
  }

  function applyGroupMaster(group: FixtureGroup, percent: number) {
    const value = Math.max(0, Math.min(100, percent));
    setGroupMasters((current) => ({ ...current, [group.id]: value }));
    void dispatchControl({ type: 'group.master.set', groupName: group.name, value: value / 100 });
    setMessage(`${group.name} master at ${Math.round(value)}%. Individual fixture values are preserved.`);
  }

  function applyGroupColor(group: FixtureGroup, color: string) {
    const [red, green, blue] = hexToRgb(color);
    setGlobalColor(color);
    void dispatchControl({ type: 'group.color', groupName: group.name, color: { red, green, blue } });
    setMessage(`${color.toUpperCase()} applied to compatible fixtures in ${group.name}.`);
  }

  function createFixtureGroup() {
    let index = fixtureGroups.length + 1;
    let name = `Group ${index}`;
    while (fixtureGroups.some((group) => group.name === name)) {
      index += 1;
      name = `Group ${index}`;
    }
    const group = makeFixtureGroup(name, fixtureGroups.length);
    setShowFile((current) => ({ ...current, groups: [...fixtureGroups, group] }));
    setSelectedGroupId(group.id);
    setMessage(`${group.name} created.`);
  }

  function updateFixtureGroup(groupId: string, updates: Partial<FixtureGroup>) {
    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName || fixtureGroups.some((group) => group.id !== groupId && group.name.toLowerCase() === cleanName.toLowerCase())) {
        setMessage(cleanName ? 'A group with that name already exists.' : 'Group name cannot be empty.');
        return;
      }
      const renamed = renameFixtureGroup(fixtureGroups, patch, groupId, updates.name);
      setPatch(renamed.patch);
      setShowFile((current) => ({ ...current, groups: renamed.groups }));
      return;
    }
    setShowFile((current) => ({
      ...current,
      groups: fixtureGroups.map((group) => group.id === groupId ? { ...group, ...updates } : group)
    }));
  }

  function updateGroupGridColumns(group: FixtureGroup, columns: number) {
    const safeColumns = Math.max(1, Math.min(12, Math.round(columns)));
    const currentGrid = normalizeSelectionGrid(group.selectionGrid ?? makeSelectionGrid(group.fixtureOrder), group.fixtureOrder);
    const selectionGrid = normalizeSelectionGrid({
      ...currentGrid,
      columns: safeColumns,
      rows: Math.max(1, Math.ceil(Math.max(1, group.fixtureOrder.length) / safeColumns))
    }, group.fixtureOrder);
    updateFixtureGroup(group.id, { selectionGrid });
  }

  function updateGroupGridTraversal(group: FixtureGroup, traversal: SelectionGridTraversal) {
    const currentGrid = normalizeSelectionGrid(group.selectionGrid ?? makeSelectionGrid(group.fixtureOrder), group.fixtureOrder);
    updateFixtureGroup(group.id, { selectionGrid: { ...currentGrid, traversal } });
  }

  function handleGroupGridCell(group: FixtureGroup, row: number, column: number) {
    const grid = normalizeSelectionGrid(group.selectionGrid ?? makeSelectionGrid(group.fixtureOrder), group.fixtureOrder);
    const occupant = grid.cells.find((cell) => cell.row === row && cell.column === column);
    if (!groupGridFixtureId) {
      if (occupant) setGroupGridFixtureId(occupant.fixtureId);
      return;
    }
    const selectionGrid = moveFixtureInSelectionGrid(grid, group.fixtureOrder, groupGridFixtureId, row, column);
    updateFixtureGroup(group.id, { selectionGrid });
    setGroupGridFixtureId(null);
  }

  function deleteFixtureGroup(groupId: string) {
    const group = fixtureGroups.find((item) => item.id === groupId);
    if (!group || !window.confirm(`Delete the ${group.name} group? Fixtures will remain patched and become unassigned.`)) return;
    const result = removeFixtureGroup(fixtureGroups, patch, groupId);
    setPatch(result.patch);
    setShowFile((current) => ({ ...current, groups: result.groups }));
    setSelectedGroupId(result.groups[0]?.id ?? null);
    setMessage(`${group.name} removed. Its fixtures are still patched.`);
  }

  function assignCheckedFixtures(targetGroup: FixtureGroup | null = selectedGroup) {
    if (!targetGroup || assignmentIds.length === 0) return;
    setPatch((current) => assignFixturesToGroup(current, assignmentIds, targetGroup.name));
    setAssignmentIds([]);
    setMessage(`${assignmentIds.length} fixture${assignmentIds.length === 1 ? '' : 's'} assigned to ${targetGroup.name}.`);
  }

  function unassignFixture(fixtureId: string) {
    setPatch((current) => assignFixturesToGroup(current, [fixtureId], ''));
  }

  function routeTimelineVideo(screenId:string) {
    setStageElements(current=>current.map(element=>{
      if(element.id===screenId){
        const previous=element.mediaSource?.kind!=='none' ? element.mediaSource : undefined;
        return {...element,mediaSource:{
          kind:'timeline',
          sourceName:'Timeline video',
          fit:previous?.fit ?? 'contain',
          scale:previous?.scale ?? 1,
          offsetX:previous?.offsetX ?? 0,
          offsetY:previous?.offsetY ?? 0
        }};
      }
      return element.mediaSource?.kind==='timeline'?{...element,mediaSource:{kind:'none'}}:element;
    }));
    setMessage(screenId?'Timeline video routed to the selected display.':'Timeline display routing cleared.');
  }
  async function importScreenVideo(screenId:string,file:File) {
    if(!/\.mp4$/i.test(file.name)){setMessage('Choose an MP4 video file.');return;}
    await loadShowAudioFile(file);routeTimelineVideo(screenId);
  }
  async function refreshScreenImageAssets() {
    const library = await readMediaLibrary();
    setScreenImageAssets(library.assets.filter((asset) => asset.kind === 'image' && !asset.missing));
  }

  async function importScreenImage(screenId:string,file:File) {
    if(!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)) {
      throw Error('Choose a still image file.');
    }
    const mediaId=crypto.randomUUID();
    const asset=await persistManagedMedia(mediaId,file,file.name,null,'image');
    if(!asset) throw Error('Still-image screen assets require the installed LumaRig desktop app.');
    setScreenImageAssets(current=>[asset,...current.filter(item=>item.id!==asset.id)]);
    setStageElements(current=>current.map(element=>{
      if(element.id!==screenId || element.type!=='led-screen')return element;
      const previous=element.mediaSource?.kind!=='none' ? element.mediaSource : undefined;
      return {...element,mediaSource:{
        kind:'image',
        mediaId:asset.id,
        sourceName:asset.name,
        fit:previous?.fit ?? 'contain',
        scale:previous?.scale ?? 1,
        offsetX:previous?.offsetX ?? 0,
        offsetY:previous?.offsetY ?? 0
      }};
    }));
    setMessage(`${asset.name} added to the shared Media Library and routed to this screen.`);
  }

  function setScreenSourceKind(screenId:string,kind:'none'|'timeline'|'ndi'|'image'|'color'|'test-pattern') {
    setStageElements(current=>current.map(element=>{
      if(element.id!==screenId || element.type!=='led-screen')return element;
      const previous=element.mediaSource?.kind!=='none' ? element.mediaSource : undefined;
      const framing={
        fit:previous?.fit ?? 'contain',
        scale:previous?.scale ?? 1,
        offsetX:previous?.offsetX ?? 0,
        offsetY:previous?.offsetY ?? 0
      };
      if(kind==='timeline')return {...element,mediaSource:{kind:'timeline',sourceName:'Timeline video',...framing}};
      if(kind==='ndi')return {...element,mediaSource:{kind:'ndi',sourceName:'ProPresenter',...framing}};
      if(kind==='image'){
        const asset=screenImageAssets[0];
        return {...element,mediaSource:{kind:'image',mediaId:asset?.id ?? '',sourceName:asset?.name ?? 'Still image',...framing}};
      }
      if(kind==='color')return {...element,mediaSource:{kind:'color',color:element.color || '#000000'}};
      if(kind==='test-pattern')return {...element,mediaSource:{kind:'test-pattern',pattern:'bars'}};
      return {...element,mediaSource:{kind:'none'}};
    }));
  }
  function loadStagePreset(presetId: StagePresetId) {
    const preset = instantiateStagePreset(presetId);
    // Replacement is reversible through the editing history; native confirm may not be available.
    setStageFixtureId('');
    setStageElements(preset.elements);
    setStageSettings({ schemaVersion: 2, unit: 'feet', dimensions: preset.dimensions });
    setSelectedStageElementId(preset.elements.find((element) => element.type === 'led-screen')?.id ?? preset.elements[0]?.id ?? null);
    setActiveStagePresetId(presetId);
    setStageMode('select');
    setMessage(`${preset.name} loaded as a separate stage scene.`);
  }

  async function scanStageVideoInputs() {
    setStageVideoInputError('');
    setStageVideoInputPermissionBlocked(false);
    try {
      const result = await requestStageVideoInputs();
      setStageVideoInputs(result.inputs);
      const limited = result.permission === 'limited';
      setStageVideoInputPermissionBlocked(limited);
      setStageVideoInputError(result.warning ?? '');
      if (result.inputs.length) {
        setMessage(limited
          ? `${result.inputs.length} video input${result.inputs.length === 1 ? '' : 's'} found, but LumaRig still needs camera permission for names/live preview.`
          : `${result.inputs.length} video input${result.inputs.length === 1 ? '' : 's'} available for visualizer screens.`);
      } else {
        setMessage('No video inputs were found. Start NDI Webcam Input / Virtual Input, then scan again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStageVideoInputPermissionBlocked(error instanceof StageVideoInputError && error.code === 'permission-denied');
      setStageVideoInputError(message);
      setMessage(`Video input scan failed: ${message}`);
    }
  }

  async function openVideoInputPrivacySettings() {
    if (!('__TAURI_INTERNALS__' in window)) {
      setMessage('Open your system camera/privacy settings and allow LumaRig to access video inputs.');
      return;
    }
    try {
      await invoke('open_video_input_privacy_settings');
      setMessage('Camera privacy settings opened. Allow LumaRig, quit and reopen the app, then scan again.');
    } catch (error) {
      setMessage(`Could not open camera privacy settings: ${String(error)}`);
    }
  }

  function routeVideoInputToAllScreens(deviceId: string) {
    const input = stageVideoInputs.find((item) => item.deviceId === deviceId);
    if (!input) return;
    setStageElements((current) => current.map((element) => {
      if(element.type!=='led-screen')return element;
      const previous=element.mediaSource?.kind!=='none' ? element.mediaSource : undefined;
      return { ...element, mediaSource: {
        kind: 'ndi',
        deviceId: input.deviceId,
        sourceName: input.label || 'ProPresenter',
        fit: previous?.fit ?? 'contain',
        scale: previous?.scale ?? 1,
        offsetX: previous?.offsetX ?? 0,
        offsetY: previous?.offsetY ?? 0
      } };
    }));
    setMessage(`${input.label || 'Video input'} routed to every visualizer screen.`);
  }

  function addWarehouseStageElement(itemId: string) {
    const count = stageElements.filter((element) => element.id.includes(`warehouse-${itemId}-`)).length;
    const element = makeStageWarehouseElement(itemId, count, stageSettings.dimensions);
    setStageElements((current) => [...current, element]);
    setSelectedStageElementId(element.id);
    setActiveStagePresetId(null);
    setMessage(`${element.label} added from the warehouse.`);
  }

  function updateStageElement(id: string, updates: Partial<StageElement>) {
    if (Object.keys(updates).some((key) => key !== 'mediaSource')) setActiveStagePresetId(null);
    setStageElements((current) => current.map((element) => element.id === id
      ? migrateStageElement(clampStageElement({ ...element, ...updates }), stageSettings.dimensions)
      : element));
  }

  function updateScreenFraming(id:string, changes:Partial<{fit:'contain'|'cover';scale:number;offsetX:number;offsetY:number}>) {
    setStageElements(current=>current.map(element=>{
      if(element.id!==id || element.type!=='led-screen' || !element.mediaSource || element.mediaSource.kind==='none')return element;
      return {...element,mediaSource:{...element.mediaSource,...changes}};
    }));
  }

  function updateStageElementPosition(id: string, axis: 'x' | 'y' | 'z', value: number) {
    setActiveStagePresetId(null);
    setStageElements((current) => current.map((element) => {
      if (element.id !== id) return element;
      const migrated = migrateStageElement(element, stageSettings.dimensions);
      return { ...migrated, transform: { ...migrated.transform!, position: { ...migrated.transform!.position, [axis]: value } } };
    }));
  }

  function updateStageElementRotation(id: string, axis: 'yaw' | 'pitch' | 'roll', value: number) {
    setActiveStagePresetId(null);
    setStageElements((current) => current.map((element) => {
      if (element.id !== id) return element;
      const migrated = migrateStageElement(element, stageSettings.dimensions);
      return { ...migrated, transform: { ...migrated.transform!, rotation: { ...migrated.transform!.rotation, [axis]: value } } };
    }));
  }

  function updateStageElementDimension(id: string, axis: 'x' | 'y' | 'z', value: number) {
    setActiveStagePresetId(null);
    const safeValue = Math.max(.03, Math.min(100, Number.isFinite(value) ? value : .03));
    setStageElements((current) => current.map((element) => {
      if (element.id !== id) return element;
      const migrated = migrateStageElement(element, stageSettings.dimensions);
      return { ...migrated, dimensions: { ...migrated.dimensions!, [axis]: safeValue } };
    }));
  }

  function duplicateStageElement(id: string) {
    const source = stageElements.find((element) => element.id === id);
    if (!source) return;
    const migrated = migrateStageElement(source, stageSettings.dimensions);
    const copy: StageElement = {
      ...migrated,
      id: `${source.id}-copy-${Date.now().toString(36)}`,
      label: `${source.label} Copy`,
      transform: migrated.transform ? {
        position: {
          x: migrated.transform.position.x + .45,
          y: migrated.transform.position.y,
          z: migrated.transform.position.z + .45
        },
        rotation: { ...migrated.transform.rotation }
      } : undefined,
      dimensions: migrated.dimensions ? { ...migrated.dimensions } : undefined,
      mediaSource: migrated.mediaSource ? { ...migrated.mediaSource } : undefined
    };
    setStageElements((current) => [...current, copy]);
    setSelectedStageElementId(copy.id);
    setActiveStagePresetId(null);
    setMessage(`${copy.label} duplicated.`);
  }

  function removeStageElement(id: string) {
    setActiveStagePresetId(null);
    setStageElements((current) => current.filter((element) => element.id !== id));
    setSelectedStageElementId(null);
    setMessage('Stage element removed.');
  }

  function stagePointFromPointer(event: ReactPointerEvent<HTMLElement>): StagePoint2D | null {
    const stage = event.currentTarget.closest<HTMLElement>('.multi-stage');
    if (!stage) return null;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: (event.clientX - bounds.left) / bounds.width * 1000,
      y: (event.clientY - bounds.top) / bounds.height * 560
    };
  }

  function beginStageDrag(
    event: ReactPointerEvent<HTMLElement>,
    kind: 'fixture' | 'element',
    id: string,
    preserved: Vec3
  ) {
    if (stageMode !== 'move' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stageDragRef.current = { pointerId: event.pointerId, kind, id, preserved, moved: false };
    if (kind === 'fixture') {
      setStageFixtureId(id);
      setSelectedStageElementId(null);
      selectFixtureFromConsole(id, false);
    } else {
      setSelectedStageElementId(id);
    }
  }

  function moveStageDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = stagePointFromPointer(event);
    if (!point) return;
    event.preventDefault();
    const position = unprojectStagePoint(point, stageSettings.dimensions, stageView, drag.preserved);
    drag.moved = true;
    if (drag.kind === 'fixture') {
      setPatch((current) => current.map((fixture, index) => {
        if (fixture.id !== drag.id) return fixture;
        const transform = fixtureTransform(fixture, index, current.length, stageSettings.dimensions);
        return { ...fixture, transform: { ...transform, position } };
      }));
    } else {
      setStageElements((current) => current.map((element) => {
        if (element.id !== drag.id) return element;
        const migrated = migrateStageElement(element, stageSettings.dimensions);
        return { ...migrated, transform: { ...migrated.transform!, position } };
      }));
    }
  }

  function endStageDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = stageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    stageDragRef.current = null;
    if (drag.moved) {
      const itemName = drag.kind === 'fixture'
        ? patchRef.current.find((fixture) => fixture.id === drag.id)?.name ?? 'Fixture'
        : stageElements.find((element) => element.id === drag.id)?.label ?? 'Stage object';
      setMessage(`${itemName} moved in ${stageView} view. Its physical coordinates are saved with the show.`);
    }
  }

  function fxGraphPoints(waveform: EffectWaveform, depth = 100, offset = 0, steps?: readonly PhaserStep[]) {
    return Array.from({ length: 65 }, (_, index) => {
      const x = index / 64;
      const source = steps?.length ? phaserStepValue(steps, x) : effectWaveValue(waveform, x);
      const y = Math.max(0, Math.min(1, offset / 100 + source * depth / 100));
      return `${(x * 600).toFixed(1)},${(120 - y * 100).toFixed(1)}`;
    }).join(' ');
  }

  function enableStepRecipe() {
    setFxEditor((current) => ({
      ...current,
      waveform: 'step',
      steps: current.steps?.length ? current.steps : [
        { value: 100, width: 1, transition: 0, acceleration: 0, deceleration: 0 },
        { value: 0, width: 1, transition: 0, acceleration: 0, deceleration: 0 }
      ]
    }));
  }

  function updateFxStep(index: number, updates: Partial<PhaserStep>) {
    setFxEditor((current) => ({
      ...current,
      steps: (current.steps ?? []).map((step, stepIndex) => stepIndex === index ? { ...step, ...updates } : step)
    }));
  }

  function addFxStep() {
    setFxEditor((current) => ({
      ...current,
      waveform: 'step',
      steps: [...(current.steps ?? []), { value: 100, width: 1, transition: 0, acceleration: 0, deceleration: 0 }].slice(0, 16)
    }));
  }

  function moveFxStep(index: number, direction: -1 | 1) {
    setFxEditor((current) => {
      const steps = [...(current.steps ?? [])];
      const target = index + direction;
      if (target < 0 || target >= steps.length) return current;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  }

  function removeFxStep(index: number) {
    setFxEditor((current) => {
      const steps = (current.steps ?? []).filter((_, stepIndex) => stepIndex !== index);
      return { ...current, steps: steps.length ? steps : undefined };
    });
  }

  function addFxLane() {
    setFxEditor((current) => ({
      ...current,
      lanes: [...(current.lanes ?? []), {
        parameter: 'dimmer',
        waveform: 'sine',
        depth: 100,
        offset: 0,
        mode: 'absolute'
      } as CustomEffectLane].slice(0, 8)
    }));
  }

  function updateFxLane(index: number, updates: Partial<CustomEffectLane>) {
    setFxEditor((current) => ({
      ...current,
      lanes: (current.lanes ?? []).map((lane, laneIndex) => laneIndex === index ? { ...lane, ...updates } : lane)
    }));
  }

  function removeFxLane(index: number) {
    setFxEditor((current) => ({ ...current, lanes: (current.lanes ?? []).filter((_, laneIndex) => laneIndex !== index) }));
  }

  function loadFactoryFx(effect: EffectPreset) {
    const shape = EFFECT_SHAPES[effect.id];
    if (effect.id === 'rainbow' || effect.id === 'color-chase' || effect.id === 'sweep') {
      const recipe = FX_RECIPES.find(r=>r.id===(effect.id==='sweep'?'circle':effect.id==='rainbow'?'rainbow':'sunset'))!;
      setSelectedFxBankId(effect.id);setFxEditor({...structuredClone(recipe.effect),id:`factory-${effect.id}`,name:effect.name,bpm:effect.defaultBpm});return;
    }
    setSelectedFxBankId(effect.id);
    setFxEditor({
      id: `factory-${effect.id}`,
      name: effect.name,
      parameter: shape.parameter,
      waveform: shape.waveform,
      bpm: effect.defaultBpm,
      depth: 100,
      phaseSpread: shape.phaseSpread,
      offset: 0,
      orderMode: 'forward',
      blocks: 1,
      groups: 1,
      wings: 1,
      shift: 0,
      direction: 'forward',
      cycleBeats: 1,
      mode: 'absolute'
    });
  }

  function saveCustomFx() {
    const cleanName = fxEditor.name.trim() || 'Custom FX';
    const saved: CustomEffect = {
      ...fxEditor,
      name: cleanName,
      bpm: Math.max(20, Math.min(300, fxEditor.bpm)),
      depth: Math.max(0, Math.min(100, fxEditor.depth)),
      phaseSpread: Math.max(0, Math.min(200, fxEditor.phaseSpread)),
      offset: Math.max(-100, Math.min(100, fxEditor.offset)),
      orderMode: fxEditor.orderMode ?? 'forward',
      blocks: Math.max(1, Math.min(64, Math.round(fxEditor.blocks ?? 1))),
      groups: Math.max(1, Math.min(64, Math.round(fxEditor.groups ?? 1))),
      wings: Math.max(1, Math.min(16, Math.round(fxEditor.wings ?? 1))),
      shift: Math.max(-256, Math.min(256, Math.round(fxEditor.shift ?? 0))),
      direction: fxEditor.direction ?? 'forward',
      cycleBeats: Math.max(.125, Math.min(32, fxEditor.cycleBeats ?? 1)),
      mode: fxEditor.mode ?? 'absolute',
      steps: fxEditor.steps?.slice(0, 16).map((step) => ({
        value: Math.max(0, Math.min(100, step.value)),
        width: Math.max(.01, Math.min(1000, step.width ?? 1)),
        transition: Math.max(0, Math.min(100, step.transition ?? 0)),
        acceleration: Math.max(0, Math.min(100, step.acceleration ?? 0)),
        deceleration: Math.max(0, Math.min(100, step.deceleration ?? 0))
      })),
      lanes: fxEditor.lanes?.slice(0, 8).map((lane) => ({
        ...lane,
        depth: Math.max(0, Math.min(100, lane.depth)),
        offset: Math.max(-100, Math.min(100, lane.offset)),
        phaseOffset: Math.max(-8, Math.min(8, lane.phaseOffset ?? 0)),
        rateMultiplier: Math.max(.125, Math.min(8, lane.rateMultiplier ?? 1)),
        mode: lane.mode ?? 'absolute',
        steps: lane.steps?.slice(0, 16).map((step) => ({
          value: Math.max(0, Math.min(100, step.value)),
          width: Math.max(.01, Math.min(1000, step.width ?? 1)),
          transition: Math.max(0, Math.min(100, step.transition ?? 0)),
          acceleration: Math.max(0, Math.min(100, step.acceleration ?? 0)),
          deceleration: Math.max(0, Math.min(100, step.deceleration ?? 0))
        }))
      })),
      id: fxEditor.id.startsWith('custom-') && fxEditor.id !== 'custom-preview'
        ? fxEditor.id
        : `custom-${Date.now().toString(36)}`
    };
    setCustomEffects((current) => [...current.filter((effect) => effect.id !== saved.id), saved].slice(-32));
    setFxEditor(saved);
    setSelectedFxBankId(saved.id);
    setMessage(`${saved.name} saved to the FX bank.`);
  }

  function deleteCustomFx(id: string) {
    setCustomEffects((current) => current.filter((effect) => effect.id !== id));
    if (activeCustomEffectIdRef.current === id) stopEffect(false);
    if (selectedFxBankId === id) {
      const fallback = EFFECT_PRESETS[0];
      loadFactoryFx(fallback);
    }
    setMessage('Custom FX removed from the bank.');
  }

  function runCustomFx(effect: CustomEffect, targetIds?: readonly string[]) {
    if (activeCustomEffectIdRef.current === effect.id) {
      stopEffect();
      return;
    }
    const effectFixtures = targetIds?.length
      ? targetIds
          .map((id) => patchRef.current.find((fixture) => fixture.id === id))
          .filter((fixture): fixture is PatchedFixture => Boolean(fixture))
          .map((fixture) => ({ ...fixture, selected: true }))
      : patchRef.current.map((fixture) => ({ ...fixture }));
    if (!effectFixtures.some((fixture) => fixture.selected)) {
      setMessage('Select fixtures or a group before running the custom FX.');
      return;
    }
    if (effect.gridPhaseMode && effect.gridPhaseMode !== 'selection' && (!selectedGroup || effectFixtures.filter(f=>f.selected).some(f=>!selectedGroup.fixtureOrder.includes(f.id)))) {setMessage('Select a group with a selection grid before running row or column FX.');return;}
    stopFade();
    stopEffect(false, false, false);
    setAudioArmed(false);
    effectTargetIdsRef.current = effectFixtures.filter((fixture) => fixture.selected).map((fixture) => fixture.id);
    effectBaseUniverseRef.current = [...universeRef.current];
    const startedAt = performance.now();
    activeCustomEffectIdRef.current = effect.id;
    setActiveCustomEffectId(effect.id);
    const tick = (now: number) => {
      if (activeCustomEffectIdRef.current !== effect.id) return;
      const updates = renderCustomEffect(effect, effectFixtures, now - startedAt, effectBaseUniverseRef.current, selectedGroup?.selectionGrid);
      void dispatchControl({
        type: 'playback.layer.set',
        universe: 1,
        layerId: 'fx',
        priority: 30,
        mode: 'ltp',
        updates
      }, 'fx');
      effectAnimationRef.current = requestAnimationFrame(tick);
    };
    effectAnimationRef.current = requestAnimationFrame(tick);
    setMessage(`${effect.name} running on selected lights.`);
  }

  function startEffectStack(layers: readonly EffectStackLayer[], name: string) {
    stopFade(); stopEffect(false, false, false); setAudioArmed(false);
    const id=`stack-${crypto.randomUUID()}`;
    activeCustomEffectIdRef.current=id;setActiveCustomEffectId(id);
    const base=[...universeRef.current],startedAt=performance.now();let last=startedAt-FRAME_MS;
    const tick=(now:number)=>{
      if(activeCustomEffectIdRef.current!==id)return;
      if(now-last>=FRAME_MS){last=now;void dispatchControl({type:'playback.layer.set',universe:1,layerId:'fx',priority:30,mode:'ltp',updates:renderEffectStack(layers,patchRef.current,now-startedAt,base)},'fx');}
      effectAnimationRef.current=requestAnimationFrame(tick);
    };
    effectAnimationRef.current=requestAnimationFrame(tick);setMessage(`${name} · stacked FX running.`);
  }
  function takeCreatorPlaybackAuthority() {
    // Timeline uses a higher-priority playback layer. Clear it before editor
    // previews so an empty Timeline span cannot mask Show Creator output.
    window.dispatchEvent(new Event('lumarig-stop-timeline'));
    stopTimeline();
    takeEditingPlaybackAuthority();
  }
  function selectCreatorSection(id: string) {
    setActiveSectionId(id);
    const cue=showFile.cues.find(item=>item.sourceSectionId===id);
    if (cue) {
      setActiveCueId(cue.id);
      selectCueTargets(cue);
    }
  }
  function previewCreatorSection(section: ShowSection) {
    takeCreatorPlaybackAuthority();
    setActiveSectionId(section.id);
    try {
      const cue=buildSectionCues([section],patchRef.current,showFile.groups ?? [])[0];
      fadeCueToUniverse(cue,applyUniverseUpdates(universeRef.current,cue.changes ?? []));
    }
    catch(error){setMessage(String(error));}
  }
  function changeShowMode(next: ShowMode) {
    if (next !== 'timeline') {
      window.dispatchEvent(new Event('lumarig-stop-timeline'));
      stopTimeline();
    }
    setShowMode(next);
  }
  function openTimelineStepEditor(cueId:string) {
    const cue=showFileRef.current.cues.find(item=>item.id===cueId);
    const section=cue?.sourceSectionId ? showFileRef.current.creatorSections?.find(item=>item.id===cue.sourceSectionId) : undefined;
    if(!section){setMessage('This Timeline clip is not linked to a Show Creator section.');return;}
    const stepLayer=section.layers.find(layer=>layer.stepEditor&&layer.customEffect);
    if(!stepLayer){setMessage('This section has no Step Editor layer yet.');return;}
    const song=songsForShow(showFileRef.current).find(item=>item.name===section.song);
    if(song)setActiveSongId(song.id);
    setActiveSectionId(section.id);
    changeShowMode('creator');
    setMessage(`Step Editor opened for ${section.song} · ${section.name}.`);
  }
  const songBank = songsForShow(showFile);
  const creatorSong = songBank.find(song => song.id === activeSongId);
  const mediaUseCounts = useMemo(() => countMediaIds({ working: showFile, songLibrary, showLibrary, showRecovery }), [showFile, songLibrary, showLibrary, showRecovery]);
  useEffect(() => {
    try { writeCompatibilityStorage('lumarig-active-song:' + showFile.name, activeSongId); } catch { /* Working show still autosaves. */ }
  }, [activeSongId, showFile.name]);
  useEffect(() => {
    if (!libraryReady || restoredSong.current) return;
    restoredSong.current = true;
    const song = songsForShow(showFile).find(s => s.id === activeSongId);
    if (song) void selectBankSong(song, showMode === 'creator' ? 'creator' : 'timeline');
  }, [libraryReady]);
  function addBankSong(name: string) {
    if (!libraryReady) { setMessage('Song Library is still opening.'); return; }
    if (songBank.length >= 100) { setMessage('Song limit reached.'); return; }
    if (songBank.some(song => song.name.toLowerCase() === name.toLowerCase())) { setMessage('That song is already in the bank.'); return; }
    const id = crypto.randomUUID();
    const song = { id, libraryId: id, name, bpm: masterTempoBpm };
    setShowFile(current => ({ ...current, songs: [...songsForShow(current), song] }));
    setActiveSongId(song.id);
  }
  async function saveBankSong(song: SongRecord) {
    if (!libraryReady) return;
    setSaveStatus('Saving…');
    try {
      const id = programId(showFileRef.current, song);
      const saved = await saveAppProgramState(showFileRef.current, { forceId: id, workspace: currentWorkspaceCheckpoint() });
      setSongLibrary(saved.programs); setSaveStatus('Saved');
      const program = saved.programs.find((item) => item.id === id);
      if (program && cloudAccount) {
        await syncSongProgramToCloud(program);
        setMessage(`${song.name} saved locally and synced to LumaRig Cloud.`);
      } else {
        setMessage(`${song.name} saved to Song Library.`);
      }
    } catch (error) { setSaveStatus('Save failed'); setMessage(String(error)); }
  }
  function useLibrarySong(program: SongProgram) {
    try {
      const result = insertSongProgram(showFileRef.current, program);
      setShowFile(result.show); setActiveSongId(result.song.id);
      setMessage(`${result.song.name} added to this Show with its sections, lighting, timeline and media.`);
    } catch (error) { setMessage(String(error)); }
  }
  async function chooseRecordingLibrarySong(program:SongProgram) {
    try {
      const result=insertSongProgram(showFileRef.current,program);
      clearShowAudio();
      setShowFile(result.show);setActiveSongId(result.song.id);setTimelineShowId(result.song.id);
      timelinePositionRef.current=0;setTimelinePositionBar(0);setMasterTempo(result.song.bpm);changeTempoLock(true);
      const token=++mediaLoadToken.current;
      if(result.song.mediaId){const media=await readSongMedia(result.song.mediaId);if(token!==mediaLoadToken.current)return;if(media)activateMedia(media,result.song.mediaName ?? result.song.name);else setMessage('Song added. Its media is missing; import or relink media.');}
      setMessage(result.song.name+' ready to record.');
    }catch(error){setMessage(String(error));}
  }
  async function recoverShow(recovery: Recovery) {
    const workspace = recovery.workspace ? { ...recovery.workspace, projects:showLibrary, midiMappings, settings } : currentWorkspaceCheckpoint();
    if (!await checkpointShowChange(recovery.show, workspace)) return;
    if (recovery.workspace) applyWorkspaceCheckpoint(workspace);
    clearShowAudio(); stopTimeline(); stopFade(); clearBusk(false); stopEffect(false);
    setActiveSongId(''); setTimelineShowId(''); setCueTimelineSong(null);
    setShowFile(structuredClone(recovery.show)); setShowMode('songs');
    setMessage(`${recovery.show.name} restored from Recovery.`);
  }
  function renameBankSong(id: string, name: string) {
    try { const next = renameSong(showFile, id, name); setShowFile(next); }
    catch (error) { setMessage(String(error)); }
  }
  function activateMedia(file: Blob, name: string) {
    showTrackAudioRef.current?.pause();
    if (showTrackUrlRef.current) URL.revokeObjectURL(showTrackUrlRef.current);
    const url = URL.createObjectURL(file);
    showTrackUrlRef.current = url;
    setShowTrackUrl(url); setShowTrackName(name); setShowTrackDurationMs(0); setShowTrackPositionMs(0);
  }
  async function attachBankMedia(song: SongRecord, file: File) {
    if (!file.type.startsWith('audio/') && file.type !== 'video/mp4' && !/\.(wav|mp3|m4a|aiff?|flac|ogg|mp4)$/i.test(file.name)) throw Error('Choose an audio file or MP4.');
    const mediaId = crypto.randomUUID();
    await storeSongMedia(mediaId, file);
    setShowFile(current => ({ ...current, songs: songsForShow(current).map(s => s.id === song.id ? { ...s, mediaId, mediaName: file.name, tempoAnalysis: undefined } : s), timelineShows: current.timelineShows?.map(t => t.name === song.name ? { ...t, timeline: { ...t.timeline, audioName: file.name } } : t) }));
    setMessage(`${file.name} saved and linked to ${song.name}. Tempo analysis is running.`);
    if(file.type.startsWith('audio/') || !/\.mp4$/i.test(file.name)){
      void waveformForBlob(file).then(analyzeTempo).then(analysis=>{
        setShowFile(current=>({...current,songs:songsForShow(current).map(s=>s.id===song.id?{...s,tempoAnalysis:analysis}:s)}));
        setMessage(`${song.name}: detected ${analysis.bpm} BPM · ${Math.round(analysis.confidence*100)}% confidence.`);
      }).catch(()=>setMessage(`${file.name} linked. Tempo could not be detected automatically; manual BPM still works.`));
    }
  }

  async function analyzeBankSongTempo(song: SongRecord) {
    if(!song.mediaId)throw Error('Link audio before analyzing tempo.');
    const media=await readSongMedia(song.mediaId);
    if(!media)throw Error('Relink the missing media file before analyzing tempo.');
    const analysis=analyzeTempo(await waveformForBlob(media));
    setShowFile(current=>({...current,songs:songsForShow(current).map(item=>item.id===song.id?{...item,tempoAnalysis:analysis}:item)}));
    setMessage(`${song.name}: ${analysis.bpm} BPM detected · ${Math.round(analysis.confidence*100)}% confidence.`);
  }

  function applyAnalyzedTempo(song:SongRecord,bpm:number){
    const next=Math.max(20,Math.min(300,bpm));
    setShowFile(current=>({
      ...current,
      songs:songsForShow(current).map(item=>item.id===song.id?{...item,bpm:next,tempoLocked:true}:item),
      creatorSections:current.creatorSections?.map(section=>section.song===song.name?{...section,bpm:next}:section),
      timelineShows:current.timelineShows?.map(item=>item.name===song.name?{...item,timeline:{...item.timeline,bpm:next}}:item)
    }));
    if(song.id===activeSongId){
      setEffectBpm(next);effectBpmRef.current=next;setTempoLocked(true);tempoLockedRef.current=true;
    }
    setMessage(`${song.name} set to ${next} BPM and locked.`);
  }

  function correctActiveSongDownbeat(downbeatMs:number){
    if(!creatorSong?.tempoAnalysis){setMessage('Analyze the Song tempo before correcting its downbeat.');return;}
    const analysis=correctedDownbeat(creatorSong.tempoAnalysis,downbeatMs);
    setShowFile(current=>({...current,songs:songsForShow(current).map(song=>song.id===creatorSong.id?{...song,tempoAnalysis:analysis}:song)}));
    setMessage(`${creatorSong.name} downbeat corrected to ${(analysis.downbeatMs/1000).toFixed(2)}s.`);
  }
  function applyMediaAssetName(asset: MediaAsset) {
    setShowFile((current) => {
      const previousNames = new Set(
        songsForShow(current)
          .filter((song) => song.mediaId === asset.id && song.mediaName)
          .map((song) => song.mediaName!)
      );
      const updateTimeline = (timeline: typeof current.timeline) => timeline ? {
        ...timeline,
        audioName: timeline.audioName && previousNames.has(timeline.audioName) ? asset.name : timeline.audioName,
        videoClips: timeline.videoClips?.map((clip) => clip.mediaId === asset.id ? { ...clip, name: asset.name } : clip),
      } : timeline;
      return {
        ...current,
        songs: songsForShow(current).map((song) => song.mediaId === asset.id ? { ...song, mediaName: asset.name } : song),
        timeline: updateTimeline(current.timeline),
        timelineShows: current.timelineShows?.map((item) => ({
          ...item,
          timeline: updateTimeline(item.timeline)!,
        })),
      };
    });
  }

  async function attachLibraryAssetToActiveSong(asset: MediaAsset) {
    const song = songsForShow(showFileRef.current).find((candidate) => candidate.id === activeSongId);
    if (!song) throw Error('Select a Song in Song Bank before assigning media.');
    if (asset.kind === 'image') throw Error('Still images belong to screen sources, not Song audio.');
    setShowFile((current) => ({
      ...current,
      songs: songsForShow(current).map((candidate) => candidate.id === song.id ? { ...candidate, mediaId: asset.id, mediaName: asset.name } : candidate),
      timelineShows: current.timelineShows?.map((item) => item.name === song.name ? { ...item, timeline: { ...item.timeline, audioName: asset.name } } : item),
    }));
    const media = await readSongMedia(asset.id);
    if (!media) throw Error(`Relink missing media: ${asset.name}`);
    activateMedia(media, asset.name);
    setMessage(`${asset.name} linked to ${song.name} from Media Library.`);
  }

  function portableFileStem(name: string) {
    return (name.trim() || 'LumaRig').replace(/[<>:\"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').slice(0, 120);
  }

  async function ensurePortableMedia(payload: unknown) {
    const mediaIds = collectMediaIds(payload);
    for (const mediaId of mediaIds) {
      const nativeAsset = await readMediaAsset(mediaId);
      if (nativeAsset?.missing) throw Error('Relink missing media before export: ' + nativeAsset.name);
      if (nativeAsset) continue;
      const legacy = await readSongMedia(mediaId);
      if (!legacy) throw Error('Media used by this file is missing: ' + (mediaNameForId(payload, mediaId) ?? mediaId));
      await persistManagedMedia(mediaId, legacy, mediaNameForId(payload, mediaId) ?? (mediaId + '.media'));
    }
    return mediaIds;
  }

  async function exportSongPackage(songOrProgram: SongRecord | SongProgram) {
    try {
      const program: SongProgram = 'show' in songOrProgram
        ? structuredClone(songOrProgram)
        : (() => {
            const id = programId(showFileRef.current, songOrProgram);
            const existing = songLibrary.find((item) => item.id === id);
            return {
              id,
              savedAt: new Date().toISOString(),
              revision: existing?.revision ?? 1,
              show: extractSongProgram(showFileRef.current, songOrProgram),
            };
          })();
      const name = program.show.name || program.show.songs?.[0]?.name || 'Song';
      setMessage('Preparing ' + name + '.lumarigsong…');
      const mediaIds = await ensurePortableMedia(program);
      const path = await exportPortablePackage('lumarig-song', program, mediaIds, portableFileStem(name));
      if (path) setMessage(name + '.lumarigsong saved · ' + mediaIds.length + ' media file' + (mediaIds.length === 1 ? '' : 's') + ' included.');
    } catch (error) {
      setMessage('Song export failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function importSongPackageFile() {
    let staged: Awaited<ReturnType<typeof importPortablePackage<SongProgram>>> = null;
    try {
      setMessage('Opening LumaRig Song file…');
      staged = await importPortablePackage<SongProgram>('lumarig-song');
      if (!staged) return;
      if (!isSongProgram(staged.manifest.payload)) throw Error('This .lumarigsong file contains invalid Song programming.');
      const committedMedia = await commitPortableBackupRestore(staged.restoreToken);
      const imported = await importSongProgram(staged.manifest.payload);
      setSongLibrary(imported.state.programs);
      setShowRecovery(imported.state.recovery);
      setMessage(imported.program.show.name + ' imported into Song Library' + (imported.conflictCopy ? ' as a separate copy' : '') + ' · ' + committedMedia + ' new media file' + (committedMedia === 1 ? '' : 's') + '.');
    } catch (error) {
      if (staged?.restoreToken) await cancelPortableBackupRestore(staged.restoreToken).catch(() => {});
      setMessage('Song import failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  function portableShowSnapshot(snapshot?: ShowProjectSnapshot): ShowProjectSnapshot {
    if (snapshot) return { ...structuredClone(snapshot), cloudRevision: undefined, cloudFolderId: undefined, lastEditor: 'lumarig', show: sanitizeShow(snapshot.show) };
    const cleanName = showFileRef.current.name.trim() || 'Untitled Show';
    return {
      id: 'show-' + Date.now().toString(36),
      name: cleanName, savedAt: new Date().toISOString(), status: 'show',
      revision: sharedShowRevisionRef.current, lastEditor: 'lumarig',
      show: sanitizeShow({ ...showFileRef.current, name: cleanName }),
      patch: patchRef.current.map((fixture, index) => migratePatchedFixture(fixture, index, patchRef.current.length, stageSettings.dimensions)),
      stageElements: stageElements.map((element) => migrateStageElement(element, stageSettings.dimensions)),
      stageSettings: { ...stageSettings, dimensions: { ...stageSettings.dimensions } },
      looks: [...savedLooks],
    };
  }

  async function exportShowPackage(snapshot?: ShowProjectSnapshot) {
    try {
      const portable = portableShowSnapshot(snapshot);
      setMessage('Preparing ' + portable.name + '.lumarigshow…');
      const mediaIds = await ensurePortableMedia(portable);
      const path = await exportPortablePackage('lumarig-show', portable, mediaIds, portableFileStem(portable.name));
      if (path) setMessage(portable.name + '.lumarigshow saved · ' + mediaIds.length + ' media file' + (mediaIds.length === 1 ? '' : 's') + ' included.');
    } catch (error) {
      setMessage('Show export failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function importShowPackageFile() {
    let staged: Awaited<ReturnType<typeof importPortablePackage<ShowProjectSnapshot>>> = null;
    try {
      setMessage('Opening LumaRig Show file…');
      staged = await importPortablePackage<ShowProjectSnapshot>('lumarig-show');
      if (!staged) return;
      if (!isShowProjectSnapshot(staged.manifest.payload)) throw Error('This .lumarigshow file contains invalid Show programming.');
      let imported = portableShowSnapshot(staged.manifest.payload);
      const existing = showLibrary.find((item) => item.id === imported.id);
      if (existing && JSON.stringify({ ...existing, savedAt: '', cloudRevision: undefined, cloudFolderId: undefined }) === JSON.stringify({ ...imported, savedAt: '', cloudRevision: undefined, cloudFolderId: undefined })) {
        const committedMedia = await commitPortableBackupRestore(staged.restoreToken);
        setMessage(existing.name + ' is already in Show Library · ' + committedMedia + ' missing media file' + (committedMedia === 1 ? '' : 's') + ' restored.');
        return;
      }
      if (existing) {
        const base = imported.name;
        const used = new Set(showLibrary.map((item) => item.name.toLowerCase()));
        let name = base + ' (Imported)', n = 2;
        while (used.has(name.toLowerCase())) name = base + ' (Imported ' + n++ + ')';
        imported = { ...imported, id: 'show-' + Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 8), name };
      }
      imported = { ...imported, savedAt: new Date().toISOString(), cloudRevision: undefined, cloudFolderId: undefined, lastEditor: 'lumarig' };
      const committedMedia = await commitPortableBackupRestore(staged.restoreToken);
      const projects = [imported, ...showLibrary.filter((item) => item.id !== imported.id)].slice(0, 40);
      const saved = await saveAppProgramState(showFileRef.current, { seed: [imported.show], workspace: { ...currentWorkspaceCheckpoint(), projects } });
      setShowLibrary(projects); setSongLibrary(saved.programs); setShowRecovery(saved.recovery);
      try { writeCompatibilityStorage(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(projects)); } catch {}
      setMessage(imported.name + ' imported into Show Library · ' + committedMedia + ' new media file' + (committedMedia === 1 ? '' : 's') + '.');
    } catch (error) {
      if (staged?.restoreToken) await cancelPortableBackupRestore(staged.restoreToken).catch(() => {});
      setMessage('Show import failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  async function exportLocalPortableBackup() {
    if (!libraryReady) throw Error('Song Library is still opening.');
    setMessage('Preparing portable backup…');
    const saved = await saveAppProgramState(showFileRef.current, {
      capture: 'all',
      workspace: currentWorkspaceCheckpoint(),
    });
    const mediaIds = collectMediaIds(saved);
    for (const mediaId of mediaIds) {
      const nativeAsset = await readMediaAsset(mediaId);
      if (nativeAsset?.missing) throw Error(`Relink missing media before backup: ${nativeAsset.name}`);
      if (nativeAsset) continue;
      const legacy = await readSongMedia(mediaId);
      if (!legacy) throw Error(`Media used by this library is missing: ${mediaNameForId(saved, mediaId) ?? mediaId}`);
      await persistManagedMedia(mediaId, legacy, mediaNameForId(saved, mediaId) ?? `${mediaId}.media`);
    }
    const path = await exportPortableBackup(saved, mediaIds, `${showFileRef.current.name || 'LumaRig'} Backup`);
    if (path) setMessage(`Portable backup saved · ${mediaIds.length} media file${mediaIds.length === 1 ? '' : 's'} included.`);
  }

  async function restoreLocalPortableBackup() {
    setMessage('Opening portable backup…');
    const imported = await importPortableBackup();
    if (!imported) return;
    try {
      const state = validateProgramState(imported.manifest.programState);
      if (state.workspace && !isAppWorkspaceCheckpoint(state.workspace)) throw Error('Backup workspace is invalid. Existing work was not replaced.');
      if (state.recovery.some((item) => item.workspace && !isAppWorkspaceCheckpoint(item.workspace))) throw Error('Backup recovery data is invalid. Existing work was not replaced.');

      // Validate first, commit staged media second, replace the transactional
      // program checkpoint last. An invalid backup never touches live assets.
      const committedMedia = await commitPortableBackupRestore(imported.restoreToken);
      try {
        await replaceProgramState(state);
      } catch (error) {
        throw Error(`Backup media was restored, but the program checkpoint could not be replaced: ${String(error)}`);
      }
      setMessage(`Backup restored · ${committedMedia} new media file${committedMedia === 1 ? '' : 's'} committed. Reloading LumaRig…`);
      window.location.reload();
    } catch (error) {
      await cancelPortableBackupRestore(imported.restoreToken).catch(() => {});
      throw error;
    }
  }
  async function selectBankSong(song: SongRecord, mode?: 'creator' | 'timeline') {
    window.dispatchEvent(new Event('lumarig-stop-timeline')); stopTimeline();
    const token = ++mediaLoadToken.current;
    showTrackAudioRef.current?.pause();
    setActiveSongId(song.id); setMasterTempo(song.bpm, false);
    setTempoLocked(song.tempoLocked !== false); tempoLockedRef.current = song.tempoLocked !== false;
    const saved = showFileRef.current.timelineShows?.find(t => t.name === song.name);
    if (!saved) {
      const ids = new Set(showFile.cues.filter(c => c.trackName === song.name).map(c => c.id));
      setShowFile(current => ({ ...current, songs: songsForShow(current), timelineShows: [...(current.timelineShows ?? []), { id: song.id, name: song.name, timeline: { ...(current.timeline ?? EMPTY_TIMELINE), bpm: song.bpm, audioName: song.mediaName, clips: (current.timeline?.clips ?? []).filter(c => ids.has(c.cueId)) } }] }));
    }
    setTimelineShowId(saved?.id ?? song.id);
    if (mode) {
      if (song.id !== activeSongId) { setActiveCueId(null); setActiveSectionId(''); setActiveTimelineClipId(''); activeTimelineClipRef.current=''; timelinePositionRef.current=0; setTimelinePositionBar(0); }
      setCueTimelineSong(null); setShowMode(mode);
    }
    if (showTrackUrlRef.current) URL.revokeObjectURL(showTrackUrlRef.current);
    showTrackUrlRef.current = ''; setShowTrackUrl(''); setShowTrackName(''); setShowTrackDurationMs(0);
    if (song.mediaId) {
      try {
        const media = await readSongMedia(song.mediaId);
        if (token !== mediaLoadToken.current) return;
        if (media) activateMedia(media, song.mediaName ?? song.name);
        else setMessage(`Relink media for ${song.name} in Song Bank. The file is not on this computer.`);
      } catch (error) { if (token === mediaLoadToken.current) setMessage(String(error)); }
    }
  }
  async function saveCreatorSongProgram() {
    if (!libraryReady) return;
    const targets = creatorSong ? [creatorSong] : songsForShow(showFileRef.current);
    if (!targets.length) { setMessage('Add a Song or sections before saving.'); return; }
    setSaveStatus('Saving…');
    try {
      let next = showFileRef.current;
      for (const song of targets) next = buildSong(next, song, patchRef.current);
      setShowFile(next);
      const saved = await saveAppProgramState(next, { ...(creatorSong ? { forceId: programId(next, creatorSong) } : { capture: 'all' as const }), workspace: currentWorkspaceCheckpoint() });
      setSongLibrary(saved.programs); setSaveStatus('Saved');
      if (cloudAccount) {
        for (const target of targets) {
          const id = programId(next, target);
          const program = saved.programs.find((item) => item.id === id);
          if (program) await syncSongProgramToCloud(program);
        }
        setMessage(`${targets.length} Song Program(s) rebuilt, saved, and synced to LumaRig Cloud.`);
      } else {
        setMessage(`${targets.length} Song Program(s) rebuilt and saved with their sections, layers, timeline and media.`);
      }
    } catch (error) { setSaveStatus('Save failed'); setMessage(String(error)); }
  }
  function buildCreatorSections() {
    try {
      const targets = creatorSong ? [creatorSong] : songBank;
      let next = showFile;
      for (const song of targets) next = buildSong(next, song, patchRef.current);
      setShowFile(next);
      const song = targets[0];
      if (song) { setActiveSongId(song.id); setTimelineShowId(next.timelineShows?.find(t => t.name === song.name)?.id ?? ''); }
      setMessage(`${targets.length} song(s) updated. Open Timeline to arrange lighting with media.`);
    } catch(error) {setMessage(String(error));}
  }
  const editingTimeline = (timelineShowId ? showFile.timelineShows?.find(item=>item.id===timelineShowId)?.timeline : showFile.timeline) ?? EMPTY_TIMELINE;
  useEffect(()=>{
    let cancelled=false;
    const owned:string[]=[];
    videoAssetsRef.current=new Map();
    const clips=editingTimeline.videoClips??[];
    videoOutputOverrideRef.current=clips.length?{url:'',name:'',position:0,playing:false,sentAt:Date.now()}:null;
    void Promise.all(clips.map(async clip=>{
      const media=await readSongMedia(clip.mediaId);if(cancelled)return;
      if(!media){setMessage('Missing video clip: '+clip.name+'. Import its media again.');return;}
      const url=URL.createObjectURL(media);owned.push(url);videoAssetsRef.current.set(clip.mediaId,url);
    })).catch(error=>setMessage(String(error)));
    return()=>{cancelled=true;owned.forEach(url=>URL.revokeObjectURL(url));videoAssetsRef.current=new Map();};
  },[timelineShowId,(editingTimeline.videoClips??[]).map(c=>c.mediaId).join('|')]);
  function updateTimelineVideoFrame(elapsedMs:number) {
    if(!editingTimeline.videoClips?.length){videoOutputOverrideRef.current=null;return;}
    const active=activeVideoClip({...editingTimeline,bpm:masterTempoBpm},elapsedMs);
    videoOutputOverrideRef.current={url:active?videoAssetsRef.current.get(active.clip.mediaId)??'':'',name:active?.clip.name??'',position:active?.position??0,playing:timelinePlayingRef.current,sentAt:Date.now()};
  }
  function changeTimelinePlaying(playing:boolean){
    const positionMs=timelinePositionRef.current*60000/masterTempoBpm*editingTimeline.beatsPerBar;
    const result=applySharedTransport({
      source:'timeline',
      playing,
      positionMs,
      bpm:masterTempoBpm,
      claim:playing,
      release:!playing
    });
    if(!result.accepted){
      setMessage(`Timeline transport is waiting for ${result.state.source} authority to release.`);
      return;
    }
    timelinePlayingRef.current=playing;
    setTimelinePlaying(playing);
    updateTimelineVideoFrame(positionMs);
  }
  function addTimelineFx(recipeId:string,startBar:number,lane:number) {
    const recipe=fxLibrary(customEffects).find(r=>r.id===recipeId);if(!recipe)return;
    if(showFile.cues.length>=200||editingTimeline.clips.length>=1000){setMessage('Cue or timeline clip limit reached.');return;}
    try {
      const section={...createSection(recipe.name,cueTimelineSong??showFile.timelineShows?.find(t=>t.id===timelineShowId)?.name??'Timeline FX',selectedGroup?.id??'',editingTimeline.bpm),recipeId,primaryEffect:FX_RECIPES.some(r=>r.id===recipeId)?undefined:structuredClone(recipe.effect),fadeMs:0,energy:100,intensity:100};
      const built=buildSectionCues([section],patchRef.current,showFile.groups??[])[0];
      const cue={...built,name:recipe.name,sourceSectionId:undefined,universe:undefined};
      const clip={id:crypto.randomUUID(),cueId:cue.id,startBar,lengthBars:8,lane,enabled:true};
      setShowFile(current=>{
        const next={...current,cues:renumberCues([...current.cues,cue])};
        if(timelineShowId)return {...next,timelineShows:(current.timelineShows??[]).map(item=>item.id===timelineShowId?{...item,timeline:{...item.timeline,clips:[...item.timeline.clips,clip]}}:item)};
        return {...next,timeline:{...(current.timeline??EMPTY_TIMELINE),clips:[...(current.timeline?.clips??[]),clip]}};
      });
      setMessage(recipe.name+' added to FX lane '+(lane+1)+'.');
    }catch(error){setMessage(String(error));}
  }
  const exportingVideoRef=useRef(false);
  function recordIntoTimeline(bar:number,overdub:boolean) {
    if(showRecordingActiveRef.current)return;
    if((editingTimeline.takeClips?.length??0)>=24){setMessage('Remove a Timeline take before recording another.');return;}
    ++cueLaunchGeneration.current;window.dispatchEvent(new Event('lumarig-stop-timeline'));
    stopRecordedShowPlayback(false);stopFade();stopEffect(false);
    const held=[...outputUniverseRef.current];stopTimeline();void commitUniverse(held,'recorder');
    const barMs=60000/masterTempoBpm*editingTimeline.beatsPerBar,bounds=mediaWindow(editingTimeline,showTrackDurationMs);
    const absolute=bar*barMs,offset=editingTimeline.audioOffsetBars*barMs;
    timelineRecordingOrigin.current={id:timelineShowId,startBar:bar,barMs,timeline:structuredClone({...editingTimeline,bpm:masterTempoBpm}),cues:structuredClone(showFile.cues),overdub,
      sourceStartMs:mediaPosition(absolute,offset,bounds)??(absolute<offset?bounds.startMs:bounds.endMs),leadInMs:Math.max(0,offset-absolute),sourceEndMs:bounds.endMs,audioStarted:false,manual:new ManualOverdub()};
    startShowRecording();timelinePlayingRef.current=true;setTimelinePlaying(true);
    setWorkspace('live');
    setMessage((overdub?'Overdubbing':'Recording')+' directly into Timeline at bar '+(bar+1).toFixed(2)+'. Perform with Live or Programmer, then Stop + save.');
  }
  async function exportTimelineVideo(clip?:TimelineMediaClip) {
    if(exportingVideoRef.current)return;
    exportingVideoRef.current=true;
    try {
      const source=clip?await readSongMedia(clip.mediaId):showTrackUrlRef.current?await fetch(showTrackUrlRef.current).then(r=>r.blob()):null;
      if(!source)throw Error('The source video is missing. Import it again before exporting.');
      const bounds=mediaWindow(editingTimeline,showTrackDurationMs);
      const start=clip?.trimInMs??bounds.startMs,end=clip?Math.min(clip.trimOutMs,clip.trimInMs+clip.lengthBars*60000/masterTempoBpm*editingTimeline.beatsPerBar):bounds.endMs;
      const path=await exportTrimmedVideo(source,clip?.name??showTrackName,start,end,setMessage);
      setMessage('Trimmed MP4 saved: '+path);
    }catch(error){setMessage(String(error));}finally{exportingVideoRef.current=false;}
  }
  async function importTimelineVideoClip(file:File,startBar:number) {
    try {
      if(!/\.mp4$/i.test(file.name))throw Error('Choose an MP4 video clip.');
      const timelineId=timelineShowId,durationMs=await videoDuration(file),mediaId=crypto.randomUUID();
      await storeSongMedia(mediaId,file);
      const clip={id:crypto.randomUUID(),mediaId,name:file.name,startBar,lengthBars:durationMs/(60000/masterTempoBpm*editingTimeline.beatsPerBar),durationMs,trimInMs:0,trimOutMs:durationMs,enabled:true};
      setShowFile(current=>{
        const append=(timeline:typeof EMPTY_TIMELINE)=>({...timeline,videoClips:[...(timeline.videoClips??[]),clip].slice(0,100)});
        return timelineId?{...current,timelineShows:current.timelineShows?.map(t=>t.id===timelineId?{...t,timeline:append(t.timeline)}:t)}:{...current,timeline:append(current.timeline??EMPTY_TIMELINE)};
      });
      setMessage(file.name+' imported as an independent video clip.');
    }catch(error){setMessage(String(error));}
  }
  async function importTakeAsSongVersion(take:ShowRecording) {
    try{
      const song=songBank.find(s=>s.id===activeSongId) ?? songBank.find(s=>s.mediaName===take.trackName);
      if(!song)throw Error('Choose the original Song from Library before importing the take.');
      const result=recordingSongVersion(showFileRef.current,song,take);
      showFileRef.current=result.show;setShowFile(result.show);
      await selectBankSong(result.song,'timeline');
      setMessage('Editable Song version created. The original Song and recorded take are preserved.');
    }catch(error){setMessage(String(error));}
  }
  function updateEditingTimeline(timeline: typeof EMPTY_TIMELINE) {
    setShowFile(current=>timelineShowId ? {...current,timelineShows:(current.timelineShows??[]).map(item=>item.id===timelineShowId?{...item,timeline}:item)} : {...current,timeline});
  }
  function openSongTimeline(song:string) {
    window.dispatchEvent(new Event('lumarig-stop-timeline'));
    stopTimeline();
    const bankSong=songBank.find(item=>item.name===song);
    if(bankSong) { void selectBankSong(bankSong,'timeline'); setShowMode('cues'); }
    const saved=showFile.timelineShows?.find(item=>item.name===song);
    setTimelineShowId(saved?.id??'');
    const ids=new Set(showFile.cues.filter(c=>(c.trackName?.trim()||'Unfiled cues')===song).map(c=>c.id));
    const starts=(saved?.timeline??showFile.timeline)?.clips.filter(c=>ids.has(c.cueId)).map(c=>c.startBar)??[];
    setTimelineStartBar(starts.length?Math.min(...starts):0);
    setCueTimelineSong(song);
    if(saved?.timeline.audioName!==showTrackName){showTrackAudioRef.current?.pause();}
  }
  function importTimelineShow(imported:ShowFile) {
    if(showFile.cues.length+imported.cues.length>200){setMessage('Import exceeds the 200 cue limit.');return;}
    if((showFile.timelineShows?.length??0)>=100){setMessage('Timeline show limit reached.');return;}
    const ids=new Map(imported.cues.map(c=>[c.id,crypto.randomUUID()]));
    const existing=new Set(showFile.cues.map(c=>c.trackName));
    let name=imported.name, suffix=2;while(existing.has(name))name=imported.name+' '+suffix++;
    const cues=imported.cues.map(c=>({...structuredClone(c),id:ids.get(c.id)!,sourceSectionId:undefined,trackName:name,trackKind:c.trackKind==='media'?'media' as const:'song' as const}));
    const timeline=structuredClone(imported.timeline??imported.timelineShows?.[0]?.timeline??EMPTY_TIMELINE);
    timeline.clips=timeline.clips.filter(c=>ids.has(c.cueId)).map(c=>({...c,id:crypto.randomUUID(),cueId:ids.get(c.cueId)!}));
    setShowFile(current=>{
      const section=current.rundownSections?.[0]??{id:crypto.randomUUID(),name:'Imported Shows'};
      const rundownSections=current.rundownSections?.length?current.rundownSections:[section];
      const importedCues=cues.map(cue=>({...cue,rundownSectionId:section.id}));
      return {...current,cues:renumberCues([...current.cues,...importedCues]),timelineShows:[...(current.timelineShows??[]),{id:crypto.randomUUID(),name,timeline}],rundownSections};
    });
    setMessage(name+' imported as a collapsible timeline show. Relink its audio before playback.');
  }
  function renderTimelineFrame(elapsedMs:number) {
    if(timelineRecordingOrigin.current && showRecordingActiveRef.current)return;
    ++cueLaunchGeneration.current;
    updateTimelineVideoFrame(elapsedMs);
    if(!timelineBaseRef.current){takeEditingPlaybackAuthority();if(cueFollowTimerRef.current!==null)window.clearTimeout(cueFollowTimerRef.current);stopFade();stopEffect(false);setAudioArmed(false);timelineBaseRef.current=[...universeRef.current];}
    const timeline={...editingTimeline,bpm:masterTempoBpm};
    const bar=elapsedMs / (60000 / masterTempoBpm * timeline.beatsPerBar);
    timelinePositionRef.current=bar;
    if (!showTrackAudioRef.current || showTrackAudioRef.current.paused || performance.now()-timelineUiTimeRef.current>80) {
      timelineUiTimeRef.current=performance.now(); setTimelinePositionBar(bar);
    }
    const selectedAsset=[...timeline.videoClips??[],...timeline.takeClips??[]].find(clip=>clip.id===activeTimelineClipRef.current);
    const selectedClip=timeline.clips.find(clip=>clip.enabled && !(timeline.mutedLanes??[]).includes(clip.lane) && clip.id===activeTimelineClipRef.current && bar>=clip.startBar && bar<clip.startBar+clip.lengthBars);
    const timelineCueId=selectedClip?.cueId ?? activeTimelineCueId(timeline,showFile.cues,elapsedMs);
    if (!selectedClip && !selectedAsset) {
      const clip=timeline.clips.find(item=>item.enabled && item.cueId===timelineCueId && bar>=item.startBar && bar<item.startBar+item.lengthBars);
      activeTimelineClipRef.current=clip?.id ?? ''; setActiveTimelineClipId(activeTimelineClipRef.current);
    }
    if (timelineContextCueRef.current !== (timelineCueId ?? '')) {
      timelineContextCueRef.current=timelineCueId ?? '';
      const cue=showFile.cues.find(item=>item.id===timelineCueId);
      if (cue) selectCueTargets(cue);
    }
    setActiveCueId(timelineCueId ?? null);
    setActiveSectionId(showFile.cues.find(cue=>cue.id===timelineCueId)?.sourceSectionId ?? '');
    const updates=renderShowTimeline(timeline,showFile.cues,patchRef.current,elapsedMs,timelineBaseRef.current);
    timelineHeldFrame.current=applyUniverseUpdates(timelineBaseRef.current,updates);
    void dispatchControl({type:'playback.layer.set',universe:1,layerId:'timeline',priority:35,mode:'ltp',updates},'cue');
  }
  function releaseTimeline() { setTimelinePositionBar(timelinePositionRef.current); if(timelineHeldFrame.current) commitUniverse(timelineHeldFrame.current); stopTimeline(); }
  function stopTimeline() {timelineHeldFrame.current=null;timelineBaseRef.current=null;void dispatchControl({type:'playback.layer.clear',universe:1,layerId:'timeline'},'cue');}

  function renderEffectButton(effect: EffectPreset, compact = false) {
    const className = `${compact ? 'show-fx-button' : 'fx-card'} ${activeEffect === effect.id ? 'active' : ''} ${effect.momentary ? 'momentary' : ''}`;
    if (!effect.momentary) {
      return (
        <button key={effect.id} className={className} onClick={() => toggleEffect(effect.id)}>
          <span className={`fx-icon fx-${effect.id}`} />
          <strong>{effect.name}</strong>
          {!compact && <small>{effect.description}</small>}
        </button>
      );
    }
    return (
      <button
        key={effect.id}
        className={className}
        aria-label={`Hold ${effect.name}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startMomentaryEffect(effect.id);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          releaseMomentaryEffect(effect.id);
        }}
        onPointerCancel={() => releaseMomentaryEffect(effect.id)}
        onBlur={() => releaseMomentaryEffect(effect.id)}
        onKeyDown={(event) => {
          if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault();
            startMomentaryEffect(effect.id);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            releaseMomentaryEffect(effect.id);
          }
        }}
      >
        <span className={`fx-icon fx-${effect.id}`} />
        <strong>{effect.name}</strong>
        <b className="fx-hold-badge">HOLD</b>
        {!compact && <small>{effect.description}</small>}
      </button>
    );
  }

  function renderStagePreview(interactive = false) {
    const beamLength = Math.max(stageSettings.dimensions.width, stageSettings.dimensions.depth, stageSettings.dimensions.height) * 1.2;
    return (
      <div className={`multi-stage physical-stage stage-view-${stageView} stage-mode-${stageMode} ${stageLabels?'':'labels-hidden'}`}>
        <div className="stage-view-toolbar" role="group" aria-label="Stage view"><button aria-pressed={stageLabels} onClick={()=>{localStorage.setItem('lumarig.visualizer.labels.v1',stageLabels?'off':'on');window.dispatchEvent(new Event('lumarig-labels-changed'));}}>Labels {stageLabels?'On':'Off'}</button>
          {(['perspective', 'top', 'front', 'side'] as StageView[]).map((view) => <button key={view} className={stageView === view ? 'active' : ''} onClick={() => setStageView(view)}>{view}</button>)}
        </div>
        <svg className="stage-geometry-svg" preserveAspectRatio="none" viewBox="0 0 1000 560" aria-label={`${stageView} physical stage view`}>
          <defs>
            <filter id="beam-glow"><feGaussianBlur stdDeviation="7" /></filter>
            <pattern id="stage-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(125,145,166,.12)" strokeWidth="1" /></pattern>
          </defs>
          <rect x="80" y="56" width="840" height="448" rx="10" fill="url(#stage-grid)" stroke="rgba(125,145,166,.28)" />
          <line x1="500" y1="56" x2="500" y2="504" stroke="rgba(125,145,166,.2)" strokeDasharray="8 8" />
          <line x1="80" y1="280" x2="920" y2="280" stroke="rgba(125,145,166,.2)" strokeDasharray="8 8" />
          {patch.map((fixture, index) => {
            const values = fixtureValues(outputUniverse, fixture);
            const rgb: [number, number, number] = values.red + values.green + values.blue > 0 ? [values.red, values.green, values.blue] : values.uv > 0 ? [120, 62, 255] : [75, 83, 94];
            const color = `rgb(${rgb.join(' ')})`;
            const level = dmxStatus.blackout ? 0 : values.dimmer / 255;
            const geometry = fixtureGeometryState(outputUniverse, fixture, index, patch.length, stageSettings.dimensions);
            const origin = projectStagePoint(geometry.beam.origin, stageSettings.dimensions, stageView);
            const intersection = intersectBeamWithStage(geometry.beam, stageSettings.dimensions);
            const endpoint = projectStagePoint(intersection?.point ?? pointAlongRay(geometry.beam, beamLength), stageSettings.dimensions, stageView);
            const strokeWidth = Math.max(4, geometry.beam.angleDegrees * .65);
            return <g key={fixture.id} className={stageFixture?.id === fixture.id && interactive ? 'editing' : ''}>
              <line x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} stroke={color} strokeWidth={strokeWidth * 2.4} opacity={level * .2} filter="url(#beam-glow)" />
              <line x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} stroke={color} strokeWidth={strokeWidth} opacity={level * .68} strokeLinecap="round" />
              <circle cx={endpoint.x} cy={endpoint.y} r={Math.max(4, strokeWidth * .65)} fill={color} opacity={level}><title>{intersection ? `${fixture.name} hits ${intersection.surface} at ${intersection.distance.toFixed(1)} m` : `${fixture.name} beam`}</title></circle>
              <circle cx={origin.x} cy={origin.y} r="8" fill="#11161d" stroke={fixture.labelColor ?? '#657080'} strokeWidth={stageFixture?.id === fixture.id && interactive ? 5 : 3} />
            </g>;
          })}
          {interactive && ['aim', 'measure', 'target'].includes(stageMode) && stageTargets.map((target) => {
            const projected = projectStagePoint(target.position, stageSettings.dimensions, stageView);
            const selected = target.id === selectedTarget?.id;
            const activate = () => {
              setSelectedTargetId(target.id);
              if (stageMode === 'aim') void aimAtTarget(target);
            };
            return <g
              key={target.id}
              className={`stage-target-marker target-${target.category} ${selected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${stageMode === 'aim' ? 'Aim at' : 'Select'} ${target.name}`}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activate();
                }
              }}
            >
              <circle cx={projected.x} cy={projected.y} r={selected ? 11 : 8} />
              <path d={`M ${projected.x - 15} ${projected.y} H ${projected.x + 15} M ${projected.x} ${projected.y - 15} V ${projected.y + 15}`} />
              <text x={projected.x} y={projected.y + 28} textAnchor="middle">{target.name}</text>
            </g>;
          })}
        </svg>
        {stageElements.map((element) => {
          const worldPosition = stageElementPosition(element, stageSettings.dimensions);
          const projected = projectStagePoint(worldPosition, stageSettings.dimensions, stageView);
          const scale = .58 + element.depth * .006;
          const widthFactor = element.type === 'back-wall' ? 5 : element.type === 'riser' ? 3.2 : element.type === 'person' ? 1.8 : 2.2;
          const selected = interactive && selectedStageElementId === element.id;
          const target = stageTargets.find((item) => item.id === `target-element-${element.id}`);
          const targetable = interactive && ['aim', 'measure', 'target'].includes(stageMode);
          return <button className={`stage-object stage-object-${element.type} ${selected ? 'selected' : ''} ${targetable ? 'targetable' : ''}`} aria-label={`${stageMode === 'aim' ? 'Aim at' : stageMode === 'move' ? 'Drag' : 'Select'} ${element.label} stage element`} key={element.id} style={{ left: `${projected.x / 10}%`, top: `${projected.y / 5.6}%`, zIndex: Math.round(20 + element.depth / 12), color: element.color, transform: `translate(-50%, -50%) scale(${scale})`, width: `${element.size * widthFactor}px` }} onPointerDown={(event) => { if (interactive) beginStageDrag(event, 'element', element.id, worldPosition); }} onPointerMove={(event) => { if (interactive) moveStageDrag(event); }} onPointerUp={(event) => { if (interactive) endStageDrag(event); }} onPointerCancel={(event) => { if (interactive) endStageDrag(event); }} onClick={() => {
            if (!interactive) return;
            if (targetable && target) {
              setSelectedTargetId(target.id);
              if (stageMode === 'aim') void aimAtTarget(target);
              return;
            }
            setSelectedStageElementId(element.id);
          }}><span className="stage-object-shape" style={{ borderColor: element.color, backgroundColor: element.type === 'led-screen' ? element.color : undefined }}>{element.type === 'led-screen' && <StageMediaSurface source={element.mediaSource}/>}</span><b>{element.label}</b></button>;
        })}
        {patch.map((fixture, index) => {
          const geometry = fixtureGeometryState(outputUniverse, fixture, index, patch.length, stageSettings.dimensions);
          const projected = projectStagePoint(geometry.beam.origin, stageSettings.dimensions, stageView);
          return <div className={`stage-light physical-fixture ${stageFixture?.id === fixture.id && interactive ? 'editing' : ''} ${fixture.selected ? 'selected' : ''}`} key={fixture.id} style={{ left: `${projected.x / 10}%`, top: `${projected.y / 5.6}%`, zIndex: 40 }}><button className="stage-unit stage-unit-button" style={{ borderColor: fixture.labelColor ?? '#505b68' }} aria-label={`${stageMode === 'move' ? 'Drag' : 'Select'} ${fixture.name} on stage`} onPointerDown={(event) => { if (interactive) beginStageDrag(event, 'fixture', fixture.id, fixtureTransform(fixture, index, patch.length, stageSettings.dimensions).position); }} onPointerMove={(event) => { if (interactive) moveStageDrag(event); }} onPointerUp={(event) => { if (interactive) endStageDrag(event); }} onPointerCancel={(event) => { if (interactive) endStageDrag(event); }} onClick={(event) => { if (interactive) selectFixtureFromConsole(fixture.id, event.metaKey || event.ctrlKey || event.shiftKey); }} /><span className="stage-light-label" style={{ borderColor: fixture.labelColor ?? '#3a444f', color: fixture.labelColor ?? '#c9d0d8' }}>{fixture.name}{geometry.movementCapable ? ` · ${Math.round(geometry.movement.pan)}°/${Math.round(geometry.movement.tilt)}°` : ''}</span></div>;
        })}
        <div className="stage-coordinate-key">X stage left/right · Y floor/ceiling · Z downstage/upstage · meters internally</div>
      </div>
    );
  }

  function remoteFlashLeaseKey(fixtureIds: readonly string[]) {
    return [...fixtureIds].sort().join('|');
  }

  function clearRemoteFlashLease(fixtureIds: readonly string[]) {
    const key = remoteFlashLeaseKey(fixtureIds);
    const timer = remoteFlashLeaseRef.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    remoteFlashLeaseRef.current.delete(key);
  }

  function armRemoteFlashLease(fixtureIds: readonly string[]) {
    const ids = [...fixtureIds];
    clearRemoteFlashLease(ids);
    const key = remoteFlashLeaseKey(ids);
    const timer = window.setTimeout(() => {
      remoteFlashLeaseRef.current.delete(key);
      void dispatchControl({ type: 'fixture.flash.set', fixtureIds: ids, active: false }, 'surface');
    }, 1600);
    remoteFlashLeaseRef.current.set(key, timer);
  }

  function clearRemoteEffectLease(effectId: string) {
    const timer = remoteEffectLeaseRef.current.get(effectId);
    if (timer !== undefined) window.clearTimeout(timer);
    remoteEffectLeaseRef.current.delete(effectId);
  }

  function armRemoteEffectLease(effectId: EffectId) {
    clearRemoteEffectLease(effectId);
    const timer = window.setTimeout(() => {
      remoteEffectLeaseRef.current.delete(effectId);
      releaseMomentaryEffect(effectId);
    }, 1600);
    remoteEffectLeaseRef.current.set(effectId, timer);
  }

  function clearAllRemoteEffectLeases() {
    for (const timer of remoteEffectLeaseRef.current.values()) window.clearTimeout(timer);
    remoteEffectLeaseRef.current.clear();
  }

  function clearAllRemoteFlashLeases(release = false) {
    for (const [key, timer] of remoteFlashLeaseRef.current.entries()) {
      window.clearTimeout(timer);
      if (release) {
        const fixtureIds = key.split('|').filter(Boolean);
        if (fixtureIds.length) void dispatchControl({ type: 'fixture.flash.set', fixtureIds, active: false }, 'surface');
      }
    }
    remoteFlashLeaseRef.current.clear();
  }

  async function executeRemoteRelayCommand(envelope: RelayCommandEnvelope) {
    const command = envelope.command as Record<string, unknown>;
    const type = typeof command.type === 'string' ? command.type : '';
    try {
      if (type === 'cue.go') {
        const requested = typeof command.cueId === 'string' ? showFile.cues.find((cue) => cue.id === command.cueId) : null;
        if (requested) runCue(requested); else goNextCue();
      } else if (type === 'cue.previous') {
        goPreviousCue();
      } else if (type === 'blackout.set') {
        await setBlackoutState(Boolean(command.active), 'surface');
      } else if (type === 'master.set' && typeof command.value === 'number') {
        applyGlobalMaster(command.value * 100, 'surface');
      } else if (type === 'effect.start' && typeof command.effectId === 'string') {
        const effect = EFFECT_PRESETS.find((item) => item.id === command.effectId);
        if (!effect) throw new Error('Unknown effect.');
        startEffect(effect.id);
      } else if (type === 'effect.press' && typeof command.effectId === 'string') {
        const effect = EFFECT_PRESETS.find((item) => item.id === command.effectId && item.momentary);
        if (!effect) throw new Error('That effect is not a HOLD control.');
        startMomentaryEffect(effect.id);
        armRemoteEffectLease(effect.id);
      } else if (type === 'effect.release' && typeof command.effectId === 'string') {
        clearRemoteEffectLease(command.effectId);
        releaseMomentaryEffect(command.effectId as EffectId);
      } else if (type === 'effect.stop') {
        clearAllRemoteEffectLeases();
        stopEffect();
      } else if (type === 'look.apply' && typeof command.lookId === 'string') {
        const look = [...STARTER_LOOKS, ...savedLooks].find((item) => item.id === command.lookId);
        if (!look) throw new Error('That look is not available in the active show.');
        runLook(look);
      } else if (type === 'fx.tempo.set' && typeof command.value === 'number') {
        setMasterTempo(command.value);
      } else if (type === 'fx.depth.set' && typeof command.value === 'number') {
        const depth = Math.max(0, Math.min(100, Math.round(command.value * 100)));
        setEffectDepth(depth);
        effectDepthRef.current = depth;
      } else if (type === 'recorder.start') {
        startShowRecording();
      } else if (type === 'recorder.stop') {
        stopShowRecording(true);
      } else if (type === 'recorder.play' && typeof command.recordingId === 'string') {
        const recording = showFile.recordings?.find((item) => item.id === command.recordingId);
        if (!recording) throw new Error('That recording is not available.');
        playShowRecording(recording);
      } else if (type === 'recorder.stopPlayback') {
        stopRecordedShowPlayback();
      } else if (type === 'sync.transport' && typeof command.action === 'string') {
        if (command.action === 'stop') {
          externalTransportRunningRef.current = false;
          setExternalTransportRunning(false);
          if (recordingPlaybackExternalRef.current) stopRecordedShowPlayback(false);
        } else if (externalTrackRecording) {
          externalTransportRunningRef.current = true;
          setExternalTransportRunning(true);
          playShowRecording(externalTrackRecording, { external: true, positionMs: externalSongPositionMsRef.current });
        } else {
          throw new Error('No recorded take is assigned to External Sync.');
        }
      } else if (type === 'group.master.set' && typeof command.groupName === 'string' && typeof command.value === 'number') {
        const group = fixtureGroups.find((item) => item.name === command.groupName);
        if (!group) throw new Error('That fixture group is not available.');
        applyGroupMaster(group, command.value * 100);
      } else if (type === 'fixture.flash.set') {
        const fixtureIds = Array.isArray(command.fixtureIds) ? command.fixtureIds.filter((id): id is string => typeof id === 'string') : [];
        if (!fixtureIds.length || typeof command.active !== 'boolean') throw new Error('Invalid fixture flash command.');
        await dispatchControl({ type: 'fixture.flash.set', fixtureIds, active: command.active }, 'surface');
        if (command.active) armRemoteFlashLease(fixtureIds);
        else clearRemoteFlashLease(fixtureIds);
      } else if (['fixture.select', 'fixture.attribute', 'fixture.color', 'fixture.position', 'fixture.target', 'group.color'].includes(type)) {
        await dispatchControl(command as ControlCommand, 'surface');
      } else {
        throw new Error(`Unsupported remote command: ${type || 'unknown'}`);
      }
      await remoteRelayRef.current?.sendCommandResult(envelope.id, true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await remoteRelayRef.current?.sendCommandResult(envelope.id, false, detail);
      setMessage(`Remote command rejected: ${detail}`);
    }
  }

  function remoteStateSnapshot() {
    const bpm = masterTempoBpm;
    return {
      protocolVersion: 2,
      appName: 'LumaRig',
      appVersion,
      buildChannel: 'operator-v3',
      revision: runtimeRef.current?.snapshot.revision ?? 0,
      showName: showFile.name,
      stage: {
        view: stageView,
        mode: stageMode,
        objectCount: stageElements.length,
        selectedObjectId: selectedStageElementId,
        dimensions: { ...stageSettings.dimensions },
        elements: stageElements.map((element) => ({
          id: element.id,
          type: element.type,
          label: element.label,
          color: element.color,
          position: { ...stageElementPosition(element, stageSettings.dimensions) },
          dimensions: element.dimensions ? { ...element.dimensions } : undefined
        }))
      },
      currentCue: activeCue ? { id: activeCue.id, number: activeCue.number, name: activeCue.name } : null,
      nextCue: nextCue ? { id: nextCue.id, number: nextCue.number, name: nextCue.name } : null,
      master: globalMaster / 100,
      blackout: dmxStatus.blackout,
      bpm,
      fxDepth: effectDepth / 100,
      tempoSource: tempoSource === 'midi' ? 'MIDI Clock' : 'Internal',
      outputHealthy: !dmxStatus.last_error,
      dmxConnected: dmxStatus.connected,
      midiConnected: midiStatus.connected,
      sync: { transport: externalTransportRunning ? 'playing' : 'stopped', clockHealthy: midiClockSeen, positionMs: externalSongPositionMs },
      recorder: { active: showRecordingActive, elapsedMs: showRecordingElapsedMs },
      activeEffectIds: activeEffect ? [activeEffect] : [],
      selectedFixtureIds: patch.filter((fixture) => fixture.selected).map((fixture) => fixture.id),
      fixtures: patch.map((fixture, index) => {
        const mode = findMode(fixture);
        const baseValues = fixtureValues(universe, fixture);
        const outputValues = fixtureValues(outputUniverse, fixture);
        const geometry = fixtureGeometryState(outputUniverse, fixture, index, patch.length, stageSettings.dimensions);
        return {
          id: fixture.id,
          name: fixture.name,
          group: fixture.group,
          labelColor: fixture.labelColor ?? '#55f29a',
          intensity: baseValues.dimmer / 255,
          outputIntensity: outputValues.dimmer / 255,
          color: rgbToHex(outputValues.red, outputValues.green, outputValues.blue),
          attributes: Object.fromEntries(
            [...new Set(mode?.channels.map((channel) => channel.parameter).filter((parameter): parameter is FixtureParameter => Boolean(parameter)) ?? [])]
              .map((parameter) => [parameter, readFixtureParameter(universe, fixture, parameter) / 255])
          ),
          capabilities: [...new Set(mode?.channels.map((channel) => channel.parameter).filter((parameter): parameter is FixtureParameter => Boolean(parameter)) ?? [])],
          stagePosition: { ...geometry.beam.origin },
          beamDirection: { ...geometry.beam.direction },
          beamAngleDegrees: geometry.beam.angleDegrees,
          panDegrees: geometry.movement.pan,
          tiltDegrees: geometry.movement.tilt,
          movementCapable: geometry.movementCapable
        };
      }),
      groups: fixtureGroups.map((group) => ({ id: group.id, name: group.name, labelColor: group.labelColor, fixtureIds: [...group.fixtureOrder], master: (groupMasters[group.id] ?? group.masterDefault) / 100 })),
      looks: [...STARTER_LOOKS, ...savedLooks].map((look) => ({ id: look.id, name: look.name, color: lookSwatch(look.values) })),
      effects: EFFECT_PRESETS.map((effect) => ({ id: effect.id, name: effect.name, momentary: Boolean(effect.momentary), active: activeEffect === effect.id })),
      recordings: (showFile.recordings ?? []).map((recording) => ({ id: recording.id, name: recording.name, durationMs: recording.durationMs }))
    };
  }

  remoteCommandHandlerRef.current = (envelope) => { void executeRemoteRelayCommand(envelope); };
  remoteSnapshotHandlerRef.current = () => { void remoteRelayRef.current?.sendSnapshot(remoteStateSnapshot(), runtimeRef.current?.snapshot.revision); };

  useEffect(() => {
    if (remoteRelayStatus !== 'connected' || remotePublishTimerRef.current !== null) return;
    remotePublishTimerRef.current = window.setTimeout(() => {
      remotePublishTimerRef.current = null;
      remoteSnapshotHandlerRef.current?.();
    }, 120);
  }, [remoteRelayStatus, showFile, activeCueId, globalMaster, dmxStatus, effectBpm, effectDepth, tempoSource, midiBpm, midiStatus, midiClockSeen, externalTransportRunning, externalSongPositionMs, showRecordingActive, showRecordingElapsedMs, activeEffect, patch, outputUniverse, fixtureGroups, groupMasters, savedLooks, stageView, stageMode, stageElements, selectedStageElementId, stageSettings, appVersion]);

  const liveLumaVizPreview = directStatus.clients > 0 && lumaVizPreview && Date.now() - lumaVizPreview.timestamp < 1600
    ? lumaVizPreview
    : null;

  const consoleColorPresets = COLOR_PRESETS.map((preset) => ({
    name: preset.name,
    color: rgbToHex(preset.rgb[0], preset.rgb[1], preset.rgb[2])
  }));
  const allLooks = [...STARTER_LOOKS, ...savedLooks];
  const selectedFixtureIdSet = new Set(selectedFixtureTargets.map((fixture) => fixture.id));
  const selectedGroupIsExactSelection = Boolean(
    selectedGroupFixtures.length
    && selectedGroupFixtures.length === selectedFixtureTargets.length
    && selectedGroupFixtures.every((fixture) => selectedFixtureIdSet.has(fixture.id))
  );
  const programEffectFixtures = selectedGroupIsExactSelection
    ? selectedGroupFixtures
    : selectedFixtureTargets;
  const programEffectName = selectedFixtureTargets.length === 1
    ? selectedFixtureTargets[0].name
    : selectedFixtureTargets.length > 1
      ? `${selectedFixtureTargets.length} selected fixtures`
      : '';
  const liveEffectLabel = activeCustomEffectId
    ? customEffects.find((effect) => effect.id === activeCustomEffectId)?.name ?? 'Custom FX'
    : activeEffect
      ? EFFECT_PRESETS.find((effect) => effect.id === activeEffect)?.name ?? activeEffect
      : '';
  const inspectedFixture = patch.find((fixture) => fixture.selected) ?? stageFixture;
  const selectedCompatibleColors = compatibleColorFixtures(selectedFixtureTargets);

  return (
    <main className={`console-app workspace-${workspace} ${dmxStatus.blackout ? 'blackout-is-active' : ''}`}>
      {(libraryOpening || transitionBusy) && <div className="library-save-guard" role="alert" aria-busy="true">{libraryOpening ? 'Opening saved programming…' : 'Saving Show before switching…'}</div>}
      <header className="console-header">
        <div className="console-brand"><span className="brand-mark">◆</span><div className="brand-product"><b>LUMARIG</b><small>SHOW</small></div><div className="brand-show"><input aria-label="Current show name" value={showFile.name} onChange={(event) => setShowFile((current) => ({ ...current, name: event.target.value }))} /><small>LIVE SHOWFILE · R{sharedShowRevisionRef.current} · v{appVersion}</small></div></div>
        <nav className="console-workspace-tabs" aria-label="Workspace">{(['build', 'create', 'show', 'visualizer', 'live'] as Workspace[]).map((item) => <button key={item} className={workspace === item ? 'active' : ''} onClick={() => setWorkspace(item)}>{item.toUpperCase()}</button>)}</nav>
        <div className="console-header-status">
          <button className="tempo-pill" onClick={tapTempo}><TempoPulse bpm={masterTempoBpm} audioRef={showTrackAudioRef} running={Boolean(activeEffect || activeCustomEffectId || showRecordingActive || playingRecordingId || externalTransportRunning || timelinePlaying)} /><strong>{masterTempoBpm} BPM</strong><small>{tempoSource === 'midi' ? 'MIDI CLOCK' : 'TAP'}</small></button>
          <button aria-label="Connections" title="Connections and DMX status" className={`connection-pill ${dmxStatus.connected ? 'online' : ''}`} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i /><span><strong>DMX</strong><small>{dmxStatus.connected ? 'CONNECTED' : 'VIRTUAL'}</small></span></button>
          <button className={`console-blackout ${dmxStatus.blackout ? 'active' : ''}`} onClick={toggleBlackout}>{dmxStatus.blackout ? 'RELEASE BLACKOUT' : 'BLACKOUT'}</button>
        </div>
      </header>

      <audio ref={showTrackAudioRef} src={showTrackUrl || undefined} preload="metadata" onLoadedMetadata={(event) => {
        const duration=Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration*1000 : 0;
        setShowTrackDurationMs(duration);
        const bounds=mediaWindow(editingTimeline,duration);
        const source=mediaPosition(timelinePositionRef.current*60000/masterTempoBpm*editingTimeline.beatsPerBar,editingTimeline.audioOffsetBars*60000/masterTempoBpm*editingTimeline.beatsPerBar,bounds);
        const boundary=timelinePositionRef.current<editingTimeline.audioOffsetBars ? bounds.startMs : bounds.endMs;
        event.currentTarget.currentTime=(source ?? (Number.isFinite(boundary) ? boundary : bounds.startMs))/1000;
      }} onTimeUpdate={(event) => setShowTrackPositionMs(event.currentTarget.currentTime * 1000)} onEnded={handleShowTrackEnded} />
      {dmxStatus.blackout && <div className="blackout-banner"><strong>BLACKOUT ACTIVE</strong><span>Programmed fixture values are preserved.</span><button onClick={toggleBlackout}>Release Blackout</button></div>}
      {showRecordingActive && <section className="console-recording-bar"><span className="recording-pulse" /><div><strong>{timelineRecordingOrigin.current ? timelineRecordingOrigin.current.overdub?'TIMELINE OVERDUB':'TIMELINE RECORD' : 'RECORDING SHOW'}</strong><small>{showTrackName || 'Lighting only'} · {formatShowTime(showRecordingElapsedMs)}</small></div><button onClick={recordingPaused?playRecorderTransport:pauseRecorderTransport}>{recordingPaused?'Resume recording':'Pause recording'}</button><button onClick={() => stopShowRecording(true)}>Stop + save</button><button onClick={() => stopShowRecording(false)}>Cancel</button></section>}
      {activeRecordingPlayback && <section className="console-recording-bar playback"><span className="playback-pulse" /><div><strong>{recordingPlaybackExternalRef.current ? 'EXTERNAL SYNC' : 'RECORDED SHOW'}</strong><small>{activeRecordingPlayback.name} · {formatShowTime(showTrackPositionMs)} / {formatShowTime(activeRecordingPlayback.durationMs)}</small></div><button onClick={() => stopRecordedShowPlayback()}>Stop</button></section>}

      {workspace === 'build' && <section className="console-workspace setup-console">
        <nav className="workspace-subtabs setup-subtabs">{([
          ['fixtures', 'Fixtures'], ['groups', 'Groups'], ['stage', 'Stage'], ['settings', 'Connections']
        ] as Array<[SetupView, string]>).map(([id, label]) => <button key={id} className={setupView === id ? 'active' : ''} onClick={() => setSetupView(id)}>{label}</button>)}</nav>
        <FixtureBrowser
          patch={patch}
          groups={fixtureGroups}
          search={fixtureSearch}
          onSearchChange={setFixtureSearch}
          onSelectAll={selectAllFixtures}
          onClearSelection={clearFixtureSelection}
          onSelectFixture={selectFixtureFromConsole}
          onSelectGroup={selectFixtureGroup}
          selectedGroupId={selectedGroupId}
          assignmentIds={setupView === 'groups' ? assignmentIds : undefined}
          onToggleAssignment={setupView === 'groups' ? (fixtureId) => setAssignmentIds((current) => current.includes(fixtureId) ? current.filter((id) => id !== fixtureId) : [...current, fixtureId]) : undefined}
          scenery={stageElements.map((element) => ({ id: element.id, label: element.label, type: element.type, color: element.color }))}
          selectedSceneryId={selectedStageElementId}
          onSelectScenery={(id) => { setSelectedStageElementId(id); clearFixtureSelection(); setSetupView('stage'); setStageMode('select'); }}
        />

        <div className={`setup-center console-center ${setupView === 'stage' ? 'stage-workspace-center' : ''}`}>
          {setupView === 'stage' && <>
            <div className="stage-console-toolbar">
              <div role="toolbar" aria-label="Stage Designer mode">{STAGE_DESIGNER_MODES.map((mode) => <button key={mode.id} className={stageMode === mode.id ? 'active' : ''} onClick={() => { setStageMode(mode.id); if (mode.id !== 'select') setProgramStageView('plot'); }}>{mode.label}</button>)}</div>
              <div className="stage-surface-toggle" role="group" aria-label="Stage view surface"><button className={programStageView === 'visualizer' ? 'active' : ''} onClick={() => setProgramStageView('visualizer')}>3D VISUALIZER</button><button className={programStageView === 'plot' ? 'active' : ''} onClick={() => setProgramStageView('plot')}>PLOT EDITOR</button><button onClick={() => void openStageWindow()}>POP OUT</button></div>
              <span>{stageSettings.unit === 'feet' ? 'FEET' : 'METERS'} · {stageSettings.dimensions.width.toFixed(1)} × {stageSettings.dimensions.depth.toFixed(1)} m</span>
            </div>
            <div className={`dominant-stage ${programStageView === 'visualizer' ? 'visualizer-mode' : 'plot-mode'}`}>
              {programStageView === 'visualizer'
                ? <Visualizer3D snapshot={stageSnapshot} className="stage-designer-visualizer" selectedElementId={selectedStageElementId} onSelectElement={(id) => { setSelectedStageElementId(id); clearFixtureSelection(); }} />
                : renderStagePreview(true)}
            </div>
            <div className="stage-bottom-tools">
              <section><header><strong>TARGETS &amp; AIM</strong><span>{selectedMovingFixtures.length} mover{selectedMovingFixtures.length === 1 ? '' : 's'} selected</span></header><div className="inline-control-grid"><select value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>{stageTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select><select value={aimArrangement} onChange={(event) => setAimArrangement(event.target.value as TargetArrangement)}><option value="converge">Converge</option><option value="fan-horizontal">Horizontal fan</option><option value="fan-vertical">Vertical fan</option><option value="mirror">Mirror</option><option value="cross">Cross</option></select><select value={aimOrderMode} onChange={(event) => setAimOrderMode(event.target.value as FixtureOrderMode)}><option value="forward">Forward</option><option value="reverse">Reverse</option><option value="center-out">Center Out</option><option value="outside-in">Outside In</option><option value="mirror-pairs">Mirror Pairs</option><option value="odd-even">Odd → Even</option><option value="even-odd">Even → Odd</option></select><label className="inline-range"><span>Spread {aimSpreadMeters.toFixed(1)}m</span><input type="range" min=".1" max="20" step=".1" value={aimSpreadMeters} onChange={(event) => setAimSpreadMeters(Number(event.target.value))}/></label><button className="console-primary" disabled={!selectedTarget || !selectedMovingFixtures.length} onClick={() => selectedTarget && void aimAtTarget(selectedTarget)}>Aim selected</button></div></section>
              <section><header><strong>POSITION PALETTES</strong><span>{showFile.positionPalettes?.length ?? 0} saved</span></header><div className="palette-chip-row">{showFile.positionPalettes?.map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}><span>{palette.kind}</span>{palette.name}</button>)}<button className="add-palette-chip" onClick={savePositionPalette}>＋ Save current</button></div></section>
              <section className="stage-preset-section"><header><strong>STAGE PRESETS</strong><span>{activeStagePresetId ? 'ACTIVE' : 'CUSTOM'}</span></header><div className="stage-preset-grid">{STAGE_PRESETS.map((preset) => <button key={preset.id} className={activeStagePresetId === preset.id ? 'active' : ''} onClick={() => loadStagePreset(preset.id)}><strong>{preset.name}</strong><small>{preset.description}</small></button>)}</div><small className="stage-preset-note">Loading a preset replaces the current stage scene. Church and Apostolic Day never stack into one layout.</small></section>
              <section className="stage-warehouse-section"><header><strong>WAREHOUSE</strong><span>{STAGE_WAREHOUSE.length} objects</span></header><div className="stage-warehouse-groups">{(['Stage','Screens','Scenic','Audio','Band','People'] as const).map((category) => <div className="stage-warehouse-group" key={category}><span>{category}</span><div>{STAGE_WAREHOUSE.filter((item) => item.category === category).map((item) => <button key={item.id} onClick={() => addWarehouseStageElement(item.id)}>＋ {item.name}</button>)}</div></div>)}</div></section>
            </div>
          </>}

          {setupView === 'fixtures' && <div className="setup-scroll-area">
            <section className="fixture-selection-toolbar"><div><strong>FIXTURE SELECTION</strong><span>{patch.filter((fixture) => fixture.selected).length} of {patch.length} selected</span></div><div><button onClick={selectAllFixtures}>Select All</button><button onClick={clearFixtureSelection}>Clear</button><button className="danger-button" disabled={!patch.some((fixture) => fixture.selected) || patch.filter((fixture) => fixture.selected).length >= patch.length} onClick={deleteSelectedFixtures}>Delete Selected</button></div></section>
            <section className="console-panel batch-fixture-panel"><header><div><span>ADD FIXTURES</span><h2>Patch a batch</h2></div><b>{FIXTURE_LIBRARY.length} profiles</b></header><div className="batch-fixture-grid"><label><span>Fixture Profile</span><select value={newProfileId} onChange={(event) => { const profile = findProfile(event.target.value) ?? FIXTURE_LIBRARY[0]; setNewProfileId(profile.id); setNewModeId(profile.modes[0].id); setProfileAcknowledged(false); }}>{FIXTURE_LIBRARY.map((profile) => <option key={profile.id} value={profile.id}>{profile.verified ? '✓' : '△'} {profile.manufacturer} {profile.model}</option>)}</select></label><label><span>Mode</span><select value={newModeId} onChange={(event) => setNewModeId(event.target.value)}>{newProfile.modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name} · {mode.channelCount}ch</option>)}</select></label><label><span>Base Name</span><input value={newFixtureName} placeholder={newProfile.model} onChange={(event) => setNewFixtureName(event.target.value)} /></label><label><span>Quantity</span><input type="number" min="1" max="64" value={newFixtureQuantity} onChange={(event) => setNewFixtureQuantity(Number(event.target.value))} /></label><label><span>Starting Address</span><input type="number" min="1" max="512" value={newFixtureAddress} onChange={(event) => setNewFixtureAddress(Number(event.target.value))} /></label><label><span>Group</span><select value={newFixtureGroup} onChange={(event) => setNewFixtureGroup(event.target.value)}><option value="">Unassigned</option>{fixtureGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select></label><button className="console-primary add-batch" onClick={addFixture}>Add {Math.max(1, newFixtureQuantity)} Fixture{newFixtureQuantity === 1 ? '' : 's'}</button></div>{!newProfile.verified && <label className="profile-confirm"><input type="checkbox" checked={profileAcknowledged} onChange={(event) => setProfileAcknowledged(event.target.checked)} /> I checked the fixture manual and exact mode.</label>}</section>
            <section className="compact-patch-list">{patch.map((fixture) => <FixturePatchEditor key={fixture.id} fixture={fixture} onSave={savePatchedFixture} onRemove={() => removeFixture(fixture)} onToggleSelected={() => selectFixtureFromConsole(fixture.id, true)} onToggleCollapsed={() => setPatch((current) => current.map((item) => item.id === fixture.id ? { ...item, collapsed: !item.collapsed } : item))} />)}</section>
          </div>}

          {setupView === 'groups' && <div className="group-assignment-view"><header><div><span>GROUP ASSIGNMENT</span><h2>Assign Fixtures to Groups</h2><p>Check fixtures on the left, then assign them to a real persisted show group.</p></div><button onClick={createFixtureGroup}>＋ Create Group</button></header><div className="group-card-grid">{fixtureGroups.map((group) => { const members = fixturesInGroup(patch, group); return <article className={`assignment-group-card ${selectedGroupId === group.id ? 'selected' : ''}`} key={group.id} style={{ '--group-color': group.labelColor } as import('react').CSSProperties}><button className="assignment-group-title" onClick={() => setSelectedGroupId(group.id)}><i style={{ background: group.labelColor }} /><span><strong>{group.name}</strong><small>{members.length} fixture{members.length === 1 ? '' : 's'}</small></span><b>•••</b></button><div>{members.map((fixture) => <span className="assigned-fixture" key={fixture.id}><i style={{ background: fixture.labelColor ?? group.labelColor }} /><span><strong>{fixture.name}</strong><small>{addressLabel(fixture.address)}</small></span><button aria-label={`Unassign ${fixture.name}`} onClick={() => unassignFixture(fixture.id)}>×</button></span>)}</div><button className="add-to-group" onClick={() => { setSelectedGroupId(group.id); assignCheckedFixtures(group); }}>＋ Add checked fixtures</button></article>; })}<button className="create-group-card" onClick={createFixtureGroup}><span>＋</span><strong>Create New Group</strong><small>Add an empty group to this show.</small></button></div></div>}

          {setupView === 'settings' && <div className="setup-scroll-area settings-console">
            <section className="console-panel connection-console"><header><div><span>DMX OUTPUT</span><h2>Anyma uDMX</h2></div><b className={dmxStatus.connected ? 'healthy' : ''}>{dmxStatus.connected ? 'Connected' : 'Virtual only'}</b></header><label><span>USB Interface</span><select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)} disabled={dmxStatus.connected}><option value="">Select uDMX</option>{devices.map((device) => <option key={device.device_key} value={device.device_key}>{deviceLabel(device)}</option>)}</select></label><div className="settings-actions"><button onClick={scanDevices}>Scan USB</button>{dmxStatus.connected ? <button onClick={disconnectDmx}>Disconnect + zero</button> : <button className="console-primary" disabled={!selectedInfo?.likely_udmx || busy} onClick={connectDmx}>Connect uDMX</button>}<button onClick={zeroAll}>Zero all</button></div></section>
            <section className="console-panel connection-console"><header><div><span>GENERAL MIDI</span><h2>Controller / Network Session</h2></div><b className={midiStatus.connected ? 'healthy' : ''}>{midiStatus.connected ? 'Listening' : 'Offline'}</b></header><label><span>MIDI Input</span><select value={selectedMidiInput} disabled={midiStatus.connected} onChange={(event) => setSelectedMidiInput(event.target.value)}><option value="">Select input</option>{midiInputs.map((input) => <option key={input.id} value={input.id}>{input.name}</option>)}</select></label><div className="settings-actions"><button onClick={scanMidi}>Scan MIDI</button>{midiStatus.connected ? <button onClick={disconnectMidi}>Disconnect</button> : <button className="console-primary" disabled={!selectedMidiInput} onClick={connectMidi}>Connect MIDI</button>}</div><div className="midi-event-monitor"><i className={midiStatus.last_event ? 'active' : ''} /><span><strong>{midiStatus.last_event || 'Waiting for MIDI'}</strong><small>{midiStatus.messages_received} messages · {midiClockSeen ? 'Clock detected' : 'No clock'}</small></span></div></section>
            <section className="console-panel midi-mapping-console"><header><div><span>MIDI ASSIGNER</span><h2>Map controls</h2></div><b>{midiMappings.length} mappings</b></header><div className="midi-add-row"><select value={newMidiTarget} onChange={(event) => setNewMidiTarget(event.target.value)}>{midiControlGroups.map(([group, controls]) => <optgroup key={group} label={group}>{controls.map((control) => <option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}</select><button className="console-primary" onClick={() => beginMidiAssignment()}>Add + Learn</button></div><div className="midi-map-list">{midiMappings.map((mapping) => { const control = midiControls.find((item) => item.id === mapping.target); const learning = midiLearnMappingId === mapping.id; return <div className={`midi-map-row ${learning ? 'is-learning' : ''}`} key={mapping.id}><strong>{control?.label ?? 'Unavailable'}</strong><span>{learning ? 'Move or press a control…' : midiBindingLabel(mapping)}</span><button onClick={() => setMidiLearnMappingId(learning ? null : mapping.id)}>{learning ? 'Cancel' : 'Learn'}</button><button onClick={() => removeMidiAssignment(mapping.id)}>Remove</button></div>; })}</div></section>
            <section className="console-panel connection-console remote-relay-console">
              <header><div><span>LUMARIG CLOUD · ACCOUNT</span><h2>Cloud + Remote</h2></div><b className={cloudAccount ? 'healthy' : ''}>{cloudAccount ? 'SIGNED IN' : 'SIGNED OUT'}</b></header>
              {!cloudAccount ? <>
                <p>Sign in once on this computer. LumaRig stores the Supabase session, syncs your online Song/Show library, and uses the same account for secure controller pairing.</p>
                <div className="inspector-pair"><label><span>Email</span><input type="email" autoComplete="email" value={cloudLoginEmail} onChange={(event)=>setCloudLoginEmail(event.target.value)} /></label><label><span>Password · not stored</span><input type="password" autoComplete="current-password" value={cloudLoginPassword} onChange={(event)=>setCloudLoginPassword(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter')void signInLumaCloud();}} /></label></div>
                {cloudError && <p className="relay-error">{cloudError}</p>}
                <div className="settings-actions"><button className="console-primary" disabled={cloudAccountBusy || !cloudLoginEmail.trim() || !cloudLoginPassword} onClick={()=>void signInLumaCloud()}>{cloudAccountBusy ? 'Signing in…' : 'Sign in to LumaRig Cloud'}</button><button onClick={()=>window.open(REMOTE_APP_URL + '/account','lumarig-cloud','noopener,noreferrer')}>Open Online Library ↗</button></div>
              </> : <>
                <div className="cloud-account-card"><div><small>ACCOUNT</small><strong>{cloudAccount.email}</strong><span>{cloudSongDocuments.length} cloud songs · {cloudShows.length} cloud shows · {cloudRecordingLabels.length} take labels</span><code title={desktopDeviceId()}>DEVICE · {desktopDeviceId()}</code></div><div><button onClick={()=>window.open(REMOTE_APP_URL + '/account','lumarig-cloud','noopener,noreferrer')}>Online Library ↗</button><button className="danger-outline" disabled={cloudAccountBusy} onClick={()=>void signOutLumaCloud()}>Sign Out</button></div></div>
                {cloudError && <p className="relay-error">{cloudError}</p>}
                <div className="settings-actions"><button onClick={()=>void refreshCloudAccountLibrary()}>Sync Library Now</button>{remoteRelayStatus === 'connected' ? <button onClick={disconnectRemoteRelay}>Disconnect Remote</button> : <button className="console-primary" onClick={()=>void connectRemoteRelay()}>Connect Remote</button>}</div>
                <details className="cloud-advanced-connection"><summary>Advanced Cloud Connection</summary><label><span>Supabase Project URL</span><input value={remoteRelayConfig.url} placeholder="https://project.supabase.co" onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, url: event.target.value }))} /></label><label><span>Publishable Key</span><input type="password" value={remoteRelayConfig.publishableKey} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, publishableKey: event.target.value }))} /></label><label><span>Private Relay Room</span><div className="relay-room-row"><input value={remoteRelayConfig.roomCode} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, roomCode: event.target.value }))} /><button onClick={() => setRemoteRelayConfig((current) => ({ ...current, roomCode: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '') }))}>Regenerate</button></div></label></details>
                {remoteRelayError && <p className="relay-error">{remoteRelayError}</p>}
                {remoteRelayStatus === 'connected' && <div className="controller-pairing-panel">
                  <header><div><small>CONTROLLER ACCESS</small><strong>Pair Controller</strong><span>Your LumaRig account is already authenticated. The QR and six-digit code only grant this iPad access to the private control relay.</span></div><button className="console-primary" disabled={pairingBusy} onClick={()=>void startControllerPairing()}>{pairingBusy ? 'Creating…' : pairingSession ? 'New Pairing Code' : 'Pair Controller'}</button></header>
                  {pairingSession && pairingSecondsRemaining > 0 && <div className="pairing-session-card"><div className="pairing-qr"><QRCodeSVG value={pairingSession.pairingUrl} size={196} level="M" bgColor="#ffffff" fgColor="#090b10" /></div><div className="pairing-code-display"><small>MANUAL CODE</small><strong>{pairingSession.code}</strong><span>Expires in {Math.floor(pairingSecondsRemaining/60)}:{String(pairingSecondsRemaining%60).padStart(2,'0')}</span><button onClick={()=>void navigator.clipboard?.writeText(pairingSession.pairingUrl)}>Copy Pair Link</button></div></div>}
                  {pairingSession && pairingSecondsRemaining === 0 && <div className="pairing-expired"><strong>Pairing code expired</strong><span>Generate a new code. Existing paired devices stay connected.</span></div>}
                  <div className="paired-device-list"><div className="paired-device-heading"><span>PAIRED CONTROLLERS</span><button onClick={()=>void refreshPairedControllerList()}>Refresh</button></div>{pairedControllers.length ? pairedControllers.map((device)=><article key={device.id}><span><strong>{device.deviceName}</strong><small>{device.platform}{device.appVersion ? ' · v'+device.appVersion : ''} · last seen {new Date(device.lastSeenAt).toLocaleString()}</small><code>{device.clientDeviceId || device.deviceUserId}</code></span><button className="danger-button" onClick={()=>void revokeControllerPairing(device.id)}>Revoke</button></article>) : <p>No paired controllers yet.</p>}{pairedControllersError && <p className="relay-error">{pairedControllersError}</p>}</div>
                </div>}
              </>}
            </section>
            <section className="console-panel connection-console studio-bridge-console"><header><div><span>STUDIO LINK · SHOW CONTROL</span><h2>LumaStudio</h2></div><b className={studioBridgeStatus.listening && !studioBridgeStatus.lastError ? 'healthy' : ''}>{studioBridgeStatus.lastError ? 'Error' : studioBridgeStatus.connectedClients > 0 ? 'Connected' : studioBridgeStatus.listening ? 'Ready' : 'Starting'}</b></header><p>Semantic show-control bridge for Studio transport, cue recall, recorded lighting, FX and blackout. Studio never sends raw DMX.</p><div className="artnet-health-grid"><div><span>ENDPOINT</span><strong>ws://127.0.0.1:{studioBridgeStatus.port}/studio</strong></div><div><span>CLIENTS</span><strong>{studioBridgeStatus.connectedClients}</strong></div><div><span>PROTOCOL</span><strong>studio-bridge-v1</strong></div><div><span>AUTHORITY</span><strong>LumaRig</strong></div></div>{studioBridgeStatus.lastError && <p className="artnet-error">Studio Bridge: {studioBridgeStatus.lastError}</p>}<small>The bridge starts automatically. If Studio closes, lighting continues locally in LumaRig.</small></section>
            <details className="console-panel legacy-visualizer-console"><summary>Legacy External Visualizer Bridges</summary><section className="connection-console visualizer-direct-console"><header><div><span>LEGACY LINK · SEMANTIC WEBSOCKET</span><h2>LumaRig Direct</h2></div><b className={directStatus.listening && !directStatus.lastError ? 'healthy' : ''}>{directStatus.clients > 0 ? 'Connected' : directStatus.listening ? 'Ready' : 'Error'}</b></header><p>Native semantic link for LumaViz. Sends resolved fixture identity, intensity, color, movement, beam and strobe without making LumaViz decode DMX.</p><div className="artnet-health-grid"><div><span>ENDPOINT</span><strong>ws://127.0.0.1:{directStatus.port}/lumaviz</strong></div><div><span>CLIENTS</span><strong>{directStatus.clients}</strong></div><div><span>FRAMES SENT</span><strong>{directStatus.framesSent.toLocaleString()}</strong></div><div><span>PROTOCOL</span><strong>fixture-frame-v1</strong></div></div>{directStatus.lastError && <p className="artnet-error">Direct: {directStatus.lastError}</p>}<small>LumaRig Direct starts automatically. Art-Net remains available below as the standard DMX-over-network fallback.</small></section>
            <section className="console-panel connection-console visualizer-output-console"><header><div><span>VISUALIZER LINK · ART-NET</span><h2>LumaViz Connection</h2></div><b className={settings.visualizerArtNetEnabled && !artNetTelemetry.lastError ? 'healthy' : ''}>{artNetTelemetry.lastError ? 'Error' : settings.visualizerArtNetEnabled ? 'Live' : 'Off'}</b></header><p>LumaRig mirrors the final resolved DMX frame after cues, FX, manual overrides, group masters, and grand master. Physical DMX remains independent if the visualizer closes.</p><div className="artnet-health-grid"><div><span>TRANSPORT</span><strong>Art-Net / UDP 6454</strong></div><div><span>TARGET</span><strong>{settings.visualizerArtNetTarget || '127.0.0.1'}</strong></div><div><span>FRAMES SENT</span><strong>{artNetTelemetry.framesSent.toLocaleString()}</strong></div><div><span>STATUS</span><strong>{artNetTelemetry.lastError ? 'Send error' : settings.visualizerArtNetEnabled ? artNetTelemetry.framesSent > 0 ? 'Streaming' : 'Armed' : 'Stopped'}</strong></div></div>{artNetTelemetry.lastError && <p className="artnet-error">Art-Net: {artNetTelemetry.lastError}</p>}<label className="inspector-toggle"><span>Enable visualizer output</span><input type="checkbox" checked={settings.visualizerArtNetEnabled} onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetEnabled: event.target.checked }))} /></label><label><span>Target IPv4 address</span><input value={settings.visualizerArtNetTarget} placeholder="127.0.0.1" onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetTarget: event.target.value }))} /></label><small>Use 127.0.0.1 when LumaViz is on this computer. For another computer, use that machine's LAN IPv4. 255.255.255.255 broadcasts to the LAN.</small><div className="settings-actions"><button className="console-primary" onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '127.0.0.1', visualizerArtNetEnabled: true }))}>Connect LumaViz · This Computer</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '255.255.255.255', visualizerArtNetEnabled: true }))}>Broadcast LAN</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetEnabled: false }))}>Stop Link</button></div></section></details>
            <section className="console-panel connection-console"><header><div><span>AUDIO REACTIVE · BETA</span><h2>Sound Input</h2></div><b>{audioArmed ? 'Armed' : audioEnabled ? 'Monitoring' : 'Off'}</b></header><div className="audio-meter"><span style={{ width: `${audioLevel * 100}%` }} /></div><label><span>Sensitivity · {settings.audioSensitivity}%</span><input type="range" min="1" max="100" value={settings.audioSensitivity} onChange={(event) => setSettings((current) => ({ ...current, audioSensitivity: Number(event.target.value) }))} /></label>{audioError && <p>{audioError}</p>}<div className="settings-actions">{audioEnabled ? <><button onClick={stopAudioInput}>Stop input</button><button className="console-primary" onClick={() => { audioBaseUniverseRef.current = [...universeRef.current]; setAudioArmed(!audioArmed); }}>{audioArmed ? 'Disarm lights' : 'Arm selected lights'}</button></> : <button className="console-primary" onClick={startAudioInput}>Enable input</button>}</div></section>
            <section className="console-panel software-update-console"><header><div><span>SOFTWARE UPDATE</span><h2>LumaRig</h2></div><b className={updateStatus === 'available' ? 'healthy' : ''}>v{appVersion}</b></header><div className="update-summary"><strong>{updateStatus === 'available' && updateInfo ? `Version ${updateInfo.version} available` : updateStatus === 'checking' ? 'Checking GitHub Releases…' : updateStatus === 'installing' ? 'Installing update…' : updateStatus === 'current' ? 'You are up to date' : updateStatus === 'error' ? 'Update check failed' : 'Automatic update checks enabled'}</strong><small>{updateStatus === 'available' ? 'The signed update is ready. Output will be zeroed and disconnected before the app restarts.' : 'Release builds check the public update feed shortly after launch.'}</small></div>{updateInfo?.notes && <p className="update-notes">{updateInfo.notes}</p>}{updateError && <p className="update-error">{updateError}</p>}<div className="settings-actions"><button disabled={updateStatus === 'checking' || updateStatus === 'installing'} onClick={() => void checkForUpdates(false)}>{updateStatus === 'checking' ? 'Checking…' : 'Check for Updates'}</button>{updateStatus === 'available' && updateInfo && <button className="console-primary" onClick={() => void installAvailableUpdate()}>{`Install v${updateInfo.version}`}</button>}</div></section>
            <section className="console-panel safety-settings"><header><div><span>PERFORMANCE SAFETY</span><h2>Guardrails</h2></div></header><label><span>Grand master limit</span><input type="range" min="10" max="100" value={settings.masterLimit} onChange={(event) => setSettings((current) => ({ ...current, masterLimit: Number(event.target.value) }))} /><b>{settings.masterLimit}%</b></label><label><span>Confirm blackout release</span><input type="checkbox" checked={settings.confirmBlackoutRelease} onChange={(event) => setSettings((current) => ({ ...current, confirmBlackoutRelease: event.target.checked }))} /></label></section>
            <details className="console-panel raw-dmx-console"><summary>Raw DMX Monitor · Channels 1–{VISIBLE_CHANNELS}</summary><div>{Array.from({ length: VISIBLE_CHANNELS }, (_, index) => <label key={index}><span>CH {index + 1}</span><input type="number" min="0" max="255" value={universe[index]} onChange={(event) => setChannel(index + 1, Number(event.target.value))} /></label>)}</div></details>
          </div>}
        </div>

        <aside className="console-inspector setup-inspector">
          {setupView === 'groups' && selectedGroup ? <>
            <header><span>GROUP SETTINGS</span><strong>{selectedGroup.name}</strong><small>{selectedGroupFixtures.length} fixtures</small></header>
            <label><span>Group Name</span><input defaultValue={selectedGroup.name} key={selectedGroup.id} onBlur={(event) => updateFixtureGroup(selectedGroup.id, { name: event.target.value })} /></label>
            <label><span>Label Color</span><input className="inspector-color" type="color" value={selectedGroup.labelColor} onChange={(event) => updateFixtureGroup(selectedGroup.id, { labelColor: event.target.value })} /></label>
            <label><span>Master Brightness Default</span><input type="range" min="0" max="100" value={selectedGroup.masterDefault} onChange={(event) => updateFixtureGroup(selectedGroup.id, { masterDefault: Number(event.target.value) })} /><b>{selectedGroup.masterDefault}%</b></label>
            <label className="inspector-toggle"><span>FX Enabled</span><input type="checkbox" checked={selectedGroup.fxEnabled} onChange={(event) => updateFixtureGroup(selectedGroup.id, { fxEnabled: event.target.checked })} /></label>
            <label><span>Group Notes</span><textarea maxLength={500} value={selectedGroup.notes} onChange={(event) => updateFixtureGroup(selectedGroup.id, { notes: event.target.value })} /></label>
            {selectedGroupGrid && <section className="selection-grid-editor">
              <header><span>SELECTION GRID</span><small>{selectedGroupGrid.rows} × {selectedGroupGrid.columns}</small></header>
              <div className="selection-grid-controls">
                <label><span>Columns</span><input type="number" min="1" max="12" value={selectedGroupGrid.columns} onChange={(event) => updateGroupGridColumns(selectedGroup, Number(event.target.value))}/></label>
                <label><span>Traversal</span><select value={selectedGroupGrid.traversal} onChange={(event) => updateGroupGridTraversal(selectedGroup, event.target.value as SelectionGridTraversal)}><option value="row">Rows</option><option value="column">Columns</option><option value="snake-row">Snake Rows</option><option value="snake-column">Snake Columns</option></select></label>
              </div>
              <p>{groupGridFixtureId ? 'Choose a destination cell. Occupied cells swap positions.' : 'Select a fixture, then select its destination cell.'}</p>
              <div className="selection-grid-cells" style={{ gridTemplateColumns: `repeat(${selectedGroupGrid.columns}, minmax(0, 1fr))` }}>
                {Array.from({ length: selectedGroupGrid.rows * selectedGroupGrid.columns }, (_, index) => {
                  const row = Math.floor(index / selectedGroupGrid.columns);
                  const column = index % selectedGroupGrid.columns;
                  const cell = selectedGroupGrid.cells.find((item) => item.row === row && item.column === column);
                  const fixture = cell ? selectedGroupFixtures.find((item) => item.id === cell.fixtureId) : null;
                  return <button key={`${row}-${column}`} className={cell?.fixtureId === groupGridFixtureId ? 'selected' : ''} onClick={() => handleGroupGridCell(selectedGroup, row, column)}><small>{row + 1}.{column + 1}</small><strong>{fixture?.name ?? 'Empty'}</strong></button>;
                })}
              </div>
            </section>}
            <button className="console-primary" disabled={!assignmentIds.length} onClick={() => assignCheckedFixtures()}>Assign Selected ({assignmentIds.length})</button><button onClick={createFixtureGroup}>＋ Create Group</button><button className="danger-button" onClick={() => deleteFixtureGroup(selectedGroup.id)}>Delete Group</button>
          </> : setupView === 'stage' && selectedStageElement ? <>
            <header><span>STAGE OBJECT</span><strong>{selectedStageElement.label}</strong><small>{selectedStageElement.type}</small></header>
            <label><span>Name</span><input value={selectedStageElement.label} onChange={(event) => updateStageElement(selectedStageElement.id, { label: event.target.value })} /></label>
            <span className="inspector-section-label">POSITION · METERS</span>
            <div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(selectedStagePosition[axis].toFixed(2))} onChange={(event) => updateStageElementPosition(selectedStageElement.id, axis, Number(event.target.value))} /></label>)}</div>
            <span className="inspector-section-label">ROTATION · DEGREES</span>
            <div className="transform-grid">{(['yaw', 'pitch', 'roll'] as const).map((axis) => <label key={axis}><span>{axis}</span><input type="number" step="1" value={Number((selectedStageElement.transform?.rotation[axis] ?? 0).toFixed(1))} onChange={(event) => updateStageElementRotation(selectedStageElement.id, axis, Number(event.target.value))} /></label>)}</div>
            <span className="inspector-section-label">PHYSICAL SIZE · METERS</span>
            <div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" min=".03" step="0.05" value={Number((selectedStageElement.dimensions?.[axis] ?? 1).toFixed(2))} onChange={(event) => updateStageElementDimension(selectedStageElement.id, axis, Number(event.target.value))} /></label>)}</div>
            <label><span>UI Scale</span><input type="range" min="10" max="100" value={selectedStageElement.size} onChange={(event) => updateStageElement(selectedStageElement.id, { size: Number(event.target.value) })} /></label>
            <label><span>Color</span><input className="inspector-color" type="color" value={selectedStageElement.color} onChange={(event) => updateStageElement(selectedStageElement.id, { color: event.target.value })} /></label>
            {selectedStageElement.type === 'led-screen' && <section className="screen-source-inspector">
              <header><span>SCREEN SOURCE</span><strong>Media / Timeline / NDI</strong></header>
              <label><span>Source</span><select value={selectedStageElement.mediaSource?.kind ?? 'none'} onChange={(event)=>setScreenSourceKind(selectedStageElement.id,event.target.value as 'none'|'timeline'|'ndi'|'image'|'color'|'test-pattern')}>
                <option value="none">Object / screen color</option>
                <option value="color">Solid color source</option>
                <option value="test-pattern">Test pattern</option>
                <option value="image">Still image · Media Library</option>
                <option value="ndi">NDI / video input</option>
                <option value="timeline">Timeline video / MP4</option>
              </select></label>
              <label>Import video to Timeline<input aria-label="Import screen video" type="file" accept="video/mp4,.mp4" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importScreenVideo(selectedStageElement.id,file).catch(error=>setMessage(String(error)));}} /></label>
              {selectedStageElement.mediaSource?.kind==='color' && <label><span>Source Color</span><input className="inspector-color" type="color" value={selectedStageElement.mediaSource.color} onChange={event=>updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'color',color:event.target.value}})}/></label>}
              {selectedStageElement.mediaSource?.kind==='test-pattern' && <label><span>Pattern</span><select value={selectedStageElement.mediaSource.pattern} onChange={event=>updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'test-pattern',pattern:event.target.value as 'bars'|'grid'|'checker'}})}><option value="bars">Color bars</option><option value="grid">Alignment grid</option><option value="checker">Checker</option></select></label>}
              {selectedStageElement.mediaSource?.kind==='image' && <>
                <label><span>Image Asset</span><select value={selectedStageElement.mediaSource.mediaId} onChange={event=>{const asset=screenImageAssets.find(item=>item.id===event.target.value);updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'image',mediaId:event.target.value,sourceName:asset?.name??'Still image'}})}}><option value="">Select Media Library image</option>{screenImageAssets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                <label className="file-button">Import Still Image<input aria-label="Import screen still image" type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importScreenImage(selectedStageElement.id,file).catch(error=>setMessage(String(error)));}}/></label>
                <button onClick={()=>void refreshScreenImageAssets().catch(error=>setMessage(String(error)))}>Refresh Media Library Images</button>
              </>}
              {selectedStageElement.mediaSource?.kind === 'ndi' && <>
                <label><span>Input</span><select value={selectedStageElement.mediaSource.deviceId ?? ''} onChange={(event) => {
                  const input = stageVideoInputs.find((item) => item.deviceId === event.target.value);
                  updateStageElement(selectedStageElement.id, { mediaSource: { ...selectedStageElement.mediaSource!, kind: 'ndi', deviceId: event.target.value || undefined, sourceName: input?.label || 'ProPresenter' } });
                }}><option value="">Select NDI / video input</option>{stageVideoInputs.map((input) => <option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label>
                <button onClick={() => void scanStageVideoInputs()}>Scan NDI / Video Inputs</button>
                {stageVideoInputError && <small className="stage-source-error">{stageVideoInputError}</small>}
                {stageVideoInputPermissionBlocked && <button className="video-permission-action" onClick={() => void openVideoInputPrivacySettings()}>Open Camera Privacy Settings</button>}
                <small>Use ProPresenter NDI through NDI Webcam Input or another virtual camera/video-input bridge. LumaRig scans operating-system video inputs here, not raw NDI network sources.</small>
              </>}
              {selectedStageElement.mediaSource && ['ndi','timeline','image'].includes(selectedStageElement.mediaSource.kind) && <>
                <div className="screen-framing-pair">
                  <label><span>Fit</span><select aria-label="Build screen video fit" value={'fit' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.fit ?? 'contain' : 'contain'} onChange={event=>updateScreenFraming(selectedStageElement.id,{fit:event.target.value as 'contain'|'cover'})}><option value="contain">Contain</option><option value="cover">Fill / crop</option></select></label>
                  <label><span>Size · {Math.round((('scale' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.scale : 1) ?? 1)*100)}%</span><input aria-label="Build screen video size" type="range" min="25" max="300" step="1" value={(('scale' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.scale : 1) ?? 1)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{scale:Number(event.target.value)/100})}/></label>
                </div>
                <div className="screen-framing-pair">
                  <label><span>X · {Math.round((('offsetX' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.offsetX : 0) ?? 0)*100)}%</span><input aria-label="Build screen video horizontal position" type="range" min="-100" max="100" step="1" value={(('offsetX' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.offsetX : 0) ?? 0)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{offsetX:Number(event.target.value)/100})}/></label>
                  <label><span>Y · {Math.round((('offsetY' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.offsetY : 0) ?? 0)*100)}%</span><input aria-label="Build screen video vertical position" type="range" min="-100" max="100" step="1" value={(('offsetY' in selectedStageElement.mediaSource ? selectedStageElement.mediaSource.offsetY : 0) ?? 0)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{offsetY:Number(event.target.value)/100})}/></label>
                </div>
                <button onClick={()=>updateScreenFraming(selectedStageElement.id,{fit:'contain',scale:1,offsetX:0,offsetY:0})}>Reset Screen Framing</button>
              </>}
            </section>}
            <button className="danger-button stage-delete-button" onClick={() => removeStageElement(selectedStageElement.id)}>Delete Stage Object</button>
          </> : inspectedFixture ? <>
            <header><span>FIXTURE INSPECTOR</span><strong>{inspectedFixture.name}</strong><small>{findProfile(inspectedFixture.profileId)?.manufacturer} {findProfile(inspectedFixture.profileId)?.model}</small></header>
            <label><span>Name</span><input value={inspectedFixture.name} onChange={(event) => savePatchedFixture({ ...inspectedFixture, name: event.target.value })} /></label>
            <div className="inspector-pair"><label><span>Universe</span><input type="number" min="1" value={inspectedFixture.universe ?? 1} onChange={(event) => savePatchedFixture({ ...inspectedFixture, universe: Number(event.target.value) })} /></label><label><span>Address</span><input type="number" min="1" max="512" value={inspectedFixture.address} onChange={(event) => savePatchedFixture({ ...inspectedFixture, address: Number(event.target.value) })} /></label></div>
            <label><span>Group</span><select value={inspectedFixture.group} onChange={(event) => savePatchedFixture({ ...inspectedFixture, group: event.target.value })}><option value="">Unassigned</option>{fixtureGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select></label>
            <div className="inspector-pair"><label><span>Mounting</span><select value={inspectedFixture.mounting ?? 'hanging'} onChange={(event) => savePatchedFixture({ ...inspectedFixture, mounting: event.target.value as PatchedFixture['mounting'] })}><option value="hanging">Hanging</option><option value="floor">Floor</option><option value="wall">Wall</option><option value="custom">Custom</option></select></label><label><span>Orientation</span><select value={inspectedFixture.orientation ?? 'normal'} onChange={(event) => savePatchedFixture({ ...inspectedFixture, orientation: event.target.value as PatchedFixture['orientation'] })}><option value="normal">Normal</option><option value="inverted">Inverted</option><option value="rotated90">Rotated 90°</option><option value="rotated180">Rotated 180°</option><option value="custom">Custom</option></select></label></div>
            <div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(activeStageTransform.position[axis].toFixed(2))} onChange={(event) => updateStageFixtureTransform('position', axis, Number(event.target.value))} /></label>)}{(['yaw', 'pitch', 'roll'] as const).map((axis) => <label key={axis}><span>{axis}</span><input type="number" step="1" value={Number(activeStageTransform.rotation[axis].toFixed(1))} onChange={(event) => updateStageFixtureTransform('rotation', axis, Number(event.target.value))} /></label>)}</div>
            <div className="calibration-status"><span>CALIBRATION</span><strong>{inspectedFixture.calibration?.status ?? 'uncalibrated'}</strong><small>{Math.round((inspectedFixture.calibration?.confidence ?? 0) * 100)}% confidence</small></div><button onClick={() => setCalibrationOpen((value) => !value)}>{calibrationOpen ? 'Close Calibration' : 'Calibrate Position'}</button>{calibrationOpen && <div className="calibration-mini"><button onClick={homeActiveFixture}>Send Home</button><button onClick={captureCalibrationObservation}>Capture Target</button><button onClick={solveActiveFixtureCalibration}>Solve</button><button onClick={resetActiveFixtureCalibration}>Reset</button></div>}
          </> : <div className="empty-inspector"><strong>No selection</strong><span>Select a fixture or stage object to inspect it.</span></div>}
        </aside>
      </section>}

      {workspace === 'create' && <ResizableWorkspace className={`console-workspace program-console create-console-v3 ${programMode === 'fx' ? 'create-fx-view' : ''}`}>
        <FixtureBrowser patch={patch} groups={fixtureGroups} search={fixtureSearch} onSearchChange={setFixtureSearch} onSelectAll={selectAllFixtures} onClearSelection={clearFixtureSelection} onSelectFixture={selectFixtureFromConsole} onSelectGroup={selectFixtureGroup} selectedGroupId={selectedGroupId} />
        <div className="program-center console-center">
          <nav className="workspace-subtabs program-subtabs">{([
            ['stage', 'Programmer'], ['looks', 'Looks'], ['fx', 'FX'], ['colors', 'Color Palettes'], ['media', 'Media'], ['presets', 'Presets']
          ] as Array<[ProgramMode, string]>).map(([id, label]) => <button key={id} className={programMode === id ? 'active' : ''} onClick={() => setProgramMode(id)}>{label}</button>)}</nav>

          {programMode === 'stage' && <div className="programmer-v3">
            <div className="programmer-stage-head"><div><span>PROGRAMMER</span><strong>{selectedFixtureTargets.length ? `${selectedFixtureTargets.length} fixture${selectedFixtureTargets.length === 1 ? '' : 's'} selected` : 'Select fixtures or a group'}</strong></div><div className="programmer-target-actions"><button className={programStageView === 'visualizer' ? 'active' : ''} onClick={() => setProgramStageView('visualizer')}>3D</button><button className={programStageView === 'plot' ? 'active' : ''} onClick={() => setProgramStageView('plot')}>PLOT</button><button onClick={() => void openStageWindow()}>POP OUT</button><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></div></div>
            <div className="programmer-stage">{programStageView === 'visualizer' ? <Visualizer3D snapshot={stageSnapshot} compact selectedElementId={selectedStageElementId} onSelectElement={(id) => { setSelectedStageElementId(id); clearFixtureSelection(); }} /> : renderStagePreview(true)}</div>
            <DraggablePanelDeck
              storageKey="lumarig.programmer-panels.v1"
              className="programmer-attribute-deck programmer-attribute-deck-v4"
              items={[
                {
                  id:'intensity',
                  title:'INTENSITY',
                  status:selectedFixtureTargets.length ? `${selectedFixtureTargets.length} SELECTED` : 'NO SELECTION',
                  content:<section className="attribute-module intensity-module">
                    <header><span>INTENSITY</span><strong>{selectedFixtureTargets.length ? 'SELECTED' : '—'}</strong></header>
                    <div className="attribute-faders">{selectedFixtureTargets.slice(0,8).map((fixture) => <VerticalFader key={fixture.id} id={`program-${fixture.id}`} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={fixture.labelColor ?? '#55e98d'} value={fixtureIntensityPercent(universe, fixture)} selected={fixture.selected} onChange={(value) => void setFixtureAttribute(fixture, 'dimmer', percentToDmx(value))} onSelect={() => selectFixtureFromConsole(fixture.id, true)} onFx={() => setProgramMode('fx')} />)}</div>
                  </section>
                },
                {
                  id:'buttons',
                  title:'BUTTONS',
                  status:'QUICK CONTROL',
                  content:<section className="attribute-module buttons-module">
                    <div className="programmer-button-groups">
                      <section>
                        <span>SELECTION</span>
                        <div><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></div>
                      </section>
                      <section>
                        <span>LEVEL</span>
                        <div>{[0,25,50,75,100].map((value)=><button key={value} disabled={!selectedFixtureTargets.length} className={value===100?'accent':''} onClick={()=>selectedFixtureTargets.forEach((fixture)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value)))}>{value===0?'OUT':value===100?'FULL':`${value}%`}</button>)}</div>
                      </section>
                      <section>
                        <span>COLOR</span>
                        <div className="button-color-row">
                          {[
                            ['WHITE','#ffffff'],
                            ['WARM','#ffd2a1'],
                            ['RED','#ff3030'],
                            ['GREEN','#35e36b'],
                            ['BLUE','#3478ff'],
                          ].map(([label,color])=><button key={label} disabled={!selectedCompatibleColors.length} style={{'--button-color':color} as import('react').CSSProperties} onClick={()=>applyGlobalColor(color)}><i/>{label}</button>)}
                        </div>
                      </section>
                      <section>
                        <span>FX</span>
                        <div><button disabled={!selectedFixtureTargets.length} onClick={()=>toggleEffect('pulse',selectedFixtureTargets.map((fixture)=>fixture.id))}>PULSE</button><button disabled={!selectedFixtureTargets.length} onClick={()=>toggleEffect('chase',selectedFixtureTargets.map((fixture)=>fixture.id))}>CHASE</button><button className="danger-soft" onClick={()=>stopEffect()}>STOP FX</button></div>
                      </section>
                    </div>
                  </section>
                },
                {
                  id:'color',
                  title:'COLOR',
                  status:selectedCompatibleColors.length ? `${selectedCompatibleColors.length} FIXTURE${selectedCompatibleColors.length===1?'':'S'}` : 'UNAVAILABLE',
                  content:<ColorDeck title="COLOR" subtitle={selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected` : 'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length === 0} presets={consoleColorPresets} onChange={applyGlobalColor} />
                },
                {
                  id:'position',
                  title:'POSITION',
                  status:`${selectedMovingFixtures.length} MOVERS`,
                  hidden:selectedMovingFixtures.length===0,
                  content:<section className="attribute-module position-module">
                    <header><span>POSITION</span><strong>{selectedMovingFixtures.length} MOVERS</strong></header>
                    <div className="position-actions">{showFile.positionPalettes?.slice(0,4).map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}>{palette.name}</button>)}<button onClick={savePositionPalette}>＋ SAVE</button></div>
                    <div className="position-shortcuts"><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('aim'); }}>AIM</button><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('move'); }}>MOVE</button><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('rotate'); }}>ROTATE</button></div>
                  </section>
                },
                {
                  id:'beam',
                  title:'BEAM',
                  status:'OPTICS',
                  content:<section className="attribute-module beam-module">
                    <header><span>BEAM</span><strong>OPTICS</strong></header>
                    <div className="semantic-button-grid">
                      <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'zoom'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'zoom') && void setFixtureAttribute(fixture,'zoom',55))}>TIGHT</button>
                      <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'zoom'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'zoom') && void setFixtureAttribute(fixture,'zoom',225))}>WIDE</button>
                      <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'focus'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'focus') && void setFixtureAttribute(fixture,'focus',190))}>FOCUS</button>
                      <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'prism'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'prism') && void setFixtureAttribute(fixture,'prism',255))}>PRISM</button>
                    </div>
                  </section>
                },
                {
                  id:'gobo',
                  title:'GOBO',
                  status:'WHEEL',
                  content:<section className="attribute-module gobo-module">
                    <header><span>GOBO</span><strong>WHEEL</strong></header>
                    <div className="semantic-button-grid gobo-buttons">
                      {[0,64,128,192].map((value,index) => <button key={value} disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'gobo'))} className={index===0 ? 'open' : ''} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'gobo') && void setFixtureAttribute(fixture,'gobo',value))}>{index===0 ? 'OPEN' : `G${index}`}</button>)}
                      <button className="wide" disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'goboRotate'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'goboRotate') && void setFixtureAttribute(fixture,'goboRotate',190))}>ROTATE</button>
                    </div>
                  </section>
                },
                {
                  id:'fx',
                  title:'FX',
                  status:liveEffectLabel || 'READY',
                  content:<section className="attribute-module fx-module">
                    <header><span>FX</span><strong>{liveEffectLabel || 'READY'}</strong></header>
                    <div className="semantic-button-grid">
                      <button disabled={!effectSupportedByFixtures('pulse',selectedFixtureTargets)} className={activeEffect==='pulse'?'active':''} onClick={() => toggleEffect('pulse',selectedFixtureTargets.map((fixture)=>fixture.id))}>PULSE</button>
                      <button disabled={!effectSupportedByFixtures('chase',selectedFixtureTargets)} className={activeEffect==='chase'?'active':''} onClick={() => toggleEffect('chase',selectedFixtureTargets.map((fixture)=>fixture.id))}>CHASE</button>
                      <button disabled={!effectSupportedByFixtures('strobe',selectedFixtureTargets)} className={activeEffect==='strobe'?'active':''} onClick={() => toggleEffect('strobe',selectedFixtureTargets.map((fixture)=>fixture.id))}>STROBE</button>
                      <button className="wide open-fx" onClick={() => setProgramMode('fx')}>OPEN FX EDITOR</button>
                    </div>
                  </section>
                }
              ]}
            />
            <LooksStrip looks={allLooks} onApply={runLook} onSave={saveCurrentLook} />
          </div>}

          {programMode === 'looks' && <div className="create-focus-view"><header><div><span>LOOKS</span><h2>Reusable lighting looks</h2></div><button className="console-primary" onClick={saveCurrentLook}>＋ Save Current Look</button></header><LooksStrip looks={allLooks} onApply={runLook} onSave={saveCurrentLook} /></div>}

          {programMode === 'fx' && <div className="create-focus-view fx-workbench fx-workbench-v4">
            <header>
              <div><span>FX WORKBENCH</span><h2>{programEffectName || 'Choose fixtures or a group'}</h2></div>
              <b className={activeEffect || activeCustomEffectId ? 'healthy' : ''}>{activeCustomEffectId ? `CUSTOM · ${customEffects.find((effect) => effect.id === activeCustomEffectId)?.name ?? fxEditor.name}` : activeEffect ? `FACTORY · ${EFFECT_PRESETS.find((effect) => effect.id === activeEffect)?.name ?? activeEffect}` : 'READY'}</b>
            </header>

            <ResizableWorkspace className="fx-editor-layout" storageKey="lumarig.fx-columns.v1" compactMode="stack" leftEnabled={false} rightEnabled rightLabel="FX Parameters" rightDefault={300} centerMinimum={420}>
              <section className="fx-graph-editor">
                <header><span>{fxEditor.steps?.length ? 'STEP RECIPE' : 'WAVEFORM'}</span><strong>{fxEditor.steps?.length ? `${fxEditor.steps.length} STEPS` : fxEditor.waveform.toUpperCase()} · {fxEditor.parameter.toUpperCase()}</strong></header>
                <div className="fx-graph-canvas">
                  <svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-label="FX waveform preview">
                    <defs><pattern id="fx-grid-v4" width="75" height="30" patternUnits="userSpaceOnUse"><path d="M 75 0 L 0 0 0 30" fill="none" stroke="rgba(115,132,142,.18)" strokeWidth="1"/></pattern></defs>
                    <rect width="600" height="120" fill="url(#fx-grid-v4)"/>
                    <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(115,132,142,.28)" strokeWidth="1"/>
                    <polyline className={activeCustomEffectId === fxEditor.id ? 'running' : ''} points={fxGraphPoints(fxEditor.waveform, fxEditor.depth, fxEditor.offset, fxEditor.steps)} fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
                  </svg>
                </div>
                <div className="fx-editor-readouts">
                  <span><small>BPM</small><strong>{fxEditor.bpm}</strong></span>
                  <span><small>DEPTH</small><strong>{Number(fxEditor.depth.toFixed(1))}%</strong></span>
                  <span><small>PHASE</small><strong>{fxEditor.phaseSpread}%</strong></span>
                  <span><small>{(fxEditor.mode ?? 'absolute') === 'relative' ? 'BIAS' : 'BASE'}</small><strong>{fxEditor.offset}%</strong></span>
                  <span><small>ORDER</small><strong>{(fxEditor.orderMode ?? 'forward').replace('-', ' ')}</strong></span>
                  <span><small>LANES</small><strong>{(fxEditor.lanes?.length ?? 0) + (fxEditor.parameter === 'position' ? 2 : 1)}</strong></span>
                  <span><small>TARGETS</small><strong>{programEffectFixtures.length}</strong></span>
                </div>
              </section>

              <section className="fx-editor-controls">
                <header><span>FX PARAMETERS</span><small>Graphical generator</small></header>
                <label><span>Name</span><input value={fxEditor.name} onChange={(event) => setFxEditor((current) => ({ ...current, name: event.target.value }))}/></label>
                <div className="inspector-pair">
                  <label><span>Parameter</span><select value={fxEditor.parameter} onChange={(event) => { const parameter = event.target.value as CustomEffectParameter; setFxEditor((current) => ({ ...current, parameter, motionShape: parameter === 'position' ? current.motionShape ?? 'circle' : current.motionShape, mode: parameter === 'position' ? 'relative' : current.mode })); }}><option value="dimmer">Dimmer</option><option value="position">Position (Pan + Tilt)</option><option value="pan">Pan Only</option><option value="tilt">Tilt Only</option><option value="uv">UV</option><option value="color">Color Palette</option></select></label>
                  <label><span>Waveform</span><select value={fxEditor.waveform} onChange={(event) => setFxEditor((current) => ({ ...current, waveform: event.target.value as EffectWaveform }))}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="saw">Saw</option><option value="reverse-saw">Reverse Saw</option><option value="step">Step</option></select></label>
                </div>
                {fxEditor.parameter === 'position' && <div className="inspector-pair">
                  <label><span>Motion Shape</span><select value={fxEditor.motionShape ?? 'circle'} onChange={(event) => setFxEditor((current) => ({ ...current, motionShape: event.target.value as MotionShape }))}><option value="circle">Circle</option><option value="figure-eight">Figure Eight</option><option value="diagonal">Diagonal</option><option value="pan-sweep">Pan Sweep</option><option value="tilt-sweep">Tilt Sweep</option></select></label>
                  <label><span>Movement</span><strong className="fx-semantic-readout">16-bit Pan + Tilt · relative to current look</strong></label>
                </div>}
                <label><span>Grid phase</span><select aria-label="FX grid phase" value={fxEditor.gridPhaseMode ?? 'selection'} onChange={e=>setFxEditor(current=>({...current,gridPhaseMode:e.target.value as CustomEffect['gridPhaseMode']}))}><option value="selection">Selection order</option><option value="rows">Whole rows</option><option value="columns">Whole columns</option><option value="across-rows">Across every row</option><option value="across-columns">Down every column</option></select></label>
                {fxEditor.parameter === 'color' && <section className="fx-color-editor"><header><span>COLOR PALETTE</span><button disabled={(fxEditor.colorPalette?.length ?? 2)>=16} onClick={()=>setFxEditor(current=>({...current,colorPalette:[...(current.colorPalette ?? ['#145dff','#00dfb5']),'#ff6b24']}))}>＋ COLOR</button></header><div>{(fxEditor.colorPalette ?? ['#145dff','#00dfb5']).map((color,index)=><label key={index}><input aria-label={`FX color ${index+1}`} type="color" value={color} onChange={e=>setFxEditor(current=>({...current,colorPalette:(current.colorPalette ?? ['#145dff','#00dfb5']).map((c,i)=>i===index?e.target.value:c)}))}/><button disabled={(fxEditor.colorPalette?.length ?? 2)<=1} onClick={()=>setFxEditor(current=>({...current,colorPalette:(current.colorPalette ?? ['#145dff','#00dfb5']).filter((_,i)=>i!==index)}))}>×</button></label>)}</div><label><span>Blend</span><select value={fxEditor.colorBlend ?? 'smooth'} onChange={e=>setFxEditor(current=>({...current,colorBlend:e.target.value as 'smooth'|'step'}))}><option value="smooth">Smooth blend</option><option value="step">Beat stepped</option></select></label></section>}
                <section className="fx-step-recipe">
                  <header><span>STEP RECIPE</span><div>{fxEditor.steps?.length ? <><button onClick={addFxStep}>＋ STEP</button><button onClick={() => setFxEditor((current) => ({ ...current, steps: undefined }))}>USE WAVEFORM</button></> : <button onClick={enableStepRecipe}>＋ BUILD STEPS</button>}</div></header>
                  {fxEditor.steps?.length ? <div className="fx-step-list">{fxEditor.steps.map((step, index) => <article key={index}>
                    <b>{index + 1}</b>
                    <label><span>Value</span><input type="number" min="0" max="100" value={step.value} onChange={(event) => updateFxStep(index, { value: Number(event.target.value) })}/></label>
                    <label><span>Width</span><input type="number" min=".01" max="32" step=".25" value={step.width ?? 1} onChange={(event) => updateFxStep(index, { width: Number(event.target.value) })}/></label>
                    <label><span>Transition</span><input type="number" min="0" max="100" value={step.transition ?? 0} onChange={(event) => updateFxStep(index, { transition: Number(event.target.value) })}/></label>
                    <label><span>Accel</span><input type="number" min="0" max="100" value={step.acceleration ?? 0} onChange={(event) => updateFxStep(index, { acceleration: Number(event.target.value) })}/></label>
                    <label><span>Decel</span><input type="number" min="0" max="100" value={step.deceleration ?? 0} onChange={(event) => updateFxStep(index, { deceleration: Number(event.target.value) })}/></label>
                    <div className="fx-step-actions"><button disabled={index === 0} onClick={() => moveFxStep(index, -1)}>↑</button><button disabled={index === fxEditor.steps!.length - 1} onClick={() => moveFxStep(index, 1)}>↓</button><button onClick={() => removeFxStep(index)}>×</button></div>
                  </article>)}</div> : <p>Use a normal waveform, or build a weighted step sequence with hold, transition, acceleration, and deceleration.</p>}
                </section>

                <div className="inspector-pair">
                  <label><span>Fixture Order</span><select value={fxEditor.orderMode ?? 'forward'} onChange={(event) => setFxEditor((current) => ({ ...current, orderMode: event.target.value as CustomEffect['orderMode'] }))}><option value="forward">Forward</option><option value="reverse">Reverse</option><option value="center-out">Center Out</option><option value="outside-in">Outside In</option><option value="mirror-pairs">Mirror Pairs</option><option value="odd-even">Odd → Even</option><option value="even-odd">Even → Odd</option></select></label>
                  <label><span>Direction</span><select value={fxEditor.direction ?? 'forward'} onChange={(event) => setFxEditor((current) => ({ ...current, direction: event.target.value as CustomEffect['direction'] }))}><option value="forward">Forward</option><option value="reverse">Reverse</option></select></label>
                </div>
                <div className="inspector-pair">
                  <label><span>Blocks</span><input type="number" min="1" max="64" value={fxEditor.blocks ?? 1} onChange={(event) => setFxEditor((current) => ({ ...current, blocks: Number(event.target.value) }))}/></label>
                  <label><span>Groups</span><input type="number" min="1" max="64" value={fxEditor.groups ?? 1} onChange={(event) => setFxEditor((current) => ({ ...current, groups: Number(event.target.value) }))}/></label>
                </div>
                <div className="inspector-pair">
                  <label><span>Wings</span><input type="number" min="1" max="16" value={fxEditor.wings ?? 1} onChange={(event) => setFxEditor((current) => ({ ...current, wings: Number(event.target.value) }))}/></label>
                  <label><span>Shift</span><input type="number" min="-256" max="256" value={fxEditor.shift ?? 0} onChange={(event) => setFxEditor((current) => ({ ...current, shift: Number(event.target.value) }))}/></label>
                </div>
                <div className="inspector-pair">
                  <label><span>Cycle</span><select value={String(fxEditor.cycleBeats ?? 1)} onChange={(event) => setFxEditor((current) => ({ ...current, cycleBeats: Number(event.target.value) }))}><option value=".25">1/4 beat</option><option value=".5">1/2 beat</option><option value="1">1 beat</option><option value="2">2 beats</option><option value="4">1 bar</option><option value="8">2 bars</option><option value="16">4 bars</option></select></label>
                  <label><span>Mode</span><select value={fxEditor.mode ?? 'absolute'} onChange={(event) => setFxEditor((current) => ({ ...current, mode: event.target.value as CustomEffect['mode'] }))}><option value="absolute">Absolute</option><option value="relative">Relative to Look</option></select></label>
                </div>
                <label><span>Speed · {fxEditor.bpm} BPM</span><input type="range" min="20" max="300" value={fxEditor.bpm} onChange={(event) => setFxEditor((current) => ({ ...current, bpm: Number(event.target.value) }))}/></label>
                <label><span>Depth · {Number(fxEditor.depth.toFixed(1))}%</span><input type="range" min="0" max="100" value={fxEditor.depth} onChange={(event) => setFxEditor((current) => ({ ...current, depth: Number(event.target.value) }))}/></label>
                <label><span>Phase Spread · {fxEditor.phaseSpread}%</span><input type="range" min="0" max="200" value={fxEditor.phaseSpread} onChange={(event) => setFxEditor((current) => ({ ...current, phaseSpread: Number(event.target.value) }))}/></label>
                <label><span>{(fxEditor.mode ?? 'absolute') === 'relative' ? 'Bias' : 'Base'} · {fxEditor.offset}%</span><input type="range" min="-100" max="100" value={fxEditor.offset} onChange={(event) => setFxEditor((current) => ({ ...current, offset: Number(event.target.value) }))}/></label>
                <section className="fx-lane-editor">
                  <header><span>ATTRIBUTE LANES</span><button onClick={addFxLane}>＋ LANE</button></header>
                  <p>Layer dimmer, movement, zoom, iris, focus, gobo, strobe, or prism behavior in the same effect.</p>
                  {(fxEditor.lanes ?? []).map((lane, index) => <article key={index}>
                    <label><span>Attribute</span><select value={lane.parameter} onChange={(event) => updateFxLane(index, { parameter: event.target.value as FixtureParameter })}>{CUSTOM_FX_LANE_PARAMETERS.map((parameter) => <option key={parameter} value={parameter}>{parameter.replace(/([A-Z])/g, ' $1')}</option>)}</select></label>
                    <label><span>Wave</span><select value={lane.waveform} onChange={(event) => updateFxLane(index, { waveform: event.target.value as EffectWaveform })}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="saw">Saw</option><option value="reverse-saw">Reverse Saw</option><option value="step">Step</option></select></label>
                    <label><span>Depth</span><input type="number" min="0" max="100" value={lane.depth} onChange={(event) => updateFxLane(index, { depth: Number(event.target.value) })}/></label>
                    <label><span>Offset</span><input type="number" min="-100" max="100" value={lane.offset} onChange={(event) => updateFxLane(index, { offset: Number(event.target.value) })}/></label>
                    <label><span>Phase</span><input type="number" min="-8" max="8" step=".05" value={lane.phaseOffset ?? 0} onChange={(event) => updateFxLane(index, { phaseOffset: Number(event.target.value) })}/></label>
                    <label><span>Rate</span><input type="number" min=".125" max="8" step=".125" value={lane.rateMultiplier ?? 1} onChange={(event) => updateFxLane(index, { rateMultiplier: Number(event.target.value) })}/></label>
                    <button className="fx-lane-delete" onClick={() => removeFxLane(index)}>×</button>
                  </article>)}
                </section>

                <div className="fx-editor-actions">
                  <button className={activeCustomEffectId === fxEditor.id ? 'danger-button' : 'console-primary'} disabled={!programEffectFixtures.length} onClick={() => runCustomFx(fxEditor, programEffectFixtures.map((fixture) => fixture.id))}>{activeCustomEffectId === fxEditor.id ? 'STOP FX' : 'RUN FX'}</button>
                  <button onClick={saveCustomFx}>SAVE TO BANK</button>
                  {(activeEffect || activeCustomEffectId) && <button onClick={() => stopEffect()}>STOP ALL</button>}
                </div>
              </section>
            </ResizableWorkspace>

            <section className="fx-bank-v4">
              <header><div><span>FX BANK</span><strong>Factory + saved custom effects</strong></div><small>{EFFECT_PRESETS.length + customEffects.length} effects</small></header>
              <div className="fx-bank-grid">{FX_RECIPES.map(recipe=><button key={recipe.id} onClick={()=>setFxEditor({...structuredClone(recipe.effect),id:crypto.randomUUID()})}><i className="fx-icon">≈</i><span><strong>{recipe.name}</strong><small>{recipe.category}</small></span><b>RECIPE</b></button>)}
                {EFFECT_PRESETS.map((effect) => <button key={effect.id} className={`${selectedFxBankId === effect.id ? 'selected' : ''} ${activeEffect === effect.id ? 'running' : ''}`} onClick={() => loadFactoryFx(effect)} onDoubleClick={() => toggleEffect(effect.id, programEffectFixtures.map((fixture) => fixture.id))}><i className={`fx-icon fx-${effect.id}`}/><span><strong>{effect.name}</strong><small>{EFFECT_SHAPES[effect.id].waveform} · {effect.defaultBpm} BPM</small></span><b>{activeEffect === effect.id ? 'LIVE' : 'FACTORY'}</b></button>)}
                {customEffects.map((effect) => <article key={effect.id} className={`${selectedFxBankId === effect.id ? 'selected' : ''} ${activeCustomEffectId === effect.id ? 'running' : ''}`}><button className="fx-bank-load" onClick={() => { setSelectedFxBankId(effect.id); setFxEditor(effect); }} onDoubleClick={() => runCustomFx(effect, programEffectFixtures.map((fixture) => fixture.id))}><i>∿</i><span><strong>{effect.name}</strong><small>{effect.parameter === 'position' ? (effect.motionShape ?? 'circle').replace('-', ' ') : effect.waveform} · {effect.bpm} BPM</small></span><b>{activeCustomEffectId === effect.id ? 'LIVE' : 'CUSTOM'}</b></button><button className="fx-bank-delete" aria-label={`Delete ${effect.name}`} onClick={() => deleteCustomFx(effect.id)}>×</button></article>)}
              </div>
              <footer><span>Single click loads an effect into the graph. Double-click a bank item to run it immediately.</span><button onClick={() => { setFxEditor({ id: 'custom-preview', name: 'New FX', parameter: 'dimmer', waveform: 'sine', bpm: 100, depth: 100, phaseSpread: 0, offset: 0, orderMode: 'forward', blocks: 1, groups: 1, wings: 1, shift: 0, direction: 'forward', cycleBeats: 1, mode: 'absolute' }); setSelectedFxBankId('custom-preview'); }}>＋ NEW FX</button></footer>
            </section>
          </div>}

          {programMode === 'colors' && <div className="create-focus-view"><header><div><span>COLOR PALETTES</span><h2>Fixture-aware color programming</h2></div></header><ColorDeck title="SELECTED COLOR" subtitle={selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected fixtures` : 'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length === 0} presets={consoleColorPresets} onChange={applyGlobalColor} /><section className="palette-library-v3"><header><span>QUICK PALETTES</span><small>Applies to selected compatible fixtures</small></header><div>{consoleColorPresets.map((preset) => <button key={preset.name} disabled={selectedCompatibleColors.length === 0} onClick={() => applyGlobalColor(preset.color)}><i style={{background:preset.color}}/><strong>{preset.name}</strong><small>{preset.color.toUpperCase()}</small></button>)}</div></section></div>}

          {programMode === 'media' && <div className="create-focus-view media-programmer"><header><div><span>MEDIA</span><h2>Visualizer + LumaStudio</h2></div><b className={studioBridgeStatus.connectedClients > 0 ? 'healthy' : ''}>{studioBridgeStatus.connectedClients > 0 ? 'STUDIO LINKED' : 'VISUALIZER READY'}</b></header><div className="media-link-grid"><section><span>INTEGRATED VISUALIZER</span><strong>Ready</strong><small>Same fixture + stage state as LumaRig</small><div className="media-stage-preview"><Visualizer3D snapshot={stageSnapshot} compact/></div><button onClick={() => setWorkspace('visualizer')}>OPEN VISUALIZER</button></section><section><span>LUMASTUDIO</span><strong>{studioBridgeStatus.connectedClients > 0 ? 'Connected' : 'Ready'}</strong><small>Studio transport authority · Rig lighting authority</small><div className="media-status-stack"><p>Port {studioBridgeStatus.port}</p><p>{externalTransportRunning ? 'Transport following' : externalTrack.armed ? 'External sync armed' : 'Local transport'}</p><p>{externalTrack.songName || showTrackName || 'No active media track'}</p></div><button onClick={() => { setWorkspace('show'); setShowMode('sync'); }}>OPEN SYNC</button></section></div></div>}

          {programMode === 'presets' && <div className="create-focus-view"><header><div><span>PRESETS</span><h2>Position + look library</h2></div><button onClick={savePositionPalette}>＋ Save Position</button></header><section className="preset-bank-v3"><div><h3>POSITION PALETTES</h3>{showFile.positionPalettes?.length ? showFile.positionPalettes.map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}><span>{palette.kind}</span><strong>{palette.name}</strong></button>) : <p>No position palettes saved.</p>}</div><div><h3>LOOK PRESETS</h3>{allLooks.map((look) => <button key={look.id} onClick={() => runLook(look)}><i style={{background:lookSwatch(look.values)}}/><strong>{look.name}</strong></button>)}</div></section></div>}
        </div>

        {programMode !== 'fx' && <EffectsPanel title="FX / SELECTED TARGET" targetName={programEffectName} fixtures={programEffectFixtures} activeEffect={activeEffect} bpm={effectBpm} depth={effectDepth} disabled={false} onBpmChange={setMasterTempo} onDepthChange={(value) => { setEffectDepth(value); effectDepthRef.current = value; }} onStart={(effect) => toggleEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onPress={(effect) => startMomentaryEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onRelease={releaseMomentaryEffect} onStop={() => stopEffect()} />}
      </ResizableWorkspace>}


      {workspace === 'visualizer' && <section className="console-workspace-wide visualizer-workspace">
        <header className="visualizer-workspace-header">
          <div><span>INTEGRATED VISUALIZER</span><h2>{STAGE_PRESETS.find((preset) => preset.id === activeStagePresetId)?.name ?? 'Current Show'}</h2><p>Live LumaRig output, stage geometry, screens, crowd, haze and camera flybys in one scene.</p></div>
          <div className="visualizer-workspace-actions">
            <button onClick={() => { setWorkspace('build'); setSetupView('stage'); }}>Edit Stage</button>
            <button className={visualizerToolsOpen ? 'active' : ''} aria-pressed={visualizerToolsOpen} onClick={() => setVisualizerToolsOpen((open) => !open)}>{visualizerToolsOpen ? 'Hide Scene Tools' : 'Scene Tools'}</button>
            <button onClick={() => void scanStageVideoInputs()}>Scan NDI / Video</button>
            <button className="console-primary" onClick={() => void openStageWindow()}>Pop Out ↗</button>
          </div>
        </header>
        <div className={`visualizer-workspace-layout ${visualizerToolsOpen ? 'tools-open' : 'focus'}`}>
          <div className="visualizer-workspace-canvas"><Visualizer3D snapshot={stageSnapshot} selectedElementId={selectedStageElementId} onSelectElement={(id) => { setSelectedStageElementId(id); clearFixtureSelection(); }}/></div>
          {visualizerToolsOpen && <aside className="visualizer-workspace-sidebar">
            <section className="visualizer-scene-tree">
              <span>SCENE</span>
              <strong>{stageElements.length} objects</strong>
              <small>{patch.length} patched fixtures · {stageElements.filter((element) => element.type === 'led-screen').length} screens</small>
              <div>{stageElements.map((element) => <button key={element.id} className={selectedStageElementId === element.id ? 'active' : ''} onClick={() => { setSelectedStageElementId(element.id); clearFixtureSelection(); }}><i style={{ background: element.color }}/><span><strong>{element.label}</strong><small>{element.assetKind ?? element.type}</small></span></button>)}</div>
            </section>

            {selectedStageElement && <section className="visualizer-object-inspector">
              <span>SELECTED OBJECT</span>
              <strong>{selectedStageElement.label}</strong>
              <label><span>Name</span><input value={selectedStageElement.label} onChange={(event) => updateStageElement(selectedStageElement.id, { label: event.target.value })}/></label>
              <div className="visualizer-transform-grid">
                {(['x','y','z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step=".1" value={Number(selectedStagePosition[axis].toFixed(2))} onChange={(event) => updateStageElementPosition(selectedStageElement.id, axis, Number(event.target.value))}/></label>)}
              </div>
              <div className="visualizer-transform-grid">
                {(['yaw','pitch','roll'] as const).map((axis) => <label key={axis}><span>{axis}</span><input type="number" step="1" value={Number((selectedStageElement.transform?.rotation?.[axis] ?? 0).toFixed(1))} onChange={(event) => updateStageElementRotation(selectedStageElement.id, axis, Number(event.target.value))}/></label>)}
              </div>
              <div className="visualizer-transform-grid">
                {(['x','y','z'] as const).map((axis) => <label key={axis}><span>{axis === 'x' ? 'W' : axis === 'y' ? 'H' : 'D'}</span><input type="number" min=".03" step=".1" value={Number((selectedStageElement.dimensions?.[axis] ?? 1).toFixed(2))} onChange={(event) => updateStageElementDimension(selectedStageElement.id, axis, Number(event.target.value))}/></label>)}
              </div>
              <label><span>Color</span><input className="inspector-color" type="color" value={selectedStageElement.color} onChange={(event) => updateStageElement(selectedStageElement.id, { color: event.target.value })}/></label>
              {selectedStageElement.type === 'led-screen' && <div className="visualizer-screen-route">
                <label><span>Screen Source</span><select value={selectedStageElement.mediaSource?.kind ?? 'none'} onChange={(event)=>setScreenSourceKind(selectedStageElement.id,event.target.value as 'none'|'timeline'|'ndi'|'image'|'color'|'test-pattern')}>
                  <option value="none">Object / screen color</option>
                  <option value="color">Solid color</option>
                  <option value="test-pattern">Test pattern</option>
                  <option value="image">Still image</option>
                  <option value="ndi">NDI / Video Input</option>
                  <option value="timeline">Timeline video / MP4</option>
                </select></label>
                <label>Import video to Timeline<input aria-label="Import screen video" type="file" accept="video/mp4,.mp4" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importScreenVideo(selectedStageElement.id,file).catch(error=>setMessage(String(error)));}} /></label>
                {selectedStageElement.mediaSource?.kind==='color' && <label><span>Source Color</span><input type="color" value={selectedStageElement.mediaSource.color} onChange={event=>updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'color',color:event.target.value}})}/></label>}
                {selectedStageElement.mediaSource?.kind==='test-pattern' && <label><span>Pattern</span><select value={selectedStageElement.mediaSource.pattern} onChange={event=>updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'test-pattern',pattern:event.target.value as 'bars'|'grid'|'checker'}})}><option value="bars">Color bars</option><option value="grid">Alignment grid</option><option value="checker">Checker</option></select></label>}
                {selectedStageElement.mediaSource?.kind==='image' && <>
                  <label><span>Image Asset</span><select value={selectedStageElement.mediaSource.mediaId} onChange={event=>{const asset=screenImageAssets.find(item=>item.id===event.target.value);updateStageElement(selectedStageElement.id,{mediaSource:{...selectedStageElement.mediaSource!,kind:'image',mediaId:event.target.value,sourceName:asset?.name??'Still image'}})}}><option value="">Select Media Library image</option>{screenImageAssets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                  <label className="file-button">Import Still Image<input aria-label="Import visualizer screen still image" type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importScreenImage(selectedStageElement.id,file).catch(error=>setMessage(String(error)));}}/></label>
                </>}
                {selectedStageElement.mediaSource?.kind === 'ndi' && <label><span>Input</span><select value={selectedStageElement.mediaSource.deviceId ?? ''} onChange={(event) => {
                  const input=stageVideoInputs.find((item)=>item.deviceId===event.target.value);
                  const source=selectedStageElement.mediaSource?.kind==='ndi' ? selectedStageElement.mediaSource : {kind:'ndi' as const};
                  updateStageElement(selectedStageElement.id,{mediaSource:{...source,deviceId:event.target.value||undefined,sourceName:input?.label||'ProPresenter'}});
                }}><option value="">Select input</option>{stageVideoInputs.map((input)=><option key={input.deviceId} value={input.deviceId}>{input.label}</option>)}</select></label>}
                {selectedStageElement.mediaSource && ['ndi','timeline','image'].includes(selectedStageElement.mediaSource.kind) && <>
                  <div className="screen-framing-pair">
                    <label><span>Fit</span><select value={selectedStageElement.mediaSource.fit ?? 'contain'} onChange={event=>updateScreenFraming(selectedStageElement.id,{fit:event.target.value as 'contain'|'cover'})}><option value="contain">Contain</option><option value="cover">Cover</option></select></label>
                    <label><span>Size · {Math.round((selectedStageElement.mediaSource.scale ?? 1)*100)}%</span><input aria-label="Screen video size" type="range" min="25" max="300" step="1" value={(selectedStageElement.mediaSource.scale ?? 1)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{scale:Number(event.target.value)/100})}/></label>
                  </div>
                  <div className="screen-framing-pair">
                    <label><span>X · {Math.round((selectedStageElement.mediaSource.offsetX ?? 0)*100)}%</span><input aria-label="Screen video horizontal position" type="range" min="-100" max="100" step="1" value={(selectedStageElement.mediaSource.offsetX ?? 0)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{offsetX:Number(event.target.value)/100})}/></label>
                    <label><span>Y · {Math.round((selectedStageElement.mediaSource.offsetY ?? 0)*100)}%</span><input aria-label="Screen video vertical position" type="range" min="-100" max="100" step="1" value={(selectedStageElement.mediaSource.offsetY ?? 0)*100} onChange={event=>updateScreenFraming(selectedStageElement.id,{offsetY:Number(event.target.value)/100})}/></label>
                  </div>
                  <button onClick={()=>updateScreenFraming(selectedStageElement.id,{fit:'contain',scale:1,offsetX:0,offsetY:0})}>Reset video framing</button>
                </>}
              </div>}
              <div className="visualizer-object-actions"><button onClick={() => duplicateStageElement(selectedStageElement.id)}>Duplicate</button><button className="danger-button" onClick={() => removeStageElement(selectedStageElement.id)}>Delete</button></div>
            </section>}

            <section className="visualizer-warehouse">
              <span>WAREHOUSE</span>
              <strong>Add to this scene</strong>
              <div>{(['Stage','Screens','Scenic','Audio','Band','People'] as const).map((category) => <details key={category}><summary>{category}</summary><div>{STAGE_WAREHOUSE.filter((item) => item.category === category).map((item) => <button key={item.id} onClick={() => addWarehouseStageElement(item.id)}>＋ {item.name}</button>)}</div></details>)}</div>
            </section>

            <section className="visualizer-input-panel"><span>SCREEN INPUTS</span><strong>{stageVideoInputs.length ? `${stageVideoInputs.length} available` : 'Not scanned'}</strong><small>{stageElements.filter((element) => element.type === 'led-screen' && element.mediaSource?.kind === 'ndi' && element.mediaSource.deviceId).length} screens assigned to live inputs</small>{stageVideoInputError && <small className="stage-source-error">{stageVideoInputError}</small>}{stageVideoInputPermissionBlocked && <button className="video-permission-action" onClick={() => void openVideoInputPrivacySettings()}>Open Camera Privacy Settings</button>}{stageVideoInputs.length > 0 && <div>{stageVideoInputs.map((input) => <button key={input.deviceId} onClick={() => routeVideoInputToAllScreens(input.deviceId)}><strong>{input.label}</strong><small>Route to all screens</small></button>)}</div>}</section>
            <section className="visualizer-preset-picker"><span>VENUE PRESETS</span>{STAGE_PRESETS.map((preset) => <button key={preset.id} className={activeStagePresetId === preset.id ? 'active' : ''} onClick={() => loadStagePreset(preset.id)}><strong>{preset.name}</strong><small>{preset.description}</small></button>)}</section>
          </aside>}
        </div>
      </section>}

      {workspace === 'show' && <section className="show-console console-workspace-wide show-console-v3">
        <nav className="workspace-subtabs show-subtabs">{([
          ['songs','Song Bank'],['creator','Show Creator'],['cues','Cues'],['timeline','Timeline'],['tracks','Tracks'],['media','Media Library'],['library','Show Library'],['sync','MIDI & Sync'],['recordings','Recordings']
        ] as Array<[ShowMode,string]>).map(([id,label]) => <button key={id} aria-label={label} title={label} data-compact-label={{songs:'Songs',creator:'Creator',cues:'Cues',timeline:'Timeline',tracks:'Tracks',media:'Media',library:'Library',sync:'Sync',recordings:'Record'}[id]} className={showMode === id ? 'active' : ''} onClick={() => changeShowMode(id)}>{label}</button>)}</nav>

        {showMode === 'songs' && <SongBank library={songLibrary} ready={libraryReady} saveStatus={saveStatus} onSave={saveBankSong} onUse={useLibrarySong} show={showFile} activeId={activeSongId} onAdd={addBankSong} onSelect={selectBankSong} onRename={renameBankSong} onMedia={attachBankMedia} onAnalyzeTempo={analyzeBankSongTempo} onApplyTempo={applyAnalyzedTempo} onOpenMediaLibrary={(song) => { setActiveSongId(song.id); changeShowMode('media'); }} onExport={(song)=>void exportSongPackage(song)} onImport={()=>void importSongPackageFile()}/>}
                {showMode === 'media' && <MediaLibraryPanel activeSong={creatorSong ?? null} mediaUseCounts={mediaUseCounts} onAttachToActiveSong={attachLibraryAssetToActiveSong} onAssetChanged={applyMediaAssetName} onExportBackup={exportLocalPortableBackup} onRestoreBackup={restoreLocalPortableBackup}/>}
        {showMode === 'cues' && <ResizableWorkspace className={`show-cue-layout ${cueTimelineSong!==null ? 'cue-with-timeline' : ''}`} storageKey="lumarig.cue-columns.v1" leftLabel="Rundown" rightLabel="Cue Inspector" leftDefault={250} rightDefault={245} rightEnabled={cueTimelineSong===null} centerMinimum={400}>
          <SongCueLibrary cues={showFile.cues} sections={showFile.rundownSections??[]} activeId={activeCueId} timelineNames={(showFile.timelineShows??[]).map(item=>item.name)} onRun={runCue} onDelete={deleteCue} onCapture={captureCue} onMove={(id,direction)=>setShowFile(current=>({...current,cues:moveCue(current.cues,id,direction)}))} onMoveSong={(sectionId,name,direction)=>setShowFile(current=>({...current,cues:moveRundownItemCues(current.cues,sectionId,name,direction)}))} onSectionsChange={(rundownSections)=>setShowFile(current=>({...current,rundownSections}))} onTimeline={openSongTimeline} onImport={importTimelineShow}/>

          {cueTimelineSong!==null ? <main className="cue-integrated-timeline"><header><strong>{cueTimelineSong}</strong><button onClick={()=>{releaseTimeline();setCueTimelineSong(null);}}>Close timeline</button></header><Suspense fallback={<p>Loading timeline…</p>}><ShowTimelineEditor onRecord={recordIntoTimeline} keepMediaOnRelease={()=>Boolean(timelineRecordingOrigin.current && showRecordingActiveRef.current)} onExportVideo={exportTimelineVideo} onImportVideoClip={importTimelineVideoClip} onPlayingChange={changeTimelinePlaying} fxRecipes={fxLibrary(customEffects)} screens={stageElements.filter(e=>e.type==='led-screen')} displayId={stageElements.find(e=>e.mediaSource?.kind==='timeline')?.id ?? ''} onDisplayChange={routeTimelineVideo} selectedClipId={activeTimelineClipId} positionBar={timelinePositionBar} onSelectClip={selectTimelineClip} onRelease={releaseTimeline} onReset={() => { commitUniverse(makeUniverse()); timelinePositionRef.current=0; setTimelinePositionBar(0); activeTimelineClipRef.current=''; setActiveTimelineClipId(''); setActiveCueId(null); setActiveSectionId(''); }} key={timelineShowId+cueTimelineSong} timeline={editingTimeline} cues={showFile.cues.filter(c => !timelineShowId || c.trackName === showFile.timelineShows?.find(t => t.id === timelineShowId)?.name)} initialBar={timelineStartBar} songFilter={cueTimelineSong} audioRef={showTrackAudioRef} audioUrl={editingTimeline.audioName===showTrackName?showTrackUrl:''} audioName={editingTimeline.audioName??''} audioDurationMs={editingTimeline.audioName===showTrackName?showTrackDurationMs:0} masterBpm={masterTempoBpm} onMasterBpmChange={setMasterTempo} tempoLocked={tempoLocked} onTempoLockChange={changeTempoLock} tempoAnalysis={creatorSong?.tempoAnalysis} onDownbeatChange={correctActiveSongDownbeat} onOpenStepEditor={openTimelineStepEditor} onLoadAudio={loadShowAudioFile} onChange={updateEditingTimeline} onAddFx={addTimelineFx} fxTargetName={selectedGroup?.name??'All patched fixtures'} onFrame={renderTimelineFrame} onStop={stopTimeline} onCreator={()=>setShowMode('creator')}/></Suspense></main> : <>          <main className="cue-preview-console"><header><span>{directStatus.clients > 0 ? 'LUMAVIZ LIVE PREVIEW' : 'STAGE / CUE PREVIEW'}</span><b>{activeCue?.name ?? 'Live output'}</b></header><div className={`show-viz-preview ${liveLumaVizPreview ? 'linked external-feed' : directStatus.clients > 0 ? 'linked' : ''}`}>{liveLumaVizPreview ? <img src={liveLumaVizPreview.dataUrl} alt={`LumaViz ${liveLumaVizPreview.view ?? 'live'} preview`} /> : renderStagePreview()}</div><div className="cue-preview-meta"><span>CURRENT<strong>{activeCue ? `${activeCue.number}. ${activeCue.name}` : 'Ready'}</strong></span><span>NEXT<strong>{nextCue ? `${nextCue.number}. ${nextCue.name}` : 'End of show'}</strong></span></div></main></>}

          <aside className="cue-inspector-console"><header><span>CUE INSPECTOR</span><strong>{activeCue?.name ?? 'New cue'}</strong></header>{activeCue ? <><label><span>Cue Name</span><input value={activeCue.name} onChange={(event)=>updateCueProperties(activeCue.id,{name:event.target.value})}/></label><label><span>Cue Color</span><input type="color" value={activeCue.color ?? '#55e98d'} onChange={(event)=>updateCueProperties(activeCue.id,{color:event.target.value})}/></label><label><span>Description</span><textarea value={activeCue.description ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{description:event.target.value})}/></label><div className="inspector-pair"><label><span>Fade In ms</span><input type="number" min="0" value={activeCue.fadeMs} onChange={(event)=>updateCueProperties(activeCue.id,{fadeMs:Number(event.target.value)})}/></label><label><span>Fade Out ms</span><input type="number" min="0" value={activeCue.fadeOutMs ?? activeCue.fadeMs} onChange={(event)=>updateCueProperties(activeCue.id,{fadeOutMs:Number(event.target.value)})}/></label></div><div className="inspector-pair"><label><span>Delay ms</span><input type="number" min="0" value={activeCue.delayMs ?? 0} onChange={(event)=>updateCueProperties(activeCue.id,{delayMs:Number(event.target.value)})}/></label><label><span>Follow ms</span><input type="number" min="0" value={activeCue.followMs ?? 0} onChange={(event)=>updateCueProperties(activeCue.id,{followMs:Number(event.target.value)})}/></label></div><section className="cue-timing-overrides"><header><span>ATTRIBUTE TIMING</span><small>Override only what needs different timing</small></header>{(['intensity','color','position','beam'] as CueTimingFamily[]).map((family)=>{const rule=cueTimingRule(activeCue,family);return <div className="cue-timing-row" key={family}><strong>{family.toUpperCase()}</strong><label><span>Fade ms</span><input type="number" min="0" max="60000" value={rule.fadeMs} onChange={(event)=>updateCueTiming(activeCue.id,family,{fadeMs:Number(event.target.value)})}/></label><label><span>Delay ms</span><input type="number" min="0" max="60000" value={rule.delayMs} onChange={(event)=>updateCueTiming(activeCue.id,family,{delayMs:Number(event.target.value)})}/></label><label><span>Curve</span><select value={rule.curve} onChange={(event)=>updateCueTiming(activeCue.id,family,{curve:event.target.value as CueTimingRule['curve']})}><option value="ease">Ease</option><option value="linear">Linear</option><option value="snap">Snap</option></select></label></div>})}</section><label><span>Linked Effect</span><select value={activeCue.linkedEffectId ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{linkedEffectId:event.target.value})}><option value="">None</option>{EFFECT_PRESETS.map((effect)=><option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label><label><span>Show Section</span><select aria-label="Cue show section" value={activeCue.rundownSectionId ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{rundownSectionId:event.target.value})}><option value="">Unfiled</option>{(showFile.rundownSections??[]).map(section=><option key={section.id} value={section.id}>{section.name}</option>)}</select></label><label><span>Item Type</span><select aria-label="Cue item type" value={activeCue.trackKind ?? 'song'} onChange={(event)=>updateCueProperties(activeCue.id,{trackKind:event.target.value as 'song'|'media'})}><option value="song">Song</option><option value="media">Media</option></select></label><label><span>Song / media item</span><input value={activeCue.trackName ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{trackName:event.target.value})}/></label><button className="console-primary" onClick={()=>updateCue(activeCue.id)}>Update Look From Output</button></> : <><label><span>New Cue Name</span><input value={cueName} placeholder={`Cue ${showFile.cues.length+1}`} onChange={(event)=>setCueName(event.target.value)}/></label><label><span>Fade In</span><select value={cueFadeMs} onChange={(event)=>setCueFadeMs(Number(event.target.value))}>{FADE_TIMES.map((time)=><option key={time} value={time}>{time===0?'Snap':`${time/1000}s`}</option>)}</select></label><button className="console-primary" onClick={captureCue}>Capture Current Look</button></>}<label><span>Show Notes</span><textarea value={showFile.notes ?? ''} placeholder="Set list, transitions, safety notes…" onChange={(event)=>setShowFile((current)=>({...current,notes:event.target.value}))}/></label></aside>

          <div className="cue-transport-console"><button onClick={goPreviousCue} disabled={!showFile.cues.length}>BACK</button><span><small>CURRENT</small><strong>{activeCue?.name ?? 'Ready'}</strong></span><button className="giant-go" onClick={goNextCue} disabled={!nextCue}>GO<small>{nextCue?.name ?? 'End'}</small></button><span><small>NEXT</small><strong>{nextCue?.name ?? 'End of show'}</strong></span><button onClick={goNextCue} disabled={!nextCue}>NEXT</button></div>
        </ResizableWorkspace>}

        {showMode === 'creator' && <Suspense fallback={<p>Loading Show Creator…</p>}><ShowCreator selectedSectionId={activeSectionId} onSelectSection={selectCreatorSection} customEffects={customEffects} onSaveSong={saveCreatorSongProgram} presets={sectionPresets} onPresetsChange={setSectionPresets} key={creatorSong?.id ?? 'all'} songName={creatorSong?.name} onRenameSong={name => { if (creatorSong) renameBankSong(creatorSong.id, name); }} onSongBank={() => setShowMode('songs')} sections={(showFile.creatorSections ?? []).filter(section => !creatorSong || section.song === creatorSong.name)} setSections={(action) => setShowFile(current => {
          const all = current.creatorSections ?? [];
          const editing = all.filter(section => !creatorSong || section.song === creatorSong.name);
          const next = typeof action === 'function' ? action(editing) : action;
          return {...current,creatorSections:creatorSong ? [...all.filter(section => section.song !== creatorSong.name), ...next.map(section => ({...section,song:creatorSong.name}))] : next};
        })} groups={showFile.groups ?? []} fixtures={patch} masterBpm={masterTempoBpm} onMasterBpmChange={setMasterTempo} tempoLocked={tempoLocked} onTempoLockChange={changeTempoLock} onBuild={buildCreatorSections} onPreview={previewCreatorSection} onStop={() => { stopFade(); stopEffect(); }} onTimeline={() => { if (creatorSong) void selectBankSong(creatorSong, 'timeline'); else setShowMode('timeline'); }} onEditFx={(effect) => { setFxEditor(effect); setWorkspace('create'); setProgramMode('fx'); }}/></Suspense>}
        {showMode === 'timeline' && <div className="timeline-workspace"><label className="timeline-show-select">Timeline show <select aria-label="Timeline show" value={timelineShowId} onChange={e=>{window.dispatchEvent(new Event('lumarig-stop-timeline'));stopTimeline();const item=showFile.timelineShows?.find(t=>t.id===e.target.value);const song=songBank.find(s=>s.name===item?.name);if(song)void selectBankSong(song,'timeline');else{++mediaLoadToken.current;setActiveSongId('');setTimelineShowId(e.target.value);showTrackAudioRef.current?.pause();}}}><option value="">Current show</option>{(showFile.timelineShows??[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Suspense fallback={<p>Loading Timeline…</p>}><ShowTimelineEditor onRecord={recordIntoTimeline} keepMediaOnRelease={()=>Boolean(timelineRecordingOrigin.current && showRecordingActiveRef.current)} onExportVideo={exportTimelineVideo} onImportVideoClip={importTimelineVideoClip} onPlayingChange={changeTimelinePlaying} fxRecipes={fxLibrary(customEffects)} screens={stageElements.filter(e=>e.type==='led-screen')} displayId={stageElements.find(e=>e.mediaSource?.kind==='timeline')?.id ?? ''} onDisplayChange={routeTimelineVideo} selectedClipId={activeTimelineClipId} positionBar={timelinePositionBar} onSelectClip={selectTimelineClip} onRelease={releaseTimeline} onReset={() => { commitUniverse(makeUniverse()); timelinePositionRef.current=0; setTimelinePositionBar(0); activeTimelineClipRef.current=''; setActiveTimelineClipId(''); setActiveCueId(null); setActiveSectionId(''); }} key={timelineShowId} timeline={editingTimeline} cues={showFile.cues.filter(c => !timelineShowId || c.trackName === showFile.timelineShows?.find(t => t.id === timelineShowId)?.name)} audioRef={showTrackAudioRef} audioUrl={editingTimeline.audioName===showTrackName?showTrackUrl:''} audioName={editingTimeline.audioName??''} audioDurationMs={editingTimeline.audioName===showTrackName?showTrackDurationMs:0} masterBpm={masterTempoBpm} onMasterBpmChange={setMasterTempo} tempoLocked={tempoLocked} onTempoLockChange={changeTempoLock} tempoAnalysis={creatorSong?.tempoAnalysis} onDownbeatChange={correctActiveSongDownbeat} onOpenStepEditor={openTimelineStepEditor} onLoadAudio={loadShowAudioFile} onChange={updateEditingTimeline} onAddFx={addTimelineFx} fxTargetName={selectedGroup?.name??'All patched fixtures'} onFrame={renderTimelineFrame} onStop={stopTimeline} onCreator={() => changeShowMode('creator')}/></Suspense></div>}

        {showMode === 'tracks' && <div className="tracks-console tracks-console-v3">
          <section className="console-panel track-source"><header><div><span>LOCAL AUDIO TRACK</span><h2>{showTrackName || 'No track loaded'}</h2></div><label className="file-button"><input type="file" accept="audio/*" onChange={loadShowTrack}/>{showTrackName?'Change Track':'Load Track'}</label></header><div className="track-timeline"><span>{formatShowTime(showTrackPositionMs)}</span><input type="range" min="0" max={Math.max(1,showTrackDurationMs)} value={Math.min(showTrackPositionMs,Math.max(1,showTrackDurationMs))} onChange={(event)=>{const next=Number(event.target.value);if(showTrackAudioRef.current)showTrackAudioRef.current.currentTime=next/1000;setShowTrackPositionMs(next);}}/><span>{formatShowTime(showTrackDurationMs)}</span></div><div className="track-actions"><button onClick={toggleShowTrackPreview}>Play / Pause</button><button onClick={()=>setShowMode('timeline')}>Open Timeline</button></div></section>
          <section className="console-panel external-track-console"><header><div><span>STUDIO / DAW TRACK</span><h2>{externalTrack.songName || 'External Track'}</h2></div><b className={externalTransportRunning?'healthy':''}>{externalTransportRunning?'Following':externalTrack.armed?'Armed':'Off'}</b></header><label><span>Song Name</span><input value={externalTrack.songName} onChange={(event)=>updateExternalTrack({songName:event.target.value})}/></label><label><span>Lighting Take</span><select value={externalTrack.recordingId} onChange={(event)=>assignExternalRecording(event.target.value)}><option value="">Choose take</option>{showFile.recordings?.map((recording)=><option key={recording.id} value={recording.id}>{recording.name}</option>)}</select></label><div className="inspector-pair"><label><span>BPM</span><input type="number" value={externalTrack.bpm} onChange={(event)=>updateExternalTrack({bpm:Number(event.target.value)})}/></label><label><span>Advance ms</span><input type="number" value={externalTrack.lightingOffsetMs} onChange={(event)=>updateExternalTrack({lightingOffsetMs:Number(event.target.value)})}/></label></div><button className={externalTrack.armed?'danger-button':'console-primary'} onClick={toggleExternalTrackArm}>{externalTrack.armed?'Disarm External Sync':'Arm External Sync'}</button></section>
        </div>}

        {showMode === 'library' && <div className="show-library-console show-library-v3">
          <header><div><span>SHOW LIBRARY</span><h2>{showFile.name}</h2><small>Local saves are always written first. Export a portable Show file for another Mac/Windows computer, or sync it through LumaRig Cloud.</small></div><div><button disabled={!libraryReady || transitionBusy} onClick={() => void newShowProject()}>＋ New Show</button><button onClick={()=>void importShowPackageFile()}>Import .lumarigshow</button><button onClick={()=>void exportShowPackage()}>Export Current</button><button onClick={()=>void saveShowProject('template')}>Save Template</button><button onClick={()=>void saveShowProject('draft')}>Save Draft</button><button className="console-primary" onClick={()=>void saveShowProject('show')}>Save Service Show</button></div></header>
          <div className="show-recovery"><span role="status">{saveStatus}</span>{showRecovery.length > 0 && <details><summary>Recovery · {showRecovery.length} previous Shows</summary>{showRecovery.map(item => <div key={item.id}><span>{item.show.name} · {new Date(item.savedAt).toLocaleString()}</span><button disabled={transitionBusy} onClick={() => void recoverShow(item)}>Restore Show</button></div>)}</details>}</div>
          <section className="local-show-library-section">
            <div className="library-section-heading"><div><small>THIS COMPUTER</small><strong>Local Library</strong></div><span>{showLibrary.length} saved</span></div>
            <div className="show-library-grid">{showLibrary.length?showLibrary.map((item)=><article key={item.id}><div><span className={item.status}>{item.status.toUpperCase()}</span><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleString()} · R{item.revision ?? 1} · {item.lastEditor ?? 'lumarig'} · {item.show.cues.length} cues · {item.patch.length} fixtures{item.cloudRevision ? ` · Cloud R${item.cloudRevision}` : ''}</small></div><div><button onClick={()=>void loadShowProject(item)}>Load</button><button onClick={()=>void exportShowPackage(item)}>Export</button><button className="danger-button" onClick={()=>void deleteShowProject(item.id)}>Delete Local</button></div></article>):<div className="empty-show-library"><strong>No saved shows yet</strong><span>Save the current show or a draft. Your working Show and songs autosave together.</span></div>}</div>
          </section>
          <section className="cloud-show-library-section">
            <header className="cloud-library-header"><div><small>CLOUD SHOWS</small><strong>Available on every LumaRig computer</strong><span>Folders and version history live in Supabase. Local operation never depends on this connection.</span></div><b className={cloudStatus === 'synced' ? 'healthy' : cloudStatus === 'error' ? 'error' : ''}>{cloudStatus.toUpperCase()}</b></header>
            <div className="cloud-library-toolbar">
              <label><span>Folder</span><select value={cloudFolderId} onChange={(event)=>setCloudFolderId(event.target.value)}><option value="">Cloud Root</option>{cloudFolders.map((folder)=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
              <label className="cloud-new-folder"><span>New folder</span><input value={cloudFolderName} placeholder="Weekend Services" onChange={(event)=>setCloudFolderName(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter')void createCloudFolderFromInput();}}/></label>
              <button disabled={cloudBusy || !cloudFolderName.trim()} onClick={()=>void createCloudFolderFromInput()}>Create Folder</button>
              <button disabled={cloudStatus === 'loading'} onClick={()=>void refreshCloudLibrary()}>{cloudStatus === 'loading' ? 'Refreshing…' : 'Refresh Cloud'}</button>
            </div>
            {cloudError && <p className="cloud-library-error">{cloudError}</p>}
            <div className="show-library-grid cloud-show-grid">{cloudShows.filter((item)=>(item.folderId ?? '')===cloudFolderId).length ? cloudShows.filter((item)=>(item.folderId ?? '')===cloudFolderId).map((item)=><article key={item.showId}><div><span className={item.status}>{item.status.toUpperCase()}</span><strong>{item.name}</strong><small>{new Date(item.updatedAt).toLocaleString()} · Cloud R{item.revision} · {item.lastEditor}</small></div><div><button className="console-primary" onClick={()=>void importCloudShow(item)}>Download + Load</button></div></article>) : <div className="empty-show-library"><strong>No cloud shows in this folder</strong><span>Select a folder, refresh, or save the current Show while Cloud Relay is connected.</span></div>}</div>
          </section>
        </div>}

        {showMode === 'sync' && <div className="show-sync-v3">
          <section className="console-panel sync-status-card transport-engine-card"><header><div><span>TRANSPORT ENGINE</span><h2>Shared Playhead Authority</h2></div><b className={sharedTransport.playing?'healthy':''}>{sharedTransport.playing?'RUNNING':'READY'}</b></header><div className="sync-metrics"><span><small>OWNER</small><strong>{sharedTransport.source.toUpperCase()}</strong></span><span><small>POSITION</small><strong>{formatShowTime(sharedTransport.positionMs)}</strong></span><span><small>BPM</small><strong>{sharedTransport.bpm.toFixed(1)}</strong></span><span><small>REVISION</small><strong>R{sharedTransport.revision}</strong></span></div><p>One transport authority now arbitrates Timeline, Studio, MIDI, Ableton, LumaLive, Tracks, and ProPresenter. Local/Timeline control wins immediately; external sources cannot silently steal a live playhead lease.</p><button onClick={()=>{const result=transportEngineRef.current!.forceLocal({playing:false,positionMs:externalSongPositionMsRef.current,bpm:masterTempoBpm});setSharedTransport(result.state);setExternalTransportRunning(false);externalTransportRunningRef.current=false;setMessage('Transport authority returned to LumaRig.');}}>Take Local Authority</button></section>
          <section className="console-panel sync-status-card connection-manager-card"><header><div><span>CONNECTION MANAGER</span><h2>Inputs + Integrations</h2></div><b>{connectionRecords.filter(item=>item.status==='connected').length} LIVE</b></header><div className="connection-registry-list">{connectionRecords.map(item=><article key={item.id} className={'connection-registry-item '+item.status}><span><strong>{item.name}</strong><small>{item.capabilities.join(' · ')}</small></span><span><b>{item.status.toUpperCase()}</b><small>{item.detail || item.lastError || 'Not connected'}</small></span></article>)}</div></section>
          <section className="console-panel sync-status-card lumalive-sync-card">
            <header><div><span>LUMALIVE · ABLETON</span><h2>Paired Transport</h2></div><b className={lumaLiveConnection && !lumaLiveError?'healthy':''}>{lumaLiveConnection ? lumaLiveError ? 'DEGRADED' : 'PAIRED' : lumaLiveEndpoint ? 'FOUND' : 'OFFLINE'}</b></header>
            <div className="sync-metrics">
              <span><small>LUMALIVE</small><strong>{lumaLiveState ? 'CONNECTED' : lumaLiveConnection ? 'CHECKING' : '—'}</strong></span>
              <span><small>ABLETON</small><strong>{lumaLiveState?.bridgeConnected ? 'CONNECTED' : lumaLiveConnection ? 'OFFLINE' : '—'}</strong></span>
              <span><small>BPM</small><strong>{lumaLiveState?.tempo?.toFixed(1) ?? '—'}</strong></span>
              <span><small>POSITION</small><strong>{lumaLiveState ? formatShowTime(lumaLivePositionMs(lumaLiveState)) : '—'}</strong></span>
            </div>
            {lumaLiveState && <div className="lumalive-now"><strong>{lumaLiveState.currentSongTitle || 'Ableton transport'}</strong><span>{lumaLiveState.currentSectionName || (lumaLiveState.playing ? 'Playing' : 'Stopped')}</span></div>}
            {!lumaLiveConnection && <>
              <div className="settings-actions"><button disabled={lumaLiveBusy} onClick={()=>void detectLumaLive()}>{lumaLiveBusy?'Scanning…':'Detect LumaLive'}</button></div>
              {lumaLiveEndpoint && <div className="lumalive-pair-row"><input inputMode="numeric" maxLength={6} value={lumaLivePairCode} placeholder="6-digit code" onChange={event=>setLumaLivePairCode(event.target.value.replace(/\D/g,'').slice(0,6))}/><button className="console-primary" disabled={lumaLiveBusy||lumaLivePairCode.length!==6} onClick={()=>void pairDetectedLumaLive()}>Pair</button></div>}
            </>}
            {lumaLiveConnection && <div className="settings-actions"><button className="console-primary" onClick={()=>void controlLumaLive('start_playback')}>Play Ableton</button><button onClick={()=>void controlLumaLive('stop_playback')}>Stop Ableton</button><button onClick={()=>void detectLumaLive()}>Rescan</button><button className="danger-outline" onClick={forgetLumaLive}>Forget Pairing</button></div>}
            {lumaLiveError && <p className="artnet-error">{lumaLiveError}</p>}
            <small>LumaLive remains the Ableton owner. LumaRig follows its authenticated transport instead of creating a second competing LiveAPI controller.</small>
          </section>
          <section className="console-panel sync-status-card"><header><div><span>LUMASTUDIO</span><h2>Transport Authority</h2></div><b className={studioBridgeStatus.connectedClients>0?'healthy':''}>{studioBridgeStatus.connectedClients>0?'CONNECTED':studioBridgeStatus.listening?'READY':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>PORT</small><strong>{studioBridgeStatus.port}</strong></span><span><small>CLIENTS</small><strong>{studioBridgeStatus.connectedClients}</strong></span><span><small>TRANSPORT</small><strong>{externalTransportRunning?'FOLLOWING':'LOCAL'}</strong></span><span><small>AUTHORITY</small><strong>RIG LIGHTING</strong></span></div><p>Studio controls transport and song position. LumaRig keeps authority over cue execution, FX and DMX output.</p></section>
          <section className="console-panel sync-status-card"><header><div><span>MIDI</span><h2>Clock + Transport</h2></div><b className={midiStatus.connected?'healthy':''}>{midiStatus.connected?'CONNECTED':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>INPUT</small><strong>{midiStatus.input_name || '—'}</strong></span><span><small>CLOCK</small><strong>{midiClockSeen?'SEEN':'WAITING'}</strong></span><span><small>BPM</small><strong>{midiBpm || effectBpm}</strong></span><span><small>MESSAGES</small><strong>{midiStatus.messages_received}</strong></span></div><button onClick={()=>{setWorkspace('build');setSetupView('settings');}}>Open Connections</button></section>
          <section className="console-panel sync-status-card propresenter-sync-card">
            <header><div><span>PROPRESENTER</span><h2>API + Video Feed</h2></div><b className={proPresenterStatus&&!proPresenterError?'healthy':''}>{proPresenterStatus ? proPresenterError ? 'DEGRADED' : 'CONNECTED' : 'OFFLINE'}</b></header>
            <div className="propresenter-connect-row"><input value={proPresenterUrl} onChange={event=>setProPresenterUrl(event.target.value)} placeholder="http://127.0.0.1:50001"/><button disabled={proPresenterBusy} onClick={()=>void detectProPresenter()}>{proPresenterBusy?'Checking…':'Connect API'}</button></div>
            {proPresenterStatus && <><div className="sync-metrics"><span><small>PRESENTATION</small><strong>{proPresenterSummary(proPresenterStatus).presentation || 'Active'}</strong></span><span><small>SLIDE</small><strong>{proPresenterSummary(proPresenterStatus).current || '—'}</strong></span><span><small>VIDEO</small><strong>{stageVideoInputs.length?'INPUT READY':'SCAN INPUTS'}</strong></span><span><small>API</small><strong>LOCAL</strong></span></div><div className="settings-actions"><button onClick={()=>void controlProPresenter('previous')}>Previous</button><button className="console-primary" onClick={()=>void controlProPresenter('next')}>Next</button><button onClick={()=>void controlProPresenter('play')}>Play Media</button><button onClick={()=>void controlProPresenter('pause')}>Pause Media</button><button onClick={()=>void controlProPresenter('timeline-play')}>Play Timeline</button><button onClick={()=>void controlProPresenter('timeline-pause')}>Pause Timeline</button></div></>}
            {proPresenterError && <p className="artnet-error">{proPresenterError}</p>}
            <small>Control uses ProPresenter's local HTTP API. Visual content still reaches LumaRig screens through the NDI / virtual-video-input route.</small>
          </section>
          <section className="console-panel sync-status-card"><header><div><span>LUMAVIZ</span><h2>Preview + Shared Show</h2></div><b className={directStatus.clients>0?'healthy':''}>{directStatus.clients>0?'CONNECTED':directStatus.listening?'READY':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>DIRECT PORT</small><strong>{directStatus.port}</strong></span><span><small>CLIENTS</small><strong>{directStatus.clients}</strong></span><span><small>FRAMES</small><strong>{directStatus.framesSent}</strong></span><span><small>LOCATION</small><strong>{activeLocation?.name || '—'}</strong></span></div></section>
          <section className="console-panel external-track-console sync-track-card"><header><div><span>SYNC OFFSET</span><h2>{externalTrack.songName || 'Active Song'}</h2></div><b>{externalTrack.lightingOffsetMs} ms</b></header><label><span>Lighting Advance / Delay</span><input type="range" min="-5000" max="5000" step="10" value={externalTrack.lightingOffsetMs} onChange={(event)=>updateExternalTrack({lightingOffsetMs:Number(event.target.value)})}/></label><div className="inspector-pair"><label><span>BPM</span><input type="number" value={externalTrack.bpm} onChange={(event)=>updateExternalTrack({bpm:Number(event.target.value)})}/></label><label><span>Take</span><select value={externalTrack.recordingId} onChange={(event)=>assignExternalRecording(event.target.value)}><option value="">None</option>{showFile.recordings?.map((recording)=><option key={recording.id} value={recording.id}>{recording.name}</option>)}</select></label></div><button className={externalTrack.armed?'danger-button':'console-primary'} onClick={toggleExternalTrackArm}>{externalTrack.armed?'DISARM':'ARM SYNC'}</button></section>
        </div>}

        {showMode === 'recordings' && <div className="recordings-console-v3">
          <section className="console-panel recording-source"><label>Song from Library<select aria-label="Recording Song Library" value={activeSongId} disabled={showRecordingActive} onChange={e=>{pauseRecorderTransport();setSelectedRecordingId('');pausedTakeRef.current=null;const song=songBank.find(s=>s.id===e.target.value);if(song)void selectBankSong(song);else{const program=songLibrary.find(p=>'library:'+p.id===e.target.value);if(program)void chooseRecordingLibrarySong(program);}}}><option value="">Choose Song</option>{songBank.map(song=><option key={song.id} value={song.id}>{song.name}</option>)}{songLibrary.filter(p=>!songBank.some(s=>s.libraryId===p.id)).map(p=><option key={p.id} value={'library:'+p.id}>{p.show.name} · Saved Library</option>)}</select></label>
          <label>Lighting take<select aria-label="Recording lighting take" disabled={showRecordingActive} value={selectedRecordingId} onChange={e=>{pauseRecorderTransport();setSelectedRecordingId(e.target.value);pausedTakeRef.current=null;setShowTrackPositionMs(0);}}><option value="">Live capture / Song media</option>{showFile.recordings?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <RecorderTransport audioRef={showTrackAudioRef} position={showRecordingActive?showRecordingElapsedMs:showTrackPositionMs} duration={showFile.recordings?.find(t=>t.id===selectedRecordingId)?.durationMs ?? showTrackDurationMs} bpm={masterTempoBpm} beatsPerBar={editingTimeline.beatsPerBar} recording={showRecordingActive} paused={recordingPaused} onBpm={setMasterTempo} onPlay={playRecorderTransport} onPause={pauseRecorderTransport} onSeek={seekRecorderTransport} onStop={()=>{if(showRecordingActive)stopShowRecording(true);else{pauseRecorderTransport();seekRecorderTransport(0);}}} />
          <button onClick={()=>{setWorkspace('live');}}>Open Live controls</button></section>
          <section className="console-panel recording-command"><header><div><span>SHOW RECORDER</span><h2>Capture live lighting performance</h2></div><b>{showFile.recordings?.length ?? 0} TAKES</b></header><div className="recording-arm-row"><input value={recordingTakeName} placeholder={`Take ${(showFile.recordings?.length ?? 0)+1}`} onChange={(event)=>setRecordingTakeName(event.target.value)}/><button className="record-button" onClick={startShowRecording}>● RECORD SHOW</button></div><small>Records resolved lighting changes so the take can be replayed locally or driven by LumaStudio / MIDI transport.</small></section>
          <section className="console-panel recorded-takes-console"><header><div><span>LIGHTING TAKES</span><h2>Saved Performances</h2></div></header>{showFile.recordings?.length?showFile.recordings.map((recording)=><article key={recording.id}><span><strong>{recording.name}</strong><small>{formatShowTime(recording.durationMs)} · {recording.frames.length} changes</small></span><button className={playingRecordingId===recording.id?'console-primary':''} onClick={()=>playingRecordingId===recording.id?stopRecordedShowPlayback():playShowRecording(recording)}>{playingRecordingId===recording.id?'Stop':'Play'}</button><button onClick={()=>void importTakeAsSongVersion(recording)}>Use as Song Version</button><button onClick={()=>assignExternalRecording(recording.id)}>Assign to Sync</button><button className="danger-button" onClick={()=>deleteShowRecording(recording)}>Delete</button></article>):<div className="empty-cues"><strong>No recordings yet</strong><span>Arm the recorder and perform the show from LIVE.</span></div>}</section>
        </div>}
      </section>}

      {workspace === 'live' && <section className={`live-console live-console-v3 ${liveView === 'performance' ? 'controller-live-view' : ''}`}>
        {liveView !== 'performance' && <header className="live-command-bar">
          <div className="live-show-state"><small>LIVE PERFORMANCE</small><strong>{showFile.name}</strong><span>{dmxStatus.blackout ? 'BLACKOUT ACTIVE' : liveEffectLabel ? `FX · ${liveEffectLabel}` : 'LOCAL CONTROL'}</span></div>
          <div className="live-cue-deck">
            <button className="live-back" onClick={goPreviousCue}>BACK</button>
            <div className="live-cue-card current"><small>CURRENT</small><strong>{activeCue?.name ?? 'Ready'}</strong><span>{activeCue ? `Cue ${activeCue.number}` : 'No cue running'}</span></div>
            <button className="live-go-v3" onClick={goNextCue} disabled={!nextCue}><b>GO</b><small>{nextCue?.name ?? 'END'}</small></button>
            <div className="live-cue-card next"><small>NEXT</small><strong>{nextCue?.name ?? 'End of show'}</strong><span>{nextCue ? `Cue ${nextCue.number}` : '—'}</span></div>
          </div>
          <button className={`live-blackout-v3 ${dmxStatus.blackout?'active':''}`} onClick={toggleBlackout}>{dmxStatus.blackout?'RELEASE':'BLACKOUT'}</button>
        </header>}

        <nav className="live-view-tabs">{([
          ['performance','Controller'],['overrides','Fixtures'],['groups','Groups'],['masters','Masters'],['shortcuts','Shortcuts'],['settings','System']
        ] as Array<[LiveView,string]>).map(([id,label])=><button key={id} className={liveView===id?'active':''} onClick={()=>setLiveView(id)}>{label}</button>)}</nav>

        {liveView === 'performance' && <DesktopLiveController
          key={showFile.name}
          showName={showFile.name}
          bpm={masterTempoBpm}
          currentCue={activeCue?.name ?? 'READY'}
          currentCueNumber={activeCue?.number}
          nextCue={nextCue?.name}
          blackout={dmxStatus.blackout}
          outputHealthy={!dmxStatus.last_error}
          dmxConnected={dmxStatus.connected}
          master={globalMaster}
          fxSpeed={Math.max(0, Math.min(100, Math.round(((masterTempoBpm)-30)/2.1)))}
          fxDepth={effectDepth}
          fixtures={patch.map((fixture)=>{const values=fixtureValues(outputUniverse,fixture);return {
            id:fixture.id,
            name:fixture.name,
            subtitle:fixtureBrowserSubtitle(fixture),
            intensity:fixtureIntensityPercent(universe,fixture)??0,
            outputIntensity:fixtureIntensityPercent(outputUniverse,fixture)??0,
            color:(values.red+values.green+values.blue)>0?rgbToHex(values.red,values.green,values.blue):(fixture.labelColor??'#55e98d'),
            selected:fixture.selected
          };})}
          groups={fixtureGroups.map((group)=>({
            id:group.id,
            name:group.name,
            fixtureIds:fixturesInGroup(patch,group).map((fixture)=>fixture.id),
            intensity:Math.round(groupMasters[group.id]??group.masterDefault),
            color:group.labelColor,
            selected:selectedGroupId===group.id
          }))}
          looks={allLooks.map((look)=>({id:look.id,name:look.name,color:rgbToHex(look.values.red,look.values.green,look.values.blue)}))}
          effects={[
            ...EFFECT_PRESETS.map((effect)=>({
              id:effect.id,
              name:effect.name,
              active:activeEffect===effect.id,
              momentary:effect.momentary,
              color:effect.id==='blinder'?'#ffffff':effect.id==='lightning'?'#c9dcff':effect.id==='rainbow'||effect.id==='color-chase'?'#bc36ff':'#e0a24f'
            })),
            ...customEffects.map((effect)=>({
              id:effect.id,
              name:effect.name,
              active:activeCustomEffectId===effect.id,
              momentary:false,
              color:'#55e98d'
            })),
            ...FX_RECIPES.map(recipe=>({id:'recipe:'+recipe.id,name:recipe.name,active:activeCustomEffectId==='recipe:'+recipe.id,momentary:false,color:'#77cfef'})),
          ]}
          onGo={goNextCue}
          onBack={goPreviousCue}
          onBlackout={toggleBlackout}
          onMaster={applyGlobalMaster}
          onFxSpeed={(value)=>setMasterTempo(Math.round(30+(value/100)*210))}
          onFxDepth={(value)=>{setEffectDepth(value);effectDepthRef.current=value;}}
          onSelectFixtures={(fixtureIds,mode)=>void dispatchControl({type:'fixture.select',fixtureIds,mode},'surface')}
          onFixtureLevel={(fixtureId,value)=>{const fixture=patch.find((item)=>item.id===fixtureId);if(fixture)void setFixtureAttribute(fixture,'dimmer',percentToDmx(value),'surface');}}
          onGroupLevel={(groupId,value)=>{const group=fixtureGroups.find((item)=>item.id===groupId);if(group)applyGroupMaster(group,value);}}
          onFlashFixtures={(fixtureIds,active)=>void dispatchControl({type:'fixture.flash.set',fixtureIds,active},'surface')}
          onLook={(lookId)=>{const look=allLooks.find((item)=>item.id===lookId);if(look)runLook(look);}}
          onEffectPress={(effectId,momentary)=>{
            const targets=selectedFixtureTargets.map((fixture)=>fixture.id);
            const effect=EFFECT_PRESETS.find((item)=>item.id===effectId);
            if(effect){if(momentary)startMomentaryEffect(effect.id,targets);else toggleEffect(effect.id,targets);return;}
            const recipe=FX_RECIPES.find(item=>'recipe:'+item.id===effectId);
            if(recipe){runCustomFx({...structuredClone(recipe.effect),id:effectId},targets);return;}
            const custom=customEffects.find((item)=>item.id===effectId);
            if(custom)runCustomFx(custom,targets);
          }}
          onEffectRelease={(effectId)=>{const effect=EFFECT_PRESETS.find((item)=>item.id===effectId);if(effect)releaseMomentaryEffect(effect.id);}}
          onStopFx={()=>stopEffect()}
          onColor={applyGlobalColor}
          onSelectedLevel={(value)=>selectedFixtureTargets.forEach((fixture)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value),'surface'))}
        />}

        {liveView === 'overrides' && <div className="live-detail-view">
          <header><div><span>FIXTURE OVERRIDES</span><h2>Direct live control</h2></div><div><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></div></header>
          <div className="override-layout"><FixtureFaderBank>{patch.map((fixture)=>{const v=fixtureValues(outputUniverse,fixture);const outputColor=(v.red+v.green+v.blue)>0?rgbToHex(v.red,v.green,v.blue):(fixture.labelColor ?? '#55e98d');return <VerticalFader key={fixture.id} id={`override-${fixture.id}`} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={outputColor} value={fixtureIntensityPercent(universe,fixture)} selected={fixture.selected} onChange={(value)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value))} onSelect={()=>selectFixtureFromConsole(fixture.id,true)} onFx={()=>{setWorkspace('create');setProgramMode('fx');}}/>})}</FixtureFaderBank><aside><ColorDeck title="OVERRIDE COLOR" subtitle={selectedFixtureTargets.length?`${selectedFixtureTargets.length} selected`:'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length===0} presets={consoleColorPresets} onChange={applyGlobalColor}/><button className="console-primary" onClick={()=>{setWorkspace('create');setProgramMode('stage');}}>OPEN FULL PROGRAMMER</button></aside></div>
        </div>}

        {liveView === 'groups' && <div className="live-detail-view">
          <header><div><span>GROUPS</span><h2>Live group masters + FX</h2></div></header>
          <div className="group-live-bank">{fixtureGroups.map((group)=>{const members=fixturesInGroup(patch,group);const first=members[0];const v=first?fixtureValues(outputUniverse,first):null;const outputColor=v&&(v.red+v.green+v.blue)>0?rgbToHex(v.red,v.green,v.blue):group.labelColor;return <section key={group.id} className={selectedGroupId===group.id?'selected':''}><VerticalFader id={`group-live-${group.id}`} name={group.name} subtitle={`${members.length} fixtures`} color={outputColor} value={Math.round(groupMasters[group.id] ?? group.masterDefault)} selected={selectedGroupId===group.id} onChange={(value)=>applyGroupMaster(group,value)} onSelect={()=>selectFixtureGroup(group.id)} onFx={()=>selectFixtureGroup(group.id)} quickAction={{label:'Chase',onPress:()=>toggleEffect('chase',members.map((fixture)=>fixture.id))}}/><div className="group-live-actions"><button onClick={()=>selectFixtureGroup(group.id)}>SELECT</button><button onClick={()=>{selectFixtureGroup(group.id);applyGroupColor(group,globalColor);}}>COLOR</button><button onClick={()=>toggleEffect('pulse',members.map((fixture)=>fixture.id))}>PULSE</button><button onClick={()=>toggleEffect('chase',members.map((fixture)=>fixture.id))}>CHASE</button></div></section>;})}</div>
        </div>}

        {liveView === 'masters' && <div className="live-detail-view live-masters-view">
          <header><div><span>MASTER CONTROLS</span><h2>Output authority</h2></div><button className={`live-blackout-v3 ${dmxStatus.blackout?'active':''}`} onClick={toggleBlackout}>{dmxStatus.blackout?'RELEASE BLACKOUT':'BLACKOUT'}</button></header>
          <div className="master-control-grid"><section><span>GRAND MASTER</span><strong>{globalMaster}%</strong><input type="range" min="0" max={settings.masterLimit} value={globalMaster} onChange={(event)=>applyGlobalMaster(Number(event.target.value))}/><div>{[0,10,25,50,75,100].map((value)=><button key={value} onClick={()=>applyGlobalMaster(value)}>{value}%</button>)}</div></section>{fixtureGroups.map((group)=><section key={group.id}><span>{group.name.toUpperCase()}</span><strong>{Math.round(groupMasters[group.id] ?? group.masterDefault)}%</strong><input type="range" min="0" max="100" value={Math.round(groupMasters[group.id] ?? group.masterDefault)} onChange={(event)=>applyGroupMaster(group,Number(event.target.value))}/><div><button onClick={()=>applyGroupMaster(group,0)}>0</button><button onClick={()=>applyGroupMaster(group,50)}>50</button><button onClick={()=>applyGroupMaster(group,100)}>FULL</button></div></section>)}</div>
        </div>}

        {liveView === 'shortcuts' && <div className="live-detail-view">
          <header><div><span>SHORTCUTS + CONTROL MAPPING</span><h2>Keyboard and MIDI</h2></div><b>{midiMappings.length} MIDI MAPPINGS</b></header>
          <div className="shortcut-grid"><section><h3>KEYBOARD</h3><div className="shortcut-row"><kbd>SPACE</kbd><span>GO / next cue</span></div><div className="shortcut-row"><kbd>→</kbd><span>GO / next cue</span></div><div className="shortcut-row"><kbd>←</kbd><span>BACK / previous cue</span></div><div className="shortcut-row"><kbd>ESC</kbd><span>Close active calibration panel</span></div></section><section><h3>MIDI ASSIGNER</h3><div className="midi-add-row"><select value={newMidiTarget} onChange={(event)=>setNewMidiTarget(event.target.value)}>{midiControlGroups.map(([group,controls])=><optgroup key={group} label={group}>{controls.map((control)=><option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}</select><button className="console-primary" onClick={()=>beginMidiAssignment()}>ADD + LEARN</button></div><div className="midi-map-list">{midiMappings.map((mapping)=>{const control=midiControls.find((item)=>item.id===mapping.target);const learning=midiLearnMappingId===mapping.id;return <div className={`midi-map-row ${learning?'is-learning':''}`} key={mapping.id}><strong>{control?.label ?? 'Unavailable'}</strong><span>{learning?'Move or press a control…':midiBindingLabel(mapping)}</span><button onClick={()=>setMidiLearnMappingId(learning?null:mapping.id)}>{learning?'Cancel':'Learn'}</button><button onClick={()=>removeMidiAssignment(mapping.id)}>Remove</button></div>;})}</div></section></div>
        </div>}

        {liveView === 'settings' && <div className="live-detail-view">
          <header><div><span>LIVE SYSTEM STATUS</span><h2>Connections + safety</h2></div><button onClick={()=>{setWorkspace('build');setSetupView('settings');}}>OPEN CONNECTIONS</button></header>
          <div className="live-settings-grid"><section className={dmxStatus.connected?'healthy':''}><span>DMX OUTPUT</span><strong>{dmxStatus.connected?'CONNECTED':'VIRTUAL OUTPUT'}</strong><small>{dmxStatus.device_name || 'No physical interface'}</small></section><section className={directStatus.clients>0?'healthy':''}><span>LUMAVIZ</span><strong>{directStatus.clients>0?'CONNECTED':'READY'}</strong><small>{directStatus.framesSent.toLocaleString()} frames sent</small></section><section className={studioBridgeStatus.connectedClients>0?'healthy':''}><span>LUMASTUDIO</span><strong>{studioBridgeStatus.connectedClients>0?'CONNECTED':'READY'}</strong><small>{studioBridgeStatus.connectedClients} client(s)</small></section><section className={midiStatus.connected?'healthy':''}><span>MIDI</span><strong>{midiStatus.connected?'CONNECTED':'OFFLINE'}</strong><small>{midiStatus.input_name || 'No input'}</small></section><section><span>MASTER LIMIT</span><strong>{settings.masterLimit}%</strong><small>Configured output ceiling</small></section><section className={dmxStatus.blackout?'danger':''}><span>BLACKOUT</span><strong>{dmxStatus.blackout?'ACTIVE':'CLEAR'}</strong><small>Output safety state</small></section></div>
        </div>}

        <footer className="live-system-strip"><span className={dmxStatus.connected?'healthy':''}>● DMX {dmxStatus.connected?'ONLINE':'VIRTUAL'}</span><span className={directStatus.clients>0?'healthy':''}>● VIZ {directStatus.clients>0?'LINKED':'WAITING'}</span><span className={studioBridgeStatus.connectedClients>0?'healthy':''}>● STUDIO {studioBridgeStatus.connectedClients>0?'LINKED':'WAITING'}</span><span className={midiStatus.connected?'healthy':''}>● MIDI {midiStatus.connected?'ONLINE':'OFF'}</span><span>{liveEffectLabel?`FX ${liveEffectLabel.toUpperCase()}`:'FX IDLE'}</span><b>{formatShowTime(externalSongPositionMs || showTrackPositionMs)}</b></footer>
      </section>}

      {midiMapOpen&&<div className="midi-map-modal" role="dialog" aria-modal="true" aria-label="MIDI mapping"><button className="modal-scrim" aria-label="Close MIDI mapping" onClick={()=>setMidiMapOpen(false)}/><div className="midi-map-dialog"><button onClick={()=>setMidiMapOpen(false)}>Close MIDI Map</button><section className="console-panel midi-mapping-console"><header><div><span>MIDI ASSIGNER</span><h2>Map controls</h2></div><b>{midiMappings.length} mappings</b></header><div className="midi-add-row"><select value={newMidiTarget} onChange={(event) => setNewMidiTarget(event.target.value)}>{midiControlGroups.map(([group, controls]) => <optgroup key={group} label={group}>{controls.map((control) => <option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}</select><button className="console-primary" onClick={() => beginMidiAssignment()}>Add + Learn</button></div><div className="midi-map-list">{midiMappings.map((mapping) => { const control = midiControls.find((item) => item.id === mapping.target); const learning = midiLearnMappingId === mapping.id; return <div className={`midi-map-row ${learning ? 'is-learning' : ''}`} key={mapping.id}><strong>{control?.label ?? 'Unavailable'}</strong><span>{learning ? 'Move or press a control…' : midiBindingLabel(mapping)}</span><button onClick={() => setMidiLearnMappingId(learning ? null : mapping.id)}>{learning ? 'Cancel' : 'Learn'}</button><button onClick={() => removeMidiAssignment(mapping.id)}>Remove</button></div>; })}</div></section></div></div>}
      {stageMonitorOpen&&<StageMonitor floating snapshot={stageSnapshot} onClose={()=>setStageMonitorOpen(false)}/>}
      <div className="workspace-utility-bar"><button onClick={()=>setStageMonitorOpen(v=>!v)}>Visualizer</button><button onClick={()=>setMidiMapOpen(true)}>MIDI Map</button></div>
      <footer className="console-footer console-status-strip">
        <div className="status-connections">
          <button className={dmxStatus.connected ? 'healthy' : ''} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i />DMX <b>{dmxStatus.connected ? 'ONLINE' : 'VIRTUAL'}</b></button>
          <button className="healthy" onClick={() => setWorkspace('visualizer')}><i />VISUALIZER <b>READY</b></button>
          <button className={studioBridgeStatus.connectedClients > 0 ? 'healthy' : ''} onClick={() => { setWorkspace('show'); setShowMode('sync'); }}><i />STUDIO <b>{studioBridgeStatus.connectedClients > 0 ? 'LINKED' : 'READY'}</b></button>
          <button className={midiStatus.connected ? 'healthy' : ''} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i />MIDI <b>{midiStatus.connected ? 'ONLINE' : 'OFF'}</b></button>
        </div>
        <span className="status-message">{dmxStatus.last_error || midiStatus.last_error || message}</span>
        <div className="status-show-readout"><span>U1</span><span>40 HZ</span><span>{patch.length} FXT</span><span>{showFile.cues.length} CUES</span>{isFading && <span className="attention">FADING</span>}<b>{formatShowTime(externalSongPositionMs || showTrackPositionMs)}</b></div>
      </footer>
    </main>
  );

}
