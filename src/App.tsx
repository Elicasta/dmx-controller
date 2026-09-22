import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { drainLumaVizStageChanges, lumaVizDirectStatus, lumaVizPreviewFrame, semanticFrameFromResolvedOutput, sendLumaVizDirectFrame, sendLumaVizStageChange, startLumaVizDirect, type LumaVizDirectStatus } from './core/lumaviz-direct';
import { invoke } from '@tauri-apps/api/core';
import {
  applyUniverseUpdates,
  clampDmx,
  interpolateUniverse,
  makeUniverse,
  VISIBLE_CHANNELS,
  type DmxUpdate
} from './lib/dmx';
import { EFFECT_PRESETS, EFFECT_SHAPES, effectWaveValue, renderEffect, renderCustomEffect, type CustomEffect, type EffectId, type EffectParameter, type EffectPreset, type EffectWaveform } from './lib/effects';
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
  diffUniverse,
  EMPTY_SHOW,
  isShowFile,
  MAX_RECORDING_FRAMES,
  midiSongPositionToMs,
  moveCue,
  sanitizeShow,
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
import {
  STAGE_ELEMENT_LIBRARY,
  clampStageElement,
  isStageDocument,
  isStageElement,
  makeStageDocument,
  makeStageElement,
  migrateStageElement,
  stageElementPosition,
  type StageElement,
  type StageElementType
} from './lib/stage';
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
import { RemoteRelay, type RelayCommandEnvelope, type RemoteRelayConfig, type RemoteRelayStatus } from './core/remote-relay';
import { canAutoApplyDangerousChange, decideIncomingChange, hasRevisionConflict, DEFAULT_STAGE_SYNC_POLICY, type StageChange, type StageSyncPolicy } from './core/stage-sync';
import type { StageSyncMode } from './core/stage-model';

type Workspace = 'setup' | 'program' | 'show' | 'live';

const WORKSPACE_LABELS: Record<Workspace, string> = { setup: 'CREATE', program: 'PROGRAM', show: 'SHOW', live: 'LIVE' };
type SetupView = 'fixtures' | 'groups' | 'patch' | 'stage' | 'settings';
type ProgramMode = 'stage' | 'faders' | 'groups' | 'fx';
type ControlSurfaceMode = 'encoders' | 'faders' | 'xy' | 'palettes';
type ControlSurfaceTab = 'intensity' | 'color' | 'position' | 'beam' | 'gobo' | 'fx' | 'speed';
type InspectorTab = 'inspector' | 'history' | 'sync';
type ShowMode = 'cues' | 'tracks' | 'library';
type LiveBank = 'fixtures' | 'groups';
type LiveView = 'performance' | 'fixtures' | 'groups' | 'masters' | 'shortcuts';

type ShowProjectSnapshot = {
  id: string;
  name: string;
  savedAt: string;
  status: 'draft' | 'show';
  show: ShowFile;
  patch: PatchedFixture[];
  stageElements: StageElement[];
  stageSettings: StageSettings;
  looks: FixtureLook[];
};
type StageDesignerMode = 'select' | 'move' | 'rotate' | 'aim' | 'measure' | 'target' | 'patch';

function initialConsoleValue<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = new URLSearchParams(window.location.search).get(key) as T | null;
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

const STATUS_POLL_MS = 350;
const MIDI_POLL_MS = 35;
const FRAME_MS = 25;
const RECORDING_SAMPLE_MS = 50;
const LOOKS_STORAGE_KEY = 'dmx-controller.saved-looks.v1';
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
const REMOTE_RELAY_STORAGE_KEY = 'dmx-controller.remote-relay.v1';
const FADE_TIMES = [0, 500, 1000, 2000, 5000] as const;

const DEFAULT_SETTINGS: AppSettings = {
  masterLimit: 100,
  confirmBlackoutRelease: false,
  audioSensitivity: 58,
  visualizerArtNetEnabled: false,
  visualizerArtNetTarget: '127.0.0.1'
};

const COLOR_PRESETS = [
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

function loadShowFile(): ShowFile {
  if (typeof window === 'undefined') return { ...EMPTY_SHOW, cues: [], groups: [], positionPalettes: [] };
  try {
    const raw = window.localStorage.getItem(SHOW_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw || 'null');
    if (isShowFile(parsed)) {
      if (parsed.version < 3 && raw && !window.localStorage.getItem(SHOW_BACKUP_STORAGE_KEY)) {
        window.localStorage.setItem(SHOW_BACKUP_STORAGE_KEY, raw);
      }
      return sanitizeShow(parsed);
    }
  } catch { /* preserve the stored value and start with a known-good show */ }
  return { ...EMPTY_SHOW, cues: [], groups: [], positionPalettes: [] };
}

function loadShowLibrary(): ShowProjectSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SHOW_LIBRARY_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ShowProjectSnapshot => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<ShowProjectSnapshot>;
      return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.savedAt === 'string'
        && (candidate.status === 'draft' || candidate.status === 'show')
        && Boolean(candidate.show && isShowFile(candidate.show))
        && Array.isArray(candidate.patch)
        && candidate.patch.every(isPatchedFixture)
        && Array.isArray(candidate.stageElements)
        && candidate.stageElements.every(isStageElement)
        && Array.isArray(candidate.looks)
        && candidate.looks.every(isFixtureLook)
        && Boolean(candidate.stageSettings);
    }).slice(0, 40);
  } catch {
    return [];
  }
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
        window.localStorage.setItem(PATCH_BACKUP_STORAGE_KEY, raw);
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
    && [dimensions?.width, dimensions?.depth, dimensions?.height, dimensions?.trimHeight, dimensions?.roomWidth, dimensions?.roomDepth, dimensions?.roomHeight]
      .every((part) => typeof part === 'number' && Number.isFinite(part) && part > 0);
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
    url: import.meta.env.VITE_SUPABASE_URL || '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
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
        window.localStorage.setItem(STAGE_BACKUP_STORAGE_KEY, raw);
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
  const [workspace, setWorkspace] = useState<Workspace>(() => initialConsoleValue('workspace', ['setup', 'program', 'show', 'live'], 'program'));
  const [setupView, setSetupView] = useState<SetupView>(() => initialConsoleValue('setup', ['fixtures', 'groups', 'patch', 'stage', 'settings'], 'stage'));
  const [programMode, setProgramMode] = useState<ProgramMode>(() => initialConsoleValue('program', ['stage', 'faders', 'groups'], 'faders'));
  const [showMode, setShowMode] = useState<ShowMode>(() => initialConsoleValue('show', ['cues', 'tracks'], 'cues'));
  const [fixtureSearch, setFixtureSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [universe, setUniverse] = useState<number[]>(makeUniverse);
  const universeRef = useRef<number[]>(makeUniverse());
  const [outputUniverse, setOutputUniverse] = useState<number[]>(makeUniverse);
  const outputUniverseRef = useRef<number[]>(makeUniverse());
  const [patch, setPatch] = useState<PatchedFixture[]>(loadPatch);
  const patchRef = useRef(patch);
  const [savedLooks, setSavedLooks] = useState<FixtureLook[]>(loadSavedLooks);
  const [showFile, setShowFile] = useState<ShowFile>(loadShowFile);
  const [showLibrary, setShowLibrary] = useState<ShowProjectSnapshot[]>(loadShowLibrary);
  const [liveBank, setLiveBank] = useState<LiveBank>('fixtures');
  const [liveView, setLiveView] = useState<LiveView>('performance');
  const [liveExecutorBank, setLiveExecutorBank] = useState(0);
  const [liveProgrammerOpen, setLiveProgrammerOpen] = useState(false);
  const [livePaletteFamily, setLivePaletteFamily] = useState<'groups'|'intensity'|'position'|'color'|'beam'|'fx'>('groups');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  const [artNetTelemetry, setArtNetTelemetry] = useState({ framesSent: 0, lastError: "" });
  const [directStatus, setDirectStatus] = useState<LumaVizDirectStatus>({ listening: false, port: 9460, clients: 0, framesSent: 0 });
  const [lumaVizPreview, setLumaVizPreview] = useState<{ dataUrl: string; timestamp: number; view?: string } | null>(null);
  const directSequenceRef = useRef(0);
  const [remoteRelayConfig, setRemoteRelayConfig] = useState<RemoteRelayConfig>(loadRemoteRelayConfig);
  const [remoteRelayStatus, setRemoteRelayStatus] = useState<RemoteRelayStatus>('disconnected');
  const [remoteRelayError, setRemoteRelayError] = useState('');
  const remoteRelayRef = useRef<RemoteRelay | null>(null);
  const remoteCommandHandlerRef = useRef<((envelope: RelayCommandEnvelope) => void) | null>(null);
  const remoteSnapshotHandlerRef = useRef<(() => void) | null>(null);
  const remotePublishTimerRef = useRef<number | null>(null);
  if (!remoteRelayRef.current) remoteRelayRef.current = new RemoteRelay();
  const [message, setMessage] = useState('Control station ready. Connect DMX when you want physical output.');
  const [appVersion, setAppVersion] = useState('0.2.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateMetadata | null>(null);
  const [updateError, setUpdateError] = useState('');

  const [devices, setDevices] = useState<UdmxDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [dmxStatus, setDmxStatus] = useState<DmxStatus>({ connected: false, blackout: false, usb_writes: 0, channels_sent: 0 });
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
  const effectTargetIdsRef = useRef<string[]>([]);
  const effectAnimationRef = useRef<number | null>(null);
  const effectStartedRef = useRef(0);
  const effectBaseUniverseRef = useRef<number[]>(makeUniverse());
  const momentaryEffectRef = useRef<{
    effect: EffectId;
    baseUniverse: number[];
    previousEffect: EffectId | null;
    previousTargetIds: string[];
  } | null>(null);
  const [effectBpm, setEffectBpm] = useState(120);
  const [effectDepth, setEffectDepth] = useState(100);
  const effectBpmRef = useRef(effectBpm);
  const effectDepthRef = useRef(effectDepth);
  const [tempoSource, setTempoSource] = useState<'manual' | 'midi'>('manual');
  const tempoSourceRef = useRef<'manual' | 'midi'>('manual');
  const [midiBpm, setMidiBpm] = useState<number | null>(null);
  const midiBpmRef = useRef<number | null>(null);
  const midiClockTimesRef = useRef<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);

  const [cueName, setCueName] = useState('');
  const [cueFadeMs, setCueFadeMs] = useState(1000);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const cueFollowTimerRef = useRef<number | null>(null);

  const [showTrackUrl, setShowTrackUrl] = useState('');
  const showTrackUrlRef = useRef('');
  const [showTrackName, setShowTrackName] = useState('');
  const [showTrackDurationMs, setShowTrackDurationMs] = useState(0);
  const [showTrackPositionMs, setShowTrackPositionMs] = useState(0);
  const showTrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingTakeName, setRecordingTakeName] = useState('');
  const [showRecordingActive, setShowRecordingActive] = useState(false);
  const showRecordingActiveRef = useRef(false);
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

  const [newProfileId, setNewProfileId] = useState(FIXTURE_LIBRARY[0].id);
  const [newModeId, setNewModeId] = useState(FIXTURE_LIBRARY[0].modes[0].id);
  const [newFixtureName, setNewFixtureName] = useState('');
  const [newFixtureAddress, setNewFixtureAddress] = useState(6);
  const [newFixtureQuantity, setNewFixtureQuantity] = useState(1);
  const [newFixtureGroup, setNewFixtureGroup] = useState(DEFAULT_PATCH[0].group);
  const [profileAcknowledged, setProfileAcknowledged] = useState(false);
  const [stageFixtureId, setStageFixtureId] = useState(DEFAULT_PATCH[0].id);
  const [organizerDraft, setOrganizerDraft] = useState<PatchedFixture>(DEFAULT_PATCH[0]);
  const [stageElements, setStageElements] = useState<StageElement[]>(loadStageElements);
  const [selectedStageElementId, setSelectedStageElementId] = useState<string | null>(null);
  const [stageSettings, setStageSettings] = useState<StageSettings>(loadStageSettings);
  const [stageView, setStageView] = useState<StageView>('perspective');
  const [stageMode, setStageMode] = useState<StageDesignerMode>('select');
  const stageDragRef = useRef<{ pointerId: number; kind: 'fixture' | 'element'; id: string; preserved: Vec3; moved: boolean } | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('target-center-stage');
  const [aimArrangement, setAimArrangement] = useState<TargetArrangement>('converge');
  const [aimSpreadMeters, setAimSpreadMeters] = useState(4);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [positionPaletteName, setPositionPaletteName] = useState('');
  const [positionPaletteKind, setPositionPaletteKind] = useState<'spatial' | 'absolute'>('spatial');
  const [groupMasters, setGroupMasters] = useState<Record<string, number>>({});

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
  const midiControls = useMemo(() => buildControlRegistry(patch), [patch]);
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
  const selectedFixtureTargets = selectedFixtures(patch);
  const selectedCapabilities = useMemo(() => {
    const supported = new Set<FixtureParameter>();
    selectedFixtureTargets.forEach((fixture) => findMode(fixture)?.channels.forEach((channel) => {
      if (channel.parameter) supported.add(channel.parameter);
    }));
    return supported;
  }, [selectedFixtureTargets]);
  const surfaceSupports = (tab: ControlSurfaceTab) => {
    if (!selectedFixtureTargets.length) return tab === 'intensity';
    if (tab === 'intensity') return selectedCapabilities.has('dimmer');
    if (tab === 'color') return compatibleColorFixtures(selectedFixtureTargets).length > 0 || selectedCapabilities.has('colorWheel');
    if (tab === 'position') return selectedCapabilities.has('pan') || selectedCapabilities.has('tilt');
    if (tab === 'beam') return ['zoom','focus','iris','prism'].some((parameter) => selectedCapabilities.has(parameter as FixtureParameter));
    if (tab === 'gobo') return selectedCapabilities.has('gobo') || selectedCapabilities.has('goboRotate');
    if (tab === 'fx') return selectedFixtureTargets.length > 0;
    return selectedCapabilities.has('movementSpeed') || activeEffect !== null;
  };

  useEffect(() => {
    if (JSON.stringify(showFile.groups ?? []) === JSON.stringify(fixtureGroups)) return;
    setShowFile((current) => ({ ...current, groups: fixtureGroups }));
  }, [fixtureGroups, showFile.groups]);

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
    const timer = window.setTimeout(() => window.localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(makePatchDocument(patch))), 120);
    return () => window.clearTimeout(timer);
  }, [patch]);
  useEffect(() => window.localStorage.setItem(LOOKS_STORAGE_KEY, JSON.stringify(savedLooks)), [savedLooks]);
  useEffect(() => {
    try { window.localStorage.setItem(SHOW_STORAGE_KEY, JSON.stringify(showFile)); }
    catch { setMessage('Show storage is full. Delete an older recorded take before recording another.'); }
  }, [showFile]);
  useEffect(() => {
    try { window.localStorage.setItem(SHOW_LIBRARY_STORAGE_KEY, JSON.stringify(showLibrary)); }
    catch { setMessage('Show library storage is full. Delete an older saved show or large recording.'); }
  }, [showLibrary]);
  useEffect(() => window.localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(midiMappings)), [midiMappings]);
  useEffect(() => window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)), [settings]);
  useEffect(() => {
    const { password: _password, ...safeConfig } = remoteRelayConfig;
    window.localStorage.setItem(REMOTE_RELAY_STORAGE_KEY, JSON.stringify(safeConfig));
  }, [remoteRelayConfig]);
  useEffect(() => () => { void remoteRelayRef.current?.disconnect(); }, []);
  useEffect(() => () => {
    if (remotePublishTimerRef.current !== null) window.clearTimeout(remotePublishTimerRef.current);
  }, []);
  useEffect(() => window.localStorage.setItem(STAGE_STORAGE_KEY, JSON.stringify(makeStageDocument(stageElements, stageSettings.dimensions))), [stageElements, stageSettings.dimensions]);
  useEffect(() => window.localStorage.setItem(STAGE_SETTINGS_STORAGE_KEY, JSON.stringify(stageSettings)), [stageSettings]);

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
    if (fadeAnimationRef.current !== null) window.cancelAnimationFrame(fadeAnimationRef.current);
    fadeAnimationRef.current = null;
    setIsFading(false);
  }

  function stopEffect(announce = true) {
    momentaryEffectRef.current = null;
    activeEffectRef.current = null;
    effectTargetIdsRef.current = [];
    setActiveEffect(null);
    if (effectAnimationRef.current !== null) window.cancelAnimationFrame(effectAnimationRef.current);
    effectAnimationRef.current = null;
    if (announce) setMessage('Effect stopped. The current output is held.');
  }

  async function publishRuntimeResult(result: RuntimeDispatchResult) {
    universeRef.current = result.baseFrame;
    setUniverse(result.baseFrame);
    outputUniverseRef.current = result.frame;
    setOutputUniverse(result.frame);
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
    const result = runtimeRef.current!.dispatch(controlCommand(source, command));
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
      if (activeEffectRef.current) stopEffect(false);
      if (audioArmedRef.current) setAudioArmed(false);
    }
    await dispatchControl({ type: 'frame.update', universe: 1, updates }, source);
  }

  async function setChannel(channel: number, value: number, source: ControlSource = 'ui') {
    await setChannels([[channel, value]], true, source);
  }

  async function setFixtureAttribute(fixture: PatchedFixture, parameter: FixtureParameter, value: number, source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
    await dispatchControl({ type: 'fixture.attribute', fixtureIds: [fixture.id], parameter, value }, source);
  }

  async function setFixtureColor(fixture: PatchedFixture, rgb: readonly [number, number, number], source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
    await dispatchControl({ type: 'fixture.color', fixtureIds: [fixture.id], color: { red: rgb[0], green: rgb[1], blue: rgb[2] } }, source);
  }

  function toggleFixtureSelection(fixtureId: string, source: ControlSource = 'ui') {
    void dispatchControl({ type: 'fixture.select', fixtureIds: [fixtureId], mode: 'toggle' }, source);
  }

  function fadeToUniverse(name: string, target: number[], duration: number, source: ControlSource = 'ui') {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
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

  function runLook(look: FixtureLook, duration = fadeMs) {
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

  function startEffect(effect: EffectId, requestedFixtureIds?: readonly string[]) {
    stopFade();
    stopEffect(false);
    setAudioArmed(false);
    const requested = requestedFixtureIds?.length
      ? [...requestedFixtureIds]
      : selectedFixtures(patchRef.current).map((fixture) => fixture.id);
    const targets = requested
      .map((id) => patchRef.current.find((fixture) => fixture.id === id))
      .filter((fixture): fixture is PatchedFixture => Boolean(fixture));
    if (!effectSupportedByFixtures(effect, targets)) {
      setMessage(targets.length ? 'That effect is not supported by the selected fixture capabilities.' : 'Select a fixture or group before starting an effect.');
      return;
    }
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
        void commitUniverse(applyUniverseUpdates(effectBaseUniverseRef.current, cappedHold), 'fx');
        stopEffect(false);
        setMessage('Finale complete — holding the full-white finish.');
        return;
      }
      const dimmerChannels = new Set(patchRef.current.map((fixture) => parameterChannel(fixture, 'dimmer')).filter(Boolean));
      const masterCap = percentToDmx(settingsRef.current.masterLimit);
      const updates = renderEffect(effect, effectFixtures, elapsed, bpm, effectDepthRef.current / 100)
        .map(([channel, value]) => [channel, dimmerChannels.has(channel) ? Math.min(value, masterCap) : value] as const);
      void commitUniverse(applyUniverseUpdates(effectBaseUniverseRef.current, updates), 'fx');
      effectAnimationRef.current = requestAnimationFrame(tick);
    };
    effectAnimationRef.current = requestAnimationFrame(tick);
    setMessage(`${preset?.name ?? effect} running on selected lights.`);
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
    const baseUniverse = [...universeRef.current];
    const previousEffect = activeEffectRef.current;
    const previousTargetIds = [...effectTargetIdsRef.current];
    startEffect(effect, targetIds);
    momentaryEffectRef.current = { effect, baseUniverse, previousEffect, previousTargetIds };
    const preset = EFFECT_PRESETS.find((item) => item.id === effect);
    setMessage(`${preset?.name ?? effect} held — release to restore the previous output.`);
  }

  function releaseMomentaryEffect(effect: EffectId) {
    const held = momentaryEffectRef.current;
    if (!held || held.effect !== effect) return;
    momentaryEffectRef.current = null;
    stopEffect(false);
    const preset = EFFECT_PRESETS.find((item) => item.id === effect);
    void commitUniverse(held.baseUniverse, 'fx').finally(() => {
      if (held.previousEffect) startEffect(held.previousEffect, held.previousTargetIds);
      else setMessage(`${preset?.name ?? effect} released. Previous output restored.`);
    });
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
    setEffectBpm(bpm);
    effectBpmRef.current = bpm;
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
    const cue: ShowCue = { id: `cue-${Date.now().toString(36)}`, number, name, fadeMs: cueFadeMs, fadeOutMs: cueFadeMs, delayMs: 0, followMs: 0, color: globalColor, description: '', linkedLookId: '', linkedEffectId: '', trackName: '', values: { ...primaryValues }, universe: [...universeRef.current] };
    setShowFile((current) => ({ ...current, cues: [...current.cues, cue] }));
    setCueName('');
    setMessage(`${name} captured with all ${patch.length} patched lights.`);
  }

  function runCue(cue: ShowCue) {
    if (cueFollowTimerRef.current !== null) window.clearTimeout(cueFollowTimerRef.current);
    const launch = () => {
      setActiveCueId(cue.id);
      const target = cue.universe?.length === 512 ? [...cue.universe] : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));
      void dispatchControl({ type: 'cue.go', cueId: cue.id }, 'cue');
      fadeToUniverse(`Cue ${cue.number}: ${cue.name}`, target, cue.fadeMs, 'cue');
      if (cue.linkedEffectId && EFFECT_PRESETS.some((effect) => effect.id === cue.linkedEffectId)) {
        startEffect(cue.linkedEffectId as EffectId);
      }
      if ((cue.followMs ?? 0) > 0) {
        const cueIndex = showFile.cues.findIndex((item) => item.id === cue.id);
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
    const output = [...outputUniverseRef.current];
    const outputValues = primaryFixture ? fixtureValues(output, primaryFixture) : primaryValues;
    setShowFile((current) => ({
      ...current,
      cues: current.cues.map((cue) => cue.id === id
        ? { ...cue, values: { ...outputValues }, universe: output }
        : cue)
    }));
    setMessage('Cue look updated from the actual live output.');
  }

  function updateCueProperties(id: string, updates: Partial<ShowCue>) {
    setShowFile((current) => ({
      ...current,
      cues: current.cues.map((cue) => cue.id === id ? { ...cue, ...updates } : cue)
    }));
  }

  function deleteCue(id: string) {
    setShowFile((current) => ({ ...current, cues: current.cues.filter((cue) => cue.id !== id).map((cue, index) => ({ ...cue, number: index + 1 })) }));
    if (activeCueId === id) setActiveCueId(null);
  }

  function saveShowProject(status: 'draft' | 'show' = 'show') {
    const cleanName = showFile.name.trim() || 'Untitled Show';
    const existing = showLibrary.find((item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.status === status);
    const snapshot: ShowProjectSnapshot = {
      id: existing?.id ?? `show-${Date.now().toString(36)}`,
      name: cleanName,
      savedAt: new Date().toISOString(),
      status,
      show: sanitizeShow({ ...showFile, name: cleanName }),
      patch: patch.map((fixture, index) => migratePatchedFixture(fixture, index, patch.length, stageSettings.dimensions)),
      stageElements: stageElements.map((element) => migrateStageElement(element, stageSettings.dimensions)),
      stageSettings: { ...stageSettings, dimensions: { ...stageSettings.dimensions } },
      looks: [...savedLooks]
    };
    setShowLibrary((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 40));
    setMessage(`${cleanName} saved to the show library as ${status === 'draft' ? 'a draft' : 'a show'}.`);
  }

  function loadShowProject(snapshot: ShowProjectSnapshot) {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
    setShowFile(sanitizeShow(snapshot.show));
    setPatch(snapshot.patch.map((fixture, index) => migratePatchedFixture(fixture, index, snapshot.patch.length, snapshot.stageSettings.dimensions)));
    setStageElements(snapshot.stageElements.map((element) => migrateStageElement(element, snapshot.stageSettings.dimensions)));
    setStageSettings(snapshot.stageSettings);
    setSavedLooks(snapshot.looks);
    setActiveCueId(null);
    setSelectedStageElementId(null);
    setMessage(`${snapshot.name} loaded from the show library.`);
  }

  function newShowProject() {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
    const usedNames = new Set(showLibrary.map((item) => item.name.toLowerCase()));
    let showNumber = 1;
    let nextName = 'Untitled Show';
    while (usedNames.has(nextName.toLowerCase())) {
      showNumber += 1;
      nextName = `Untitled Show ${showNumber}`;
    }
    setShowFile({ ...EMPTY_SHOW, name: nextName, cues: [], groups: [], positionPalettes: [], recordings: [], externalTrack: { ...DEFAULT_EXTERNAL_TRACK_SYNC } });
    setActiveCueId(null);
    setMessage('New show started. Your fixture patch and stage remain available until you load another saved show.');
  }

  function deleteShowProject(id: string) {
    const item = showLibrary.find((entry) => entry.id === id);
    if (!item) return;
    setShowLibrary((current) => current.filter((entry) => entry.id !== id));
    setMessage(`${item.name} removed from the show library.`);
  }

  function loadShowTrack(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    showTrackAudioRef.current?.pause();
    if (showTrackUrlRef.current) URL.revokeObjectURL(showTrackUrlRef.current);
    const url = URL.createObjectURL(file);
    showTrackUrlRef.current = url;
    setShowTrackUrl(url);
    setShowTrackName(file.name);
    setShowTrackDurationMs(0);
    setShowTrackPositionMs(0);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setRecordingTakeName(`${baseName} · Take ${(showFile.recordings?.length ?? 0) + 1}`);
    setMessage(`${file.name} loaded for show recording.`);
    event.target.value = '';
  }

  function captureShowRecordingFrame(timeMs: number) {
    if (showRecordingFramesRef.current.length >= MAX_RECORDING_FRAMES) return false;
    const next = [...outputUniverseRef.current];
    const updates = diffUniverse(showRecordingLastUniverseRef.current, next);
    if (updates.length > 0) {
      showRecordingFramesRef.current.push({ timeMs: Math.max(0, Math.round(timeMs)), updates });
      showRecordingLastUniverseRef.current = next;
    }
    return showRecordingFramesRef.current.length < MAX_RECORDING_FRAMES;
  }

  function stopShowRecording(save = true) {
    if (!showRecordingActiveRef.current) return;
    const audio = showTrackAudioRef.current;
    const durationMs = showTrackUrlRef.current && audio
      ? Math.max(showRecordingElapsedMs, audio.currentTime * 1000)
      : Math.max(showRecordingElapsedMs, performance.now() - showRecordingStartedRef.current);
    captureShowRecordingFrame(durationMs);
    showRecordingActiveRef.current = false;
    setShowRecordingActive(false);
    if (showRecordingAnimationRef.current !== null) cancelAnimationFrame(showRecordingAnimationRef.current);
    showRecordingAnimationRef.current = null;
    audio?.pause();
    setShowTrackPositionMs(durationMs);
    setWorkspace('show');
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
    setShowFile((current) => ({ ...current, recordings: [...(current.recordings ?? []), recording].slice(-24) }));
    setMessage(`${recording.name} saved with ${recording.frames.length.toLocaleString()} lighting changes.`);
  }

  function startShowRecording() {
    if (showRecordingActiveRef.current) return;
    if (playingRecordingIdRef.current) stopRecordedShowPlayback(false);
    const initialFrame: ShowRecordingFrame = {
      timeMs: 0,
      updates: outputUniverseRef.current.map((value, index) => [index + 1, value] as const)
    };
    showRecordingFramesRef.current = [initialFrame];
    showRecordingLastUniverseRef.current = [...outputUniverseRef.current];
    showRecordingStartedRef.current = performance.now();
    showRecordingLastSampleRef.current = 0;
    showRecordingActiveRef.current = true;
    setShowRecordingActive(true);
    setShowRecordingElapsedMs(0);
    const audio = showTrackAudioRef.current;
    if (audio && showTrackUrlRef.current) {
      audio.currentTime = 0;
      setShowTrackPositionMs(0);
      void audio.play().catch(() => setMessage('Lighting is recording, but macOS did not start the track. Press Stop, then try Record again.'));
    }
    const tick = (now: number) => {
      if (!showRecordingActiveRef.current) return;
      const currentAudio = showTrackAudioRef.current;
      const elapsed = showTrackUrlRef.current && currentAudio && !currentAudio.paused
        ? currentAudio.currentTime * 1000
        : now - showRecordingStartedRef.current;
      if (elapsed - showRecordingLastSampleRef.current >= RECORDING_SAMPLE_MS) {
        showRecordingLastSampleRef.current = elapsed;
        const hasRoom = captureShowRecordingFrame(elapsed);
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
    setWorkspace('live');
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
    if (activeEffectRef.current) stopEffect(false);
    setAudioArmed(false);
    audioArmedRef.current = false;
    const external = Boolean(options.external);
    const startPosition = Math.max(0, Math.min(recording.durationMs, options.positionMs ?? 0));
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
      void audio.play().catch(() => setMessage('The lighting take is playing, but macOS did not start the audio track.'));
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
    setTempoSource('midi');
    tempoSourceRef.current = 'midi';
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
      await invoke('set_blackout', { enabled: active });
      await dispatchControl({ type: 'blackout.set', active }, source);
      await refreshDmxStatus();
      setMessage(active ? 'BLACKOUT active. Programmed values are preserved.' : 'Blackout released.');
    } catch (error) { setMessage(`Blackout failed: ${String(error)}`); }
  }

  async function toggleBlackout() {
    if (dmxStatus.blackout && settings.confirmBlackoutRelease && !window.confirm('Release blackout and restore programmed output?')) return;
    await setBlackoutState(!dmxStatus.blackout, 'ui');
  }

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
    const arranged = arrangeTargetPoints(target.position, selectedMovingFixtures.length, aimArrangement, aimSpreadMeters);
    const unreachable = selectedMovingFixtures.filter((fixture, selectedIndex) => {
      const patchIndex = patch.findIndex((item) => item.id === fixture.id);
      return !aimFixtureAtTarget(universeRef.current, fixture, arranged[selectedIndex], patchIndex, patch.length, stageSettings.dimensions)?.reachable;
    });
    setSelectedTargetId(target.id);
    const result = await dispatchControl({
      type: 'fixture.target',
      fixtureIds: selectedMovingFixtures.map((fixture) => fixture.id),
      target: target.position,
      arrangement: aimArrangement,
      spreadMeters: aimSpreadMeters
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
        spreadMeters: palette.spreadMeters
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
    try {
      await invoke('connect_midi', { inputId: Number(selectedMidiInput) });
      setMidiStatus(await invoke<MidiStatus>('midi_status'));
      setMessage('MIDI connected. Notes, CC, clock, and transport are being monitored.');
    } catch (error) { setMessage(`MIDI connection failed: ${String(error)}`); }
  }

  async function disconnectMidi() {
    try {
      await invoke('disconnect_midi');
      setMidiStatus(await invoke<MidiStatus>('midi_status'));
      setMessage('MIDI disconnected.');
    } catch (error) { setMessage(`MIDI disconnect failed: ${String(error)}`); }
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
      setMessage('Remote relay connected. Paired web controllers now use the same ShowRuntime command path.');
    } catch (error) {
      setRemoteRelayStatus('error');
      setRemoteRelayError(String(error));
      setMessage(`Remote relay failed: ${String(error)}`);
    }
  }

  async function disconnectRemoteRelay() {
    await remoteRelayRef.current?.disconnect();
    setRemoteRelayStatus('disconnected');
    setMessage('Remote relay disconnected. Local lighting output continues unchanged.');
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
      setTempoSource('manual');
      tempoSourceRef.current = 'manual';
      setEffectBpm(bpm);
      effectBpmRef.current = bpm;
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
        externalSongPositionMsRef.current += 60000 / Math.max(20, transportBpm) / 24;
        externalClockUiTicksRef.current += 1;
        if (externalClockUiTicksRef.current % 6 === 0) {
          setExternalSongPositionMs(externalSongPositionMsRef.current);
        }
      }
      return;
    }
    if (event.kind === 'song_position' && externalTrack.armed) {
      const positionMs = midiSongPositionToMs(event.song_position ?? 0, midiBpmRef.current ?? externalTrack.bpm);
      const lightingPositionMs = applyLightingOffset(positionMs, externalTrack.lightingOffsetMs);
      externalSongPositionMsRef.current = positionMs;
      setExternalSongPositionMs(positionMs);
      setShowTrackPositionMs(lightingPositionMs);
      if (externalTransportRunningRef.current && externalTrackRecording) {
        playShowRecording(externalTrackRecording, { external: true, positionMs: lightingPositionMs });
      }
      setMessage(`External song position: ${formatShowTime(positionMs)}.`);
      return;
    }
    if ((event.kind === 'start' || event.kind === 'continue') && externalTrack.armed) {
      const dawPositionMs = event.kind === 'start' ? 0 : externalSongPositionMsRef.current;
      const startAt = applyLightingOffset(dawPositionMs, externalTrack.lightingOffsetMs);
      if (event.kind === 'start') {
        externalSongPositionMsRef.current = 0;
        setExternalSongPositionMs(0);
        midiClockTimesRef.current = [];
        midiBpmRef.current = null;
        setMidiBpm(null);
      }
      externalClockUiTicksRef.current = 0;
      externalTransportRunningRef.current = true;
      setExternalTransportRunning(true);
      setTempoSource('midi');
      tempoSourceRef.current = 'midi';
      if (externalTrackRecording) playShowRecording(externalTrackRecording, { external: true, positionMs: startAt });
      else setMessage('External transport started, but no recorded lighting take is assigned.');
      return;
    }
    if (event.kind === 'stop' && externalTrack.armed) {
      externalTransportRunningRef.current = false;
      setExternalTransportRunning(false);
      setExternalSongPositionMs(externalSongPositionMsRef.current);
      if (recordingPlaybackExternalRef.current) stopRecordedShowPlayback(false);
      setMessage(`${externalTrack.songName || 'External song'} stopped at ${formatShowTime(externalSongPositionMsRef.current)}.`);
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
    if (!midiStatus.connected) return;
    const interval = window.setInterval(async () => {
      try {
        const events = await invoke<MidiEvent[]>('drain_midi_events');
        events.forEach((event) => midiActionRef.current(event));
        setMidiStatus(await invoke<MidiStatus>('midi_status'));
      } catch { /* connection may be rebuilding */ }
    }, MIDI_POLL_MS);
    return () => window.clearInterval(interval);
  }, [midiStatus.connected]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.key === 'Escape') {
        setCalibrationOpen(false);
        return;
      }
      if (event.code === 'Space' && !typing && (workspace === 'live' || (workspace === 'show' && showMode === 'cues'))) {
        event.preventDefault();
        goNextCue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspace, showMode, nextCue?.id]);

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

  const groupedPatch = useMemo(() => {
    const groups = new Map<string, PatchedFixture[]>();
    patch.forEach((fixture) => groups.set(fixture.group, [...(groups.get(fixture.group) ?? []), fixture]));
    return [...groups.entries()];
  }, [patch]);

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

  function addStageElement(type: StageElementType) {
    const element = makeStageElement(type, stageElements.filter((item) => item.type === type).length, stageSettings.dimensions);
    setStageElements((current) => [...current, element]);
    setSelectedStageElementId(element.id);
    setMessage(`${element.label} added to the stage design.`);
  }

  function updateStageElement(id: string, updates: Partial<StageElement>) {
    setStageElements((current) => current.map((element) => element.id === id
      ? migrateStageElement(clampStageElement({ ...element, ...updates }), stageSettings.dimensions)
      : element));
  }

  function updateStageElementPosition(id: string, axis: 'x' | 'y' | 'z', value: number) {
    setStageElements((current) => current.map((element) => {
      if (element.id !== id) return element;
      const migrated = migrateStageElement(element, stageSettings.dimensions);
      return { ...migrated, transform: { ...migrated.transform!, position: { ...migrated.transform!.position, [axis]: value } } };
    }));
  }

  function removeStageElement(id: string) {
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
      if (drag.kind === 'fixture') {
        const fixture = patchRef.current.find((item) => item.id === drag.id);
        if (fixture) {
          const index = patchRef.current.findIndex((item) => item.id === drag.id);
          const after = fixtureTransform(fixture, Math.max(0, index), patchRef.current.length, stageSettings.dimensions);
          void sendLumaVizStageChange({
            id: `lumarig-${Date.now()}-${fixture.id}`,
            entityId: fixture.id,
            entityKind: 'fixture',
            category: 'fixturePosition',
            source: 'lumarig',
            baseRevision: 0,
            createdAt: new Date().toISOString(),
            summary: `${fixture.name} position / rotation`,
            before: { position: drag.preserved },
            after: { position: after.position, rotation: after.rotation },
            status: 'applied'
          }).catch(() => undefined);
        }
      }
    }
  }



  function applySurfaceXY(clientX: number, clientY: number, element: HTMLElement) {
    if (!surfaceSupports('position')) return;
    const rect = element.getBoundingClientRect();
    const pan = clampDmx(((clientX - rect.left) / Math.max(1, rect.width)) * 255);
    const tilt = clampDmx((1 - (clientY - rect.top) / Math.max(1, rect.height)) * 255);
    selectedFixtureTargets.forEach((fixture) => {
      if (parameterChannel(fixture, 'pan')) void setFixtureAttribute(fixture, 'pan', pan);
      if (parameterChannel(fixture, 'tilt')) void setFixtureAttribute(fixture, 'tilt', tilt);
    });
  }

  function surfaceParameterControl(parameter: FixtureParameter, label: string) {
    const supported = selectedCapabilities.has(parameter);
    const value = selectedFixtureTargets.length === 1 ? readFixtureParameter(universe, selectedFixtureTargets[0], parameter) : 0;
    return <label key={parameter} className={controlSurfaceMode === 'encoders' ? 'surface-encoder' : ''}><span>{label}</span>{controlSurfaceMode === 'encoders' ? <div className="encoder-dial" style={{ '--encoder-value': `${supported ? value / 255 * 270 : 0}deg` } as React.CSSProperties}><b>{supported ? value : '—'}</b></div> : <input type="range" min="0" max="255" disabled={!supported} value={value} onChange={(event) => selectedFixtureTargets.forEach((fixture) => void setFixtureAttribute(fixture, parameter, Number(event.target.value)))} />}{controlSurfaceMode === 'encoders' && <input className="encoder-hit" aria-label={label} type="range" min="0" max="255" disabled={!supported} value={value} onChange={(event) => selectedFixtureTargets.forEach((fixture) => void setFixtureAttribute(fixture, parameter, Number(event.target.value)))} />}</label>;
  }

  const allLooks = [...STARTER_LOOKS, ...savedLooks];
  const liveExecutorItems = useMemo(() => {
    const groupItems = fixtureGroups.map((group) => ({ id: `group-${group.id}`, name: group.name, kind: 'group' as const, group }));
    const lookItems = allLooks.map((look) => ({ id: `look-${look.id}`, name: look.name, kind: 'look' as const, look }));
    const fxItems = EFFECT_PRESETS.filter((effect) => effectSupportedByFixtures(effect.id, selectedFixtureTargets)).map((effect) => ({ id: `fx-${effect.id}`, name: effect.name, kind: 'fx' as const, effect }));
    return [...groupItems, ...lookItems, ...fxItems];
  }, [fixtureGroups, allLooks, selectedFixtureTargets]);

  function fireLiveExecutor(item: (typeof liveExecutorItems)[number]) {
    if (item.kind === 'group') selectFixtureGroup(item.group.id);
    else if (item.kind === 'look') runLook(item.look);
    else toggleEffect(item.effect.id, selectedFixtureTargets.map((fixture) => fixture.id));
  }

  function flashLiveExecutor(item: (typeof liveExecutorItems)[number], down: boolean) {
    if (item.kind === 'fx') {
      if (down) startMomentaryEffect(item.effect.id, selectedFixtureTargets.map((fixture) => fixture.id));
      else releaseMomentaryEffect(item.effect.id);
      return;
    }
    if (item.kind === 'group') {
      if (down) applyGroupMaster(item.group, 100);
      return;
    }
    if (down) runLook(item.look);
  }

  function fxGraphPoints(waveform: EffectWaveform, depth = 100, offset = 0) {
    return Array.from({ length: 65 }, (_, index) => {
      const x = index / 64;
      const y = Math.max(0, Math.min(1, offset / 100 + effectWaveValue(waveform, x) * depth / 100));
      return `${(x * 600).toFixed(1)},${(120 - y * 100).toFixed(1)}`;
    }).join(' ');
  }

  function loadFactoryFx(effect: EffectPreset) {
    const shape = EFFECT_SHAPES[effect.id];
    setSelectedFxBankId(effect.id);
    setFxEditor({ id: `factory-${effect.id}`, name: effect.name, parameter: shape.parameter, waveform: shape.waveform, bpm: effect.defaultBpm, depth: 100, phaseSpread: shape.phaseSpread, offset: 0 });
  }

  function saveCustomFx() {
    const saved = { ...fxEditor, id: fxEditor.id.startsWith('custom-') && fxEditor.id !== 'custom-preview' ? fxEditor.id : `custom-${Date.now().toString(36)}` };
    setCustomEffects((current) => [...current.filter((effect) => effect.id !== saved.id), saved]);
    setFxEditor(saved);
    setSelectedFxBankId(saved.id);
    setMessage(`${saved.name} saved to the FX bank.`);
  }

  function runCustomFx(effect: CustomEffect, targetIds?: readonly string[]) {
    stopEffect(false);
    const targets = targetIds?.length ? new Set(targetIds) : null;
    const effectFixtures = patchRef.current.map((fixture) => ({ ...fixture, selected: targets ? targets.has(fixture.id) : fixture.selected }));
    if (!effectFixtures.some((fixture) => fixture.selected)) return setMessage('Select fixtures or a group before running the custom FX.');
    effectBaseUniverseRef.current = [...universeRef.current];
    const startedAt = performance.now();
    const tick = (now: number) => {
      const updates = renderCustomEffect(effect, effectFixtures, now - startedAt);
      void commitUniverse(applyUniverseUpdates(effectBaseUniverseRef.current, updates), 'fx');
      effectAnimationRef.current = requestAnimationFrame(tick);
    };
    effectAnimationRef.current = requestAnimationFrame(tick);
    setMessage(`${effect.name} running on selected lights.`);
  }

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
      <div className={`multi-stage physical-stage stage-view-${stageView} stage-mode-${stageMode}`}>
        <div className="stage-view-toolbar" role="group" aria-label="Stage view">
          <span className="stage-representation-label">{stageView === 'perspective' ? 'RIG' : 'PLAN'} <small>SPATIAL GUIDE</small></span>
          {(['perspective', 'top', 'front', 'side'] as StageView[]).map((view) => <button key={view} className={stageView === view ? 'active' : ''} onClick={() => setStageView(view)}>{view === 'perspective' ? 'Rig' : view}</button>)}
          <span className="stage-fallback-badge">{directStatus.clients > 0 ? 'LUMAVIZ LINKED' : 'LOCAL GUIDE ACTIVE'}</span>
        </div>
        <svg className="stage-geometry-svg" viewBox="0 0 1000 560" aria-label={`${stageView} physical stage view`}>
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
          }}><span className="stage-object-shape" style={{ borderColor: element.color, backgroundColor: element.type === 'led-screen' ? element.color : undefined }} /><b>{element.label}</b></button>;
        })}
        {patch.map((fixture, index) => {
          const geometry = fixtureGeometryState(outputUniverse, fixture, index, patch.length, stageSettings.dimensions);
          const projected = projectStagePoint(geometry.beam.origin, stageSettings.dimensions, stageView);
          return <div className={`stage-light physical-fixture ${stageFixture?.id === fixture.id && interactive ? 'editing' : ''} ${fixture.selected ? 'selected' : ''}`} key={fixture.id} style={{ left: `${projected.x / 10}%`, top: `${projected.y / 5.6}%`, zIndex: 40 }}><button className="stage-unit stage-unit-button" style={{ borderColor: fixture.labelColor ?? '#505b68' }} aria-label={`${stageMode === 'move' ? 'Drag' : 'Select'} ${fixture.name} on stage`} onPointerDown={(event) => { if (interactive) beginStageDrag(event, 'fixture', fixture.id, fixtureTransform(fixture, index, patch.length, stageSettings.dimensions).position); }} onPointerMove={(event) => { if (interactive) moveStageDrag(event); }} onPointerUp={(event) => { if (interactive) endStageDrag(event); }} onPointerCancel={(event) => { if (interactive) endStageDrag(event); }} onClick={(event) => { if (interactive) selectFixtureFromConsole(fixture.id, event.metaKey || event.ctrlKey || event.shiftKey); }} /><span className="stage-light-label" style={{ borderColor: fixture.labelColor ?? '#3a444f', color: fixture.labelColor ?? '#c9d0d8' }}>{fixture.name}{geometry.movementCapable ? ` · ${Math.round(geometry.movement.pan)}°/${Math.round(geometry.movement.tilt)}°` : ''}</span></div>;
        })}
        <div className="stage-coordinate-key"><b>{stageView === 'perspective' ? 'RIG' : 'PLAN'}</b> · X stage left/right · Y floor/ceiling · Z downstage/upstage · meters internally · representative beams use live fixture output</div>
      </div>
    );
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
      } else if (type === 'effect.release' && typeof command.effectId === 'string') {
        releaseMomentaryEffect(command.effectId as EffectId);
      } else if (type === 'effect.stop') {
        stopEffect();
      } else if (type === 'look.apply' && typeof command.lookId === 'string') {
        const look = [...STARTER_LOOKS, ...savedLooks].find((item) => item.id === command.lookId);
        if (!look) throw new Error('That look is not available in the active show.');
        runLook(look);
      } else if (type === 'fx.tempo.set' && typeof command.value === 'number') {
        const bpm = Math.max(30, Math.min(240, Math.round(command.value)));
        setTempoSource('manual');
        tempoSourceRef.current = 'manual';
        setEffectBpm(bpm);
        effectBpmRef.current = bpm;
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
    const bpm = tempoSource === 'midi' && midiBpm ? midiBpm : effectBpm;
    return {
      revision: runtimeRef.current?.snapshot.revision ?? 0,
      showName: showFile.name,
      stage: {
        view: stageView,
        mode: stageView,
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
        const values = fixtureValues(outputUniverse, fixture);
        const geometry = fixtureGeometryState(outputUniverse, fixture, index, patch.length, stageSettings.dimensions);
        return {
          id: fixture.id,
          name: fixture.name,
          group: fixture.group,
          labelColor: fixture.labelColor ?? '#55f29a',
          intensity: values.dimmer / 255,
          color: rgbToHex(values.red, values.green, values.blue),
          capabilities: [...new Set(mode?.channels.map((channel) => channel.parameter).filter((parameter): parameter is FixtureParameter => Boolean(parameter)) ?? [])],
          stagePosition: { ...geometry.beam.origin },
          beamDirection: { ...geometry.beam.direction },
          beamAngleDegrees: geometry.beam.angleDegrees,
          panDegrees: geometry.movement.pan,
          tiltDegrees: geometry.movement.tilt,
          movementCapable: geometry.movementCapable
        };
      }),
      groups: fixtureGroups.map((group) => ({ id: group.id, name: group.name, labelColor: group.labelColor, fixtureIds: [...group.fixtureOrder] })),
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
  }, [remoteRelayStatus, showFile, activeCueId, globalMaster, dmxStatus, effectBpm, tempoSource, midiBpm, midiStatus, midiClockSeen, externalTransportRunning, externalSongPositionMs, showRecordingActive, showRecordingElapsedMs, activeEffect, patch, outputUniverse, fixtureGroups, savedLooks, stageView, stageElements, selectedStageElementId, stageSettings]);

  const consoleColorPresets = COLOR_PRESETS.map((preset) => ({
    name: preset.name,
    color: rgbToHex(preset.rgb[0], preset.rgb[1], preset.rgb[2])
  }));
  const programEffectFixtures = programMode === 'groups' ? selectedGroupFixtures : selectedFixtureTargets;
  const programEffectName = programMode === 'groups'
    ? selectedGroup?.name ?? ''
    : selectedFixtureTargets.length === 1
      ? selectedFixtureTargets[0].name
      : selectedFixtureTargets.length > 1
        ? `${selectedFixtureTargets.length} selected fixtures`
        : '';
  const inspectedFixture = patch.find((fixture) => fixture.selected) ?? stageFixture;
  const selectedCompatibleColors = compatibleColorFixtures(selectedFixtureTargets);
  const [controlSurfaceMode, setControlSurfaceMode] = useState<ControlSurfaceMode>('encoders');
  const [controlSurfaceTab, setControlSurfaceTab] = useState<ControlSurfaceTab>('intensity');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('inspector');
  const [customEffects, setCustomEffects] = useState<CustomEffect[]>([]);
  const [fxEditor, setFxEditor] = useState<CustomEffect>({ id: 'custom-preview', name: 'New FX', parameter: 'dimmer', waveform: 'sine', bpm: 100, depth: 100, phaseSpread: 0, offset: 0 });
  const [selectedFxBankId, setSelectedFxBankId] = useState<string>('pulse');
  const [stageSyncPolicy, setStageSyncPolicy] = useState<StageSyncPolicy>(DEFAULT_STAGE_SYNC_POLICY);
  const [stageSyncChanges, setStageSyncChanges] = useState<StageChange[]>([]);
  const [stageRevision, setStageRevision] = useState(1);
  const [stageSyncTab, setStageSyncTab] = useState<'sync' | 'history'>('sync');
  const pendingStageChanges = stageSyncChanges.filter((change) => change.status === 'pending');
  useEffect(() => {
    if (workspace !== 'show' || directStatus.clients < 1) {
      setLumaVizPreview(null);
      return;
    }
    let cancelled = false;
    const poll = window.setInterval(() => {
      void lumaVizPreviewFrame().then((frame) => {
        if (cancelled) return;
        if (frame && Date.now() - frame.timestamp < 1500) setLumaVizPreview({ dataUrl: frame.dataUrl, timestamp: frame.timestamp, view: frame.view });
        else setLumaVizPreview(null);
      }).catch(() => { if (!cancelled) setLumaVizPreview(null); });
    }, 250);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [workspace, directStatus.clients]);
  useEffect(() => {
    if (!directStatus.listening) return;
    const timer = window.setInterval(() => {
      void drainLumaVizStageChanges<StageChange>().then((changes) => {
        if (!changes.length) return;
        const normalized: StageChange[] = changes.map((change) => ({ ...change, status: 'pending' }));
        normalized.forEach((change) => {
          const conflict = hasRevisionConflict(stageRevision, change);
          const decision = decideIncomingChange(stageSyncPolicy, change);
          const safeLiveApply = decision === 'apply' && !conflict && !canAutoApplyDangerousChange(stageSyncPolicy, change.category);
          if (safeLiveApply && change.entityKind === 'fixture' && change.category === 'fixturePosition') {
            const after = change.after as { position?: Vec3; rotation?: { yaw: number; pitch: number; roll: number } } | null;
            if (after?.position) {
              setPatch((current) => current.map((fixture, index) => {
                if (fixture.id !== change.entityId) return fixture;
                const existing = fixtureTransform(fixture, index, current.length, stageSettings.dimensions);
                return { ...fixture, transform: { position: { ...after.position! }, rotation: after.rotation ? { ...after.rotation } : existing.rotation } };
              }));
              setStageRevision((revision) => revision + 1);
              change.status = 'applied';
            }
          }
        });
        setStageSyncChanges((current) => [...normalized, ...current].slice(0, 100));
      }).catch(() => undefined);
    }, 250);
    return () => window.clearInterval(timer);
  }, [directStatus.listening, stageRevision, stageSyncPolicy]);
  const setStageSyncMode = (mode: StageSyncMode) => setStageSyncPolicy((current) => ({ ...current, mode }));
  const resolveStageChange = (id: string, status: 'approved' | 'rejected') => {
    const change = stageSyncChanges.find((item) => item.id === id);
    if (!change) return;
    if (status === 'approved' && change.entityKind === 'fixture' && change.category === 'fixturePosition') {
      const after = change.after as { position?: Vec3; rotation?: { yaw: number; pitch: number; roll: number } } | null;
      if (after?.position) {
        setPatch((current) => current.map((fixture, index) => {
          if (fixture.id !== change.entityId) return fixture;
          const existing = fixtureTransform(fixture, index, current.length, stageSettings.dimensions);
          return { ...fixture, transform: { position: { ...after.position! }, rotation: after.rotation ? { ...after.rotation } : existing.rotation } };
        }));
        setStageRevision((revision) => revision + 1);
      }
    }
    setStageSyncChanges((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setMessage(status === 'approved' ? `Applied Stage Sync change: ${change.summary}.` : `Rejected Stage Sync change: ${change.summary}.`);
  };

  const revertStageChange = (id: string) => {
    const change = stageSyncChanges.find((item) => item.id === id);
    if (!change || change.entityKind !== 'fixture' || change.category !== 'fixturePosition') return;
    const before = change.before as { position?: Vec3; rotation?: { yaw: number; pitch: number; roll: number } } | Vec3 | null;
    const position = before && 'position' in before && before.position ? before.position : before as Vec3 | null;
    if (!position || typeof position.x !== 'number') return;
    setPatch((current) => current.map((fixture, index) => {
      if (fixture.id !== change.entityId) return fixture;
      const existing = fixtureTransform(fixture, index, current.length, stageSettings.dimensions);
      const rotation = before && 'rotation' in before && before.rotation ? before.rotation : existing.rotation;
      return { ...fixture, transform: { position: { ...position }, rotation: { ...rotation } } };
    }));
    setStageRevision((revision) => revision + 1);
    setStageSyncChanges((current) => current.map((item) => item.id === id ? { ...item, status: 'reverted' } : item));
    setMessage(`Reverted Stage Sync change: ${change.summary}.`);
  };

  const systemHealth = [
    { label: 'DMX', value: dmxStatus.connected ? 'ONLINE' : 'VIRTUAL', healthy: dmxStatus.connected, action: () => { setWorkspace('setup'); setSetupView('settings'); } },
    { label: 'LUMAVIZ', value: directStatus.clients > 0 ? 'CONNECTED' : directStatus.listening ? 'READY' : 'OFFLINE', healthy: directStatus.clients > 0, action: () => { setWorkspace('setup'); setSetupView('settings'); } },
    { label: 'MIDI', value: midiStatus.connected ? 'CONNECTED' : 'OFFLINE', healthy: midiStatus.connected, action: () => { setWorkspace('setup'); setSetupView('settings'); } },
  ];

  return (
    <main className={`console-app workspace-${workspace} ${dmxStatus.blackout ? 'blackout-is-active' : ''}`}>
      <header className="console-header">
        <div className="console-brand"><span className="brand-mark">◆</span><div><small>SHOW</small><input aria-label="Current show name" value={showFile.name} onChange={(event) => setShowFile((current) => ({ ...current, name: event.target.value }))} /></div></div>
        <nav className="console-workspace-tabs" aria-label="Workspace">{(['setup', 'program', 'show', 'live'] as Workspace[]).map((item) => <button key={item} className={workspace === item ? 'active' : ''} onClick={() => setWorkspace(item)}>{WORKSPACE_LABELS[item]}</button>)}</nav>
        <div className="console-header-status">
          <div className="system-health-strip">{systemHealth.map((item) => <button key={item.label} className={item.healthy ? 'healthy' : ''} onClick={item.action}><i /><span><small>{item.label}</small><strong>{item.value}</strong></span></button>)}</div>
          <button className="tempo-pill" onClick={tapTempo}><strong>{tempoSource === 'midi' && midiBpm ? midiBpm : effectBpm} BPM</strong><small>{tempoSource === 'midi' ? 'MIDI CLOCK' : 'TAP'}</small></button>
          <div className="header-master"><small>MASTER</small><strong>{globalMaster}%</strong></div>
          <button className={`console-blackout ${dmxStatus.blackout ? 'active' : ''}`} onClick={toggleBlackout}>{dmxStatus.blackout ? 'RELEASE' : 'BLACKOUT'}</button>
        </div>
      </header>

      <audio ref={showTrackAudioRef} src={showTrackUrl || undefined} preload="metadata" onLoadedMetadata={(event) => setShowTrackDurationMs(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration * 1000 : 0)} onTimeUpdate={(event) => setShowTrackPositionMs(event.currentTarget.currentTime * 1000)} onEnded={handleShowTrackEnded} />
      {dmxStatus.blackout && <div className="blackout-banner"><strong>BLACKOUT ACTIVE</strong><span>Programmed fixture values are preserved.</span><button onClick={toggleBlackout}>Release Blackout</button></div>}
      {showRecordingActive && <section className="console-recording-bar"><span className="recording-pulse" /><div><strong>RECORDING SHOW</strong><small>{showTrackName || 'Lighting only'} · {formatShowTime(showRecordingElapsedMs)}</small></div><button onClick={() => stopShowRecording(true)}>Stop + save</button><button onClick={() => stopShowRecording(false)}>Cancel</button></section>}
      {activeRecordingPlayback && <section className="console-recording-bar playback"><span className="playback-pulse" /><div><strong>{recordingPlaybackExternalRef.current ? 'EXTERNAL SYNC' : 'RECORDED SHOW'}</strong><small>{activeRecordingPlayback.name} · {formatShowTime(showTrackPositionMs)} / {formatShowTime(activeRecordingPlayback.durationMs)}</small></div><button onClick={() => stopRecordedShowPlayback()}>Stop</button></section>}

      {workspace === 'setup' && <section className="console-workspace setup-console">
        <nav className="workspace-subtabs setup-subtabs">{([
          ['stage', 'Stage'], ['patch', 'Patch'], ['fixtures', 'Fixtures'], ['groups', 'Groups'], ['settings', 'System']
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
        />

        <div className="setup-center console-center">
          {setupView === 'stage' && <>
            <div className="stage-console-toolbar"><div role="toolbar" aria-label="Stage Designer mode">{STAGE_DESIGNER_MODES.map((mode) => <button key={mode.id} className={stageMode === mode.id ? 'active' : ''} onClick={() => setStageMode(mode.id)}>{mode.label}</button>)}</div><div className="stage-sync-compact"><small>STAGE SYNC</small>{(['locked','review','live'] as StageSyncMode[]).map((mode) => <button key={mode} className={stageSyncPolicy.mode === mode ? 'active' : ''} onClick={() => setStageSyncMode(mode)}>{mode.toUpperCase()}</button>)}{pendingStageChanges.length > 0 && <b>{pendingStageChanges.length}</b>}</div><span>{stageSettings.unit === 'feet' ? 'FEET' : 'METERS'} · {stageSettings.dimensions.width.toFixed(1)} × {stageSettings.dimensions.depth.toFixed(1)} m</span></div>
            <div className="dominant-stage">{renderStagePreview(true)}</div>
            <div className="stage-bottom-tools">
              <section><header><strong>TARGETS &amp; AIM</strong><span>{selectedMovingFixtures.length} mover{selectedMovingFixtures.length === 1 ? '' : 's'} selected</span></header><div className="inline-control-grid"><select value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>{stageTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select><select value={aimArrangement} onChange={(event) => setAimArrangement(event.target.value as TargetArrangement)}><option value="converge">Converge</option><option value="fan-horizontal">Horizontal fan</option><option value="fan-vertical">Vertical fan</option><option value="mirror">Mirror</option><option value="cross">Cross</option></select><button className="console-primary" disabled={!selectedTarget || !selectedMovingFixtures.length} onClick={() => selectedTarget && void aimAtTarget(selectedTarget)}>Aim selected</button></div></section>
              <section><header><strong>POSITION PALETTES</strong><span>{showFile.positionPalettes?.length ?? 0} saved</span></header><div className="palette-chip-row">{showFile.positionPalettes?.map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}><span>{palette.kind}</span>{palette.name}</button>)}<button className="add-palette-chip" onClick={savePositionPalette}>＋ Save current</button></div></section>
              <section><header><strong>STAGE ELEMENTS</strong><span>{stageElements.length}</span></header><div className="palette-chip-row">{STAGE_ELEMENT_LIBRARY.map((element) => <button key={element.type} onClick={() => addStageElement(element.type)}>＋ {element.name}</button>)}</div></section>
            </div>
          </>}

          {setupView === 'fixtures' && <div className="setup-scroll-area">
            <section className="fixture-selection-toolbar"><div><strong>FIXTURE SELECTION</strong><span>{patch.filter((fixture) => fixture.selected).length} of {patch.length} selected</span></div><div><button onClick={selectAllFixtures}>Select All</button><button onClick={clearFixtureSelection}>Clear</button><button className="danger-button" disabled={!patch.some((fixture) => fixture.selected) || patch.filter((fixture) => fixture.selected).length >= patch.length} onClick={deleteSelectedFixtures}>Delete Selected</button></div></section>
            <section className="console-panel batch-fixture-panel"><header><div><span>ADD FIXTURES</span><h2>Patch a batch</h2></div><b>{FIXTURE_LIBRARY.length} profiles</b></header><div className="batch-fixture-grid"><label><span>Fixture Profile</span><select value={newProfileId} onChange={(event) => { const profile = findProfile(event.target.value) ?? FIXTURE_LIBRARY[0]; setNewProfileId(profile.id); setNewModeId(profile.modes[0].id); setProfileAcknowledged(false); }}>{FIXTURE_LIBRARY.map((profile) => <option key={profile.id} value={profile.id}>{profile.verified ? '✓' : '△'} {profile.manufacturer} {profile.model}</option>)}</select></label><label><span>Mode</span><select value={newModeId} onChange={(event) => setNewModeId(event.target.value)}>{newProfile.modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name} · {mode.channelCount}ch</option>)}</select></label><label><span>Base Name</span><input value={newFixtureName} placeholder={newProfile.model} onChange={(event) => setNewFixtureName(event.target.value)} /></label><label><span>Quantity</span><input type="number" min="1" max="64" value={newFixtureQuantity} onChange={(event) => setNewFixtureQuantity(Number(event.target.value))} /></label><label><span>Starting Address</span><input type="number" min="1" max="512" value={newFixtureAddress} onChange={(event) => setNewFixtureAddress(Number(event.target.value))} /></label><label><span>Group</span><select value={newFixtureGroup} onChange={(event) => setNewFixtureGroup(event.target.value)}><option value="">Unassigned</option>{fixtureGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select></label><button className="console-primary add-batch" onClick={addFixture}>Add {Math.max(1, newFixtureQuantity)} Fixture{newFixtureQuantity === 1 ? '' : 's'}</button></div>{!newProfile.verified && <label className="profile-confirm"><input type="checkbox" checked={profileAcknowledged} onChange={(event) => setProfileAcknowledged(event.target.checked)} /> I checked the fixture manual and exact mode.</label>}</section>
            <section className="compact-patch-list">{patch.map((fixture) => <FixturePatchEditor key={fixture.id} fixture={fixture} onSave={savePatchedFixture} onRemove={() => removeFixture(fixture)} onToggleSelected={() => selectFixtureFromConsole(fixture.id, true)} onToggleCollapsed={() => setPatch((current) => current.map((item) => item.id === fixture.id ? { ...item, collapsed: !item.collapsed } : item))} />)}</section>
          </div>}

          {setupView === 'groups' && <div className="group-assignment-view"><header><div><span>GROUP ASSIGNMENT</span><h2>Assign Fixtures to Groups</h2><p>Check fixtures on the left, then assign them to a real persisted show group.</p></div><button onClick={createFixtureGroup}>＋ Create Group</button></header><div className="group-card-grid">{fixtureGroups.map((group) => { const members = fixturesInGroup(patch, group); return <article className={`assignment-group-card ${selectedGroupId === group.id ? 'selected' : ''}`} key={group.id} style={{ '--group-color': group.labelColor } as import('react').CSSProperties}><button className="assignment-group-title" onClick={() => setSelectedGroupId(group.id)}><i style={{ background: group.labelColor }} /><span><strong>{group.name}</strong><small>{members.length} fixture{members.length === 1 ? '' : 's'}</small></span><b>•••</b></button><div>{members.map((fixture) => <span className="assigned-fixture" key={fixture.id}><i style={{ background: fixture.labelColor ?? group.labelColor }} /><span><strong>{fixture.name}</strong><small>{addressLabel(fixture.address)}</small></span><button aria-label={`Unassign ${fixture.name}`} onClick={() => unassignFixture(fixture.id)}>×</button></span>)}</div><button className="add-to-group" onClick={() => { setSelectedGroupId(group.id); assignCheckedFixtures(group); }}>＋ Add checked fixtures</button></article>; })}<button className="create-group-card" onClick={createFixtureGroup}><span>＋</span><strong>Create New Group</strong><small>Add an empty group to this show.</small></button></div></div>}

          {setupView === 'patch' && <div className="setup-scroll-area"><section className="patch-summary"><div><strong>Universe 1</strong><span>{patch.length} fixtures · collision validation active</span></div><button onClick={() => setPatch((current) => current.map((fixture) => ({ ...fixture, collapsed: true })))}>Collapse all</button></section><section className="compact-patch-list">{groupedPatch.map(([group, fixtures]) => <div key={group || 'unassigned'}><h3>{group || 'Unassigned'} <span>{fixtures.length}</span></h3>{fixtures.map((fixture) => <FixturePatchEditor key={fixture.id} fixture={fixture} onSave={savePatchedFixture} onRemove={() => removeFixture(fixture)} onToggleSelected={() => selectFixtureFromConsole(fixture.id, true)} onToggleCollapsed={() => setPatch((current) => current.map((item) => item.id === fixture.id ? { ...item, collapsed: !item.collapsed } : item))} />)}</div>)}</section></div>}

          {setupView === 'settings' && <div className="setup-scroll-area settings-console">
            <section className="console-panel connection-console"><header><div><span>DMX OUTPUT</span><h2>Anyma uDMX</h2></div><b className={dmxStatus.connected ? 'healthy' : ''}>{dmxStatus.connected ? 'Connected' : 'Virtual only'}</b></header><label><span>USB Interface</span><select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)} disabled={dmxStatus.connected}><option value="">Select uDMX</option>{devices.map((device) => <option key={device.device_key} value={device.device_key}>{deviceLabel(device)}</option>)}</select></label><div className="settings-actions"><button onClick={scanDevices}>Scan USB</button>{dmxStatus.connected ? <button onClick={disconnectDmx}>Disconnect + zero</button> : <button className="console-primary" disabled={!selectedInfo?.likely_udmx || busy} onClick={connectDmx}>Connect uDMX</button>}<button onClick={zeroAll}>Zero all</button></div></section>
            <section className="console-panel connection-console"><header><div><span>GENERAL MIDI</span><h2>Controller / Network Session</h2></div><b className={midiStatus.connected ? 'healthy' : ''}>{midiStatus.connected ? 'Listening' : 'Offline'}</b></header><label><span>MIDI Input</span><select value={selectedMidiInput} disabled={midiStatus.connected} onChange={(event) => setSelectedMidiInput(event.target.value)}><option value="">Select input</option>{midiInputs.map((input) => <option key={input.id} value={input.id}>{input.name}</option>)}</select></label><div className="settings-actions"><button onClick={scanMidi}>Scan MIDI</button>{midiStatus.connected ? <button onClick={disconnectMidi}>Disconnect</button> : <button className="console-primary" disabled={!selectedMidiInput} onClick={connectMidi}>Connect MIDI</button>}</div><div className="midi-event-monitor"><i className={midiStatus.last_event ? 'active' : ''} /><span><strong>{midiStatus.last_event || 'Waiting for MIDI'}</strong><small>{midiStatus.messages_received} messages · {midiClockSeen ? 'Clock detected' : 'No clock'}</small></span></div></section>
            <section className="console-panel midi-mapping-console"><header><div><span>MIDI ASSIGNER</span><h2>Map controls</h2></div><b>{midiMappings.length} mappings</b></header><div className="midi-add-row"><select value={newMidiTarget} onChange={(event) => setNewMidiTarget(event.target.value)}>{midiControlGroups.map(([group, controls]) => <optgroup key={group} label={group}>{controls.map((control) => <option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}</select><button className="console-primary" onClick={() => beginMidiAssignment()}>Add + Learn</button></div><div className="midi-map-list">{midiMappings.map((mapping) => { const control = midiControls.find((item) => item.id === mapping.target); const learning = midiLearnMappingId === mapping.id; return <div className={`midi-map-row ${learning ? 'is-learning' : ''}`} key={mapping.id}><strong>{control?.label ?? 'Unavailable'}</strong><span>{learning ? 'Move or press a control…' : midiBindingLabel(mapping)}</span><button onClick={() => setMidiLearnMappingId(learning ? null : mapping.id)}>{learning ? 'Cancel' : 'Learn'}</button><button onClick={() => removeMidiAssignment(mapping.id)}>Remove</button></div>; })}</div></section>
            <section className="console-panel connection-console remote-relay-console"><header><div><span>REMOTE CONTROL · SEPARATE NETWORKS</span><h2>Secure Cloud Relay</h2></div><b className={remoteRelayStatus === 'connected' ? 'healthy' : ''}>{remoteRelayStatus}</b></header><p>Both this Mac and the Vercel controller connect outbound to one private Supabase Realtime channel. No router port forwarding is required.</p><label><span>Supabase Project URL</span><input value={remoteRelayConfig.url} placeholder="https://project.supabase.co" onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, url: event.target.value }))} /></label><label><span>Publishable Key</span><input type="password" value={remoteRelayConfig.publishableKey} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, publishableKey: event.target.value }))} /></label><div className="inspector-pair"><label><span>Account Email</span><input type="email" value={remoteRelayConfig.email} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, email: event.target.value }))} /></label><label><span>Password · never stored</span><input type="password" value={remoteRelayConfig.password ?? ''} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, password: event.target.value }))} /></label></div><label><span>Room Code · use the same code on the remote</span><div className="relay-room-row"><input value={remoteRelayConfig.roomCode} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, roomCode: event.target.value }))} /><button onClick={() => setRemoteRelayConfig((current) => ({ ...current, roomCode: `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}` }))}>Generate</button></div></label>{remoteRelayError && <p className="relay-error">{remoteRelayError}</p>}<div className="settings-actions">{remoteRelayStatus === 'connected' ? <button onClick={disconnectRemoteRelay}>Disconnect relay</button> : <button className="console-primary" onClick={connectRemoteRelay}>Connect remote relay</button>}</div></section>
            <section className="console-panel connection-console visualizer-direct-console"><header><div><span>VISUALIZER LINK · SEMANTIC WEBSOCKET</span><h2>LumaRig Direct</h2></div><b className={directStatus.listening && !directStatus.lastError ? 'healthy' : ''}>{directStatus.clients > 0 ? 'Connected' : directStatus.listening ? 'Ready' : 'Error'}</b></header><p>Native semantic link for LumaViz. Sends resolved fixture identity, intensity, color, movement, beam and strobe without making LumaViz decode DMX.</p><div className="artnet-health-grid"><div><span>ENDPOINT</span><strong>ws://127.0.0.1:{directStatus.port}/lumaviz</strong></div><div><span>CLIENTS</span><strong>{directStatus.clients}</strong></div><div><span>FRAMES SENT</span><strong>{directStatus.framesSent.toLocaleString()}</strong></div><div><span>PROTOCOL</span><strong>fixture-frame-v1</strong></div></div>{directStatus.lastError && <p className="artnet-error">Direct: {directStatus.lastError}</p>}<small>LumaRig Direct starts automatically. Art-Net remains available below as the standard DMX-over-network fallback.</small></section>
            <section className="console-panel connection-console visualizer-output-console"><header><div><span>VISUALIZER LINK · ART-NET</span><h2>LumaViz Connection</h2></div><b className={settings.visualizerArtNetEnabled && !artNetTelemetry.lastError ? 'healthy' : ''}>{artNetTelemetry.lastError ? 'Error' : settings.visualizerArtNetEnabled ? 'Live' : 'Off'}</b></header><p>LumaRig mirrors the final resolved DMX frame after cues, FX, manual overrides, group masters, and grand master. Physical DMX remains independent if the visualizer closes.</p><div className="artnet-health-grid"><div><span>TRANSPORT</span><strong>Art-Net / UDP 6454</strong></div><div><span>TARGET</span><strong>{settings.visualizerArtNetTarget || '127.0.0.1'}</strong></div><div><span>FRAMES SENT</span><strong>{artNetTelemetry.framesSent.toLocaleString()}</strong></div><div><span>STATUS</span><strong>{artNetTelemetry.lastError ? 'Send error' : settings.visualizerArtNetEnabled ? artNetTelemetry.framesSent > 0 ? 'Streaming' : 'Armed' : 'Stopped'}</strong></div></div>{artNetTelemetry.lastError && <p className="artnet-error">Art-Net: {artNetTelemetry.lastError}</p>}<label className="inspector-toggle"><span>Enable visualizer output</span><input type="checkbox" checked={settings.visualizerArtNetEnabled} onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetEnabled: event.target.checked }))} /></label><label><span>Target IPv4 address</span><input value={settings.visualizerArtNetTarget} placeholder="127.0.0.1" onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetTarget: event.target.value }))} /></label><small>Use 127.0.0.1 when LumaViz is on this computer. For another computer, use that machine's LAN IPv4. 255.255.255.255 broadcasts to the LAN.</small><div className="settings-actions"><button className="console-primary" onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '127.0.0.1', visualizerArtNetEnabled: true }))}>Connect LumaViz · This Mac</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '255.255.255.255', visualizerArtNetEnabled: true }))}>Broadcast LAN</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetEnabled: false }))}>Stop Link</button></div></section>
            <section className="console-panel connection-console"><header><div><span>AUDIO REACTIVE · BETA</span><h2>Sound Input</h2></div><b>{audioArmed ? 'Armed' : audioEnabled ? 'Monitoring' : 'Off'}</b></header><div className="audio-meter"><span style={{ width: `${audioLevel * 100}%` }} /></div><label><span>Sensitivity · {settings.audioSensitivity}%</span><input type="range" min="1" max="100" value={settings.audioSensitivity} onChange={(event) => setSettings((current) => ({ ...current, audioSensitivity: Number(event.target.value) }))} /></label>{audioError && <p>{audioError}</p>}<div className="settings-actions">{audioEnabled ? <><button onClick={stopAudioInput}>Stop input</button><button className="console-primary" onClick={() => { audioBaseUniverseRef.current = [...universeRef.current]; setAudioArmed(!audioArmed); }}>{audioArmed ? 'Disarm lights' : 'Arm selected lights'}</button></> : <button className="console-primary" onClick={startAudioInput}>Enable input</button>}</div></section>
            <section className="console-panel software-update-console"><header><div><span>SOFTWARE UPDATE</span><h2>LumaRig</h2></div><b className={updateStatus === 'available' ? 'healthy' : ''}>v{appVersion}</b></header><div className="update-summary"><strong>{updateStatus === 'available' && updateInfo ? `Version ${updateInfo.version} available` : updateStatus === 'checking' ? 'Checking GitHub Releases…' : updateStatus === 'installing' ? 'Installing update…' : updateStatus === 'current' ? 'You are up to date' : updateStatus === 'error' ? 'Update check failed' : 'Automatic update checks enabled'}</strong><small>{updateStatus === 'available' ? 'The signed update is ready. Output will be zeroed and disconnected before the app restarts.' : 'Release builds check the public update feed shortly after launch.'}</small></div>{updateInfo?.notes && <p className="update-notes">{updateInfo.notes}</p>}{updateError && <p className="update-error">{updateError}</p>}<div className="settings-actions"><button disabled={updateStatus === 'checking' || updateStatus === 'installing'} onClick={() => void checkForUpdates(false)}>{updateStatus === 'checking' ? 'Checking…' : 'Check for Updates'}</button>{updateStatus === 'available' && updateInfo && <button className="console-primary" onClick={() => void installAvailableUpdate()}>{`Install v${updateInfo.version}`}</button>}</div></section>
            <section className="console-panel safety-settings"><header><div><span>PERFORMANCE SAFETY</span><h2>Guardrails</h2></div></header><label><span>Grand master limit</span><input type="range" min="10" max="100" value={settings.masterLimit} onChange={(event) => setSettings((current) => ({ ...current, masterLimit: Number(event.target.value) }))} /><b>{settings.masterLimit}%</b></label><label><span>Confirm blackout release</span><input type="checkbox" checked={settings.confirmBlackoutRelease} onChange={(event) => setSettings((current) => ({ ...current, confirmBlackoutRelease: event.target.checked }))} /></label></section>
            <details className="console-panel raw-dmx-console"><summary>Raw DMX Monitor · Channels 1–{VISIBLE_CHANNELS}</summary><div>{Array.from({ length: VISIBLE_CHANNELS }, (_, index) => <label key={index}><span>CH {index + 1}</span><input type="number" min="0" max="255" value={universe[index]} onChange={(event) => setChannel(index + 1, Number(event.target.value))} /></label>)}</div></details>
          </div>}
        </div>

        <aside className="console-inspector setup-inspector">
          <nav className="inspector-tabs" aria-label="Inspector view">{(['inspector','history','sync'] as InspectorTab[]).map((tab) => <button key={tab} className={inspectorTab === tab ? 'active' : ''} onClick={() => setInspectorTab(tab)}>{tab.toUpperCase()}{tab === 'sync' && pendingStageChanges.length > 0 ? <b>{pendingStageChanges.length}</b> : null}</button>)}</nav>
          {inspectorTab === 'history' ? <div className="inspector-global-history"><header><span>STAGE HISTORY</span><strong>Revision {stageRevision}</strong><small>{stageSyncChanges.length} recorded changes</small></header>{stageSyncChanges.slice(0,16).map((change) => <article key={change.id}><i className={`history-source ${change.source}`} /><span><strong>{change.summary}</strong><small>{change.source === 'lumaviz' ? 'LumaViz' : 'LumaRig'} · {change.status.toUpperCase()} · {new Date(change.createdAt).toLocaleTimeString()}</small></span>{change.status === 'approved' && change.category === 'fixturePosition' ? <button onClick={() => revertStageChange(change.id)}>Revert</button> : null}</article>)}{!stageSyncChanges.length && <div className="empty-inspector"><strong>No stage history</strong><span>Spatial changes from LumaRig and LumaViz will appear here.</span></div>}</div> : inspectorTab === 'sync' ? <section className="inspector-stage-sync inspector-sync-primary"><header><span>STAGE SYNC</span><strong>REV {stageRevision} · {stageSyncPolicy.mode.toUpperCase()}</strong></header><div className="sync-mode-row">{(['locked','review','live'] as StageSyncMode[]).map((mode) => <button key={mode} className={stageSyncPolicy.mode === mode ? 'active' : ''} onClick={() => setStageSyncMode(mode)}>{mode.toUpperCase()}</button>)}</div><p>LumaRig and LumaViz share fixture identity and spatial transforms. Lighting output remains owned by LumaRig.</p><small>{pendingStageChanges.length ? `${pendingStageChanges.length} incoming change${pendingStageChanges.length === 1 ? '' : 's'} waiting for review.` : 'Spatial state is synchronized with no pending proposals.'}</small>{pendingStageChanges.map((change) => <article key={change.id}><b>{change.source === 'lumaviz' ? 'LumaViz' : 'LumaRig'} · {change.summary}</b><span>Base rev {change.baseRevision} → current rev {stageRevision}</span><details><summary>Compare transform</summary><pre>{JSON.stringify({ before: change.before, after: change.after }, null, 2)}</pre></details><div><button onClick={() => resolveStageChange(change.id,'rejected')}>Reject</button><button className="console-primary" onClick={() => resolveStageChange(change.id,'approved')}>Accept</button></div></article>)}</section> : <>
          {setupView === 'groups' && selectedGroup ? <>
            <header><span>GROUP SETTINGS</span><strong>{selectedGroup.name}</strong><small>{selectedGroupFixtures.length} fixtures</small></header>
            <label><span>Group Name</span><input defaultValue={selectedGroup.name} key={selectedGroup.id} onBlur={(event) => updateFixtureGroup(selectedGroup.id, { name: event.target.value })} /></label>
            <label><span>Label Color</span><input className="inspector-color" type="color" value={selectedGroup.labelColor} onChange={(event) => updateFixtureGroup(selectedGroup.id, { labelColor: event.target.value })} /></label>
            <label><span>Master Brightness Default</span><input type="range" min="0" max="100" value={selectedGroup.masterDefault} onChange={(event) => updateFixtureGroup(selectedGroup.id, { masterDefault: Number(event.target.value) })} /><b>{selectedGroup.masterDefault}%</b></label>
            <label className="inspector-toggle"><span>FX Enabled</span><input type="checkbox" checked={selectedGroup.fxEnabled} onChange={(event) => updateFixtureGroup(selectedGroup.id, { fxEnabled: event.target.checked })} /></label>
            <label><span>Group Notes</span><textarea maxLength={500} value={selectedGroup.notes} onChange={(event) => updateFixtureGroup(selectedGroup.id, { notes: event.target.value })} /></label>
            <button className="console-primary" disabled={!assignmentIds.length} onClick={() => assignCheckedFixtures()}>Assign Selected ({assignmentIds.length})</button><button onClick={createFixtureGroup}>＋ Create Group</button><button className="danger-button" onClick={() => deleteFixtureGroup(selectedGroup.id)}>Delete Group</button>
          </> : setupView === 'stage' && selectedStageElement ? <>
            <header><span>STAGE OBJECT</span><strong>{selectedStageElement.label}</strong><small>{selectedStageElement.type}</small></header>
            <label><span>Name</span><input value={selectedStageElement.label} onChange={(event) => updateStageElement(selectedStageElement.id, { label: event.target.value })} /></label>
            <div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(selectedStagePosition[axis].toFixed(2))} onChange={(event) => updateStageElementPosition(selectedStageElement.id, axis, Number(event.target.value))} /></label>)}</div>
            <label><span>Size</span><input type="range" min="10" max="100" value={selectedStageElement.size} onChange={(event) => updateStageElement(selectedStageElement.id, { size: Number(event.target.value) })} /></label>
            <label><span>Color</span><input className="inspector-color" type="color" value={selectedStageElement.color} onChange={(event) => updateStageElement(selectedStageElement.id, { color: event.target.value })} /></label>
            <button className="danger-button stage-delete-button" onClick={() => removeStageElement(selectedStageElement.id)}>Delete Stage Object</button>
          </> : inspectedFixture ? <>
            <header><span>FIXTURE INSPECTOR</span><strong>{inspectedFixture.name}</strong><small>{findProfile(inspectedFixture.profileId)?.manufacturer} {findProfile(inspectedFixture.profileId)?.model}</small></header>
            <label><span>Name</span><input value={inspectedFixture.name} onChange={(event) => savePatchedFixture({ ...inspectedFixture, name: event.target.value })} /></label>
            <div className="inspector-pair"><label><span>Universe</span><input type="number" min="1" value={inspectedFixture.universe ?? 1} onChange={(event) => savePatchedFixture({ ...inspectedFixture, universe: Number(event.target.value) })} /></label><label><span>Address</span><input type="number" min="1" max="512" value={inspectedFixture.address} onChange={(event) => savePatchedFixture({ ...inspectedFixture, address: Number(event.target.value) })} /></label></div>
            <label><span>Group</span><select value={inspectedFixture.group} onChange={(event) => savePatchedFixture({ ...inspectedFixture, group: event.target.value })}><option value="">Unassigned</option>{fixtureGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}</select></label>
            <div className="inspector-pair"><label><span>Mounting</span><select value={inspectedFixture.mounting ?? 'hanging'} onChange={(event) => savePatchedFixture({ ...inspectedFixture, mounting: event.target.value as PatchedFixture['mounting'] })}><option value="hanging">Hanging</option><option value="floor">Floor</option><option value="wall">Wall</option><option value="custom">Custom</option></select></label><label><span>Orientation</span><select value={inspectedFixture.orientation ?? 'normal'} onChange={(event) => savePatchedFixture({ ...inspectedFixture, orientation: event.target.value as PatchedFixture['orientation'] })}><option value="normal">Normal</option><option value="inverted">Inverted</option><option value="rotated90">Rotated 90°</option><option value="rotated180">Rotated 180°</option><option value="custom">Custom</option></select></label></div>
            <div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step="0.1" value={Number(activeStageTransform.position[axis].toFixed(2))} onChange={(event) => updateStageFixtureTransform('position', axis, Number(event.target.value))} /></label>)}{(['yaw', 'pitch', 'roll'] as const).map((axis) => <label key={axis}><span>{axis}</span><input type="number" step="1" value={Number(activeStageTransform.rotation[axis].toFixed(1))} onChange={(event) => updateStageFixtureTransform('rotation', axis, Number(event.target.value))} /></label>)}</div>
            <div className="calibration-status"><span>CALIBRATION</span><strong>{inspectedFixture.calibration?.status ?? 'uncalibrated'}</strong><small>{Math.round((inspectedFixture.calibration?.confidence ?? 0) * 100)}% confidence</small></div>
            <button className="inspector-sync-jump" onClick={() => setInspectorTab('sync')}><span>STAGE SYNC</span><strong>{stageSyncPolicy.mode.toUpperCase()}</strong><small>{pendingStageChanges.length ? `${pendingStageChanges.length} pending` : `Revision ${stageRevision}`}</small></button>
            <button onClick={() => setCalibrationOpen((value) => !value)}>{calibrationOpen ? 'Close Calibration' : 'Calibrate Position'}</button>{calibrationOpen && <div className="calibration-mini"><button onClick={homeActiveFixture}>Send Home</button><button onClick={captureCalibrationObservation}>Capture Target</button><button onClick={solveActiveFixtureCalibration}>Solve</button><button onClick={resetActiveFixtureCalibration}>Reset</button></div>}
          </> : <div className="empty-inspector"><strong>No selection</strong><span>Select a fixture or stage object to inspect it.</span></div>}</>}
        </aside>
      </section>}

      {workspace === 'program' && <section className="console-workspace program-console">
        <FixtureBrowser patch={patch} groups={fixtureGroups} search={fixtureSearch} onSearchChange={setFixtureSearch} onSelectAll={selectAllFixtures} onClearSelection={clearFixtureSelection} onSelectFixture={selectFixtureFromConsole} onSelectGroup={selectFixtureGroup} selectedGroupId={selectedGroupId} />
        <div className="program-center console-center">
          <header className="program-workbench-header"><div><span>PROGRAMMING WORKBENCH</span><strong>{selectedGroup ? selectedGroup.name : selectedFixtureTargets.length === 1 ? selectedFixtureTargets[0].name : selectedFixtureTargets.length ? `${selectedFixtureTargets.length} Fixtures` : 'No Selection'}</strong></div><nav>{([['stage','RIG'],['faders','FIXTURES'],['groups','GROUPS'],['fx','FX EDITOR']] as Array<[ProgramMode,string]>).map(([id,label]) => <button key={id} className={programMode === id ? 'active' : ''} onClick={() => setProgramMode(id)}>{label}</button>)}</nav><div className="program-workbench-status"><small>{activeEffect ? `FX · ${activeEffect.toUpperCase()}` : 'FX READY'}</small><b>{effectBpm} BPM</b></div></header>
          {programMode !== 'stage' && <ColorDeck title={programMode === 'groups' ? 'GROUP COLOR' : 'GLOBAL COLOR'} subtitle={programMode === 'groups' ? selectedGroup?.name ?? 'Select a group' : selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected fixture${selectedFixtureTargets.length === 1 ? '' : 's'}` : 'Select fixtures before applying color'} color={globalColor} disabled={programMode === 'groups' ? !selectedGroup || compatibleColorFixtures(selectedGroupFixtures).length === 0 : selectedCompatibleColors.length === 0} presets={consoleColorPresets} onChange={(color) => programMode === 'groups' && selectedGroup ? applyGroupColor(selectedGroup, color) : applyGlobalColor(color)} />}
          {programMode === 'faders' && <section className="fader-bank"><header><span>FIXTURE FADERS</span><strong>Fixture-level brightness · semantic dimmer</strong></header><div>{patch.map((fixture) => <VerticalFader key={fixture.id} id={fixture.id} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={fixture.labelColor ?? '#55e98d'} value={fixtureIntensityPercent(universe, fixture)} selected={fixture.selected} onChange={(value) => void setFixtureAttribute(fixture, 'dimmer', percentToDmx(value))} onSelect={() => selectFixtureFromConsole(fixture.id, true)} onFx={() => selectFixtureFromConsole(fixture.id)} />)}</div></section>}
          {programMode === 'groups' && <section className="fader-bank"><header><span>GROUP MASTERS</span><strong>Non-destructive output multipliers</strong></header><div>{fixtureGroups.map((group) => { const members = fixturesInGroup(patch, group); return <VerticalFader key={group.id} id={group.id} name={group.name} subtitle={`${members.length} fixtures`} color={group.labelColor} value={Math.round(groupMasters[group.id] ?? group.masterDefault)} selected={selectedGroupId === group.id} onChange={(value) => applyGroupMaster(group, value)} onSelect={() => selectFixtureGroup(group.id)} onFx={() => selectFixtureGroup(group.id)} quickAction={{ label: 'Chase', onPress: () => startEffect('chase', members.map((fixture) => fixture.id)) }} />; })}</div></section>}
          {programMode === 'stage' && <><div className="stage-console-toolbar"><div role="toolbar">{STAGE_DESIGNER_MODES.map((mode) => <button key={mode.id} className={stageMode === mode.id ? 'active' : ''} onClick={() => setStageMode(mode.id)}>{mode.label}</button>)}</div><span>{selectedFixtureTargets.length} selected</span></div><div className="program-stage">{renderStagePreview(true)}</div></>}
          {programMode === 'fx' && <div className="fx-editor-workspace">
            <section className="fx-graph-panel"><header><div><span>FX SHAPE</span><strong>{fxEditor.name}</strong></div><button onClick={saveCustomFx}>SAVE TO BANK</button></header><svg viewBox="0 0 600 140" role="img" aria-label={`${fxEditor.waveform} effect waveform`}><g className="fx-grid">{[0,100,200,300,400,500,600].map((x) => <line key={`x${x}`} x1={x} y1="10" x2={x} y2="130" />)}{[20,45,70,95,120].map((y) => <line key={`y${y}`} x1="0" y1={y} x2="600" y2={y} />)}</g><polyline className="fx-wave-line" points={fxGraphPoints(fxEditor.waveform,fxEditor.depth,fxEditor.offset)} /></svg><footer><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span></footer></section>
            <section className="fx-editor-controls"><label><span>NAME</span><input value={fxEditor.name} onChange={(event) => setFxEditor((current) => ({...current,name:event.target.value}))} /></label><label><span>PARAMETER</span><select value={fxEditor.parameter} onChange={(event) => setFxEditor((current) => ({...current,parameter:event.target.value as EffectParameter}))}>{(['dimmer','pan','tilt','uv'] as EffectParameter[]).map((parameter) => <option key={parameter} value={parameter}>{parameter.toUpperCase()}</option>)}</select></label><label><span>SHAPE</span><select value={fxEditor.waveform} onChange={(event) => setFxEditor((current) => ({...current,waveform:event.target.value as EffectWaveform}))}>{(['sine','triangle','square','saw','reverse-saw','step'] as EffectWaveform[]).map((wave) => <option key={wave} value={wave}>{wave.toUpperCase()}</option>)}</select></label><label><span>BPM · {fxEditor.bpm}</span><input type="range" min="20" max="240" value={fxEditor.bpm} onChange={(event) => setFxEditor((current) => ({...current,bpm:Number(event.target.value)}))} /></label><label><span>DEPTH · {fxEditor.depth}%</span><input type="range" min="0" max="100" value={fxEditor.depth} onChange={(event) => setFxEditor((current) => ({...current,depth:Number(event.target.value)}))} /></label><label><span>PHASE SPREAD · {fxEditor.phaseSpread}%</span><input type="range" min="0" max="100" value={fxEditor.phaseSpread} onChange={(event) => setFxEditor((current) => ({...current,phaseSpread:Number(event.target.value)}))} /></label><label><span>BASE · {fxEditor.offset}%</span><input type="range" min="0" max="100" value={fxEditor.offset} onChange={(event) => setFxEditor((current) => ({...current,offset:Number(event.target.value)}))} /></label><button className="console-primary" onClick={() => runCustomFx(fxEditor,programEffectFixtures.map((fixture) => fixture.id))}>PREVIEW FX</button></section>
            <section className="fx-bank"><header><span>FX BANK</span><small>Factory + custom effects</small></header><div>{EFFECT_PRESETS.map((effect) => <button key={effect.id} className={selectedFxBankId === effect.id ? 'active' : ''} onClick={() => loadFactoryFx(effect)}><i className={`fx-icon fx-${effect.id}`} /><strong>{effect.name}</strong><small>{EFFECT_SHAPES[effect.id].waveform} · {effect.defaultBpm} bpm</small></button>)}{customEffects.map((effect) => <button key={effect.id} className={selectedFxBankId === effect.id ? 'active custom' : 'custom'} onClick={() => {setSelectedFxBankId(effect.id);setFxEditor(effect);}} onDoubleClick={() => runCustomFx(effect,programEffectFixtures.map((fixture) => fixture.id))}><i>∿</i><strong>{effect.name}</strong><small>{effect.waveform} · {effect.bpm} bpm</small></button>)}</div></section>
          </div>}
          {programMode !== 'fx' && <LooksStrip looks={allLooks} onApply={runLook} onSave={saveCurrentLook} />}
        </div>
        <aside className="console-inspector program-inspector"><header><span>{programMode === 'groups' ? 'GROUP INSPECTOR' : 'PROGRAM INSPECTOR'}</span><strong>{programEffectName}</strong><small>{programEffectFixtures.length} fixture{programEffectFixtures.length === 1 ? '' : 's'} targeted</small></header>{programMode === 'groups' && selectedGroup ? <><label><span>Master</span><input type="range" min="0" max="100" value={Math.round(groupMasters[selectedGroup.id] ?? selectedGroup.masterDefault)} onChange={(event) => applyGroupMaster(selectedGroup,Number(event.target.value))} /></label><label className="inspector-toggle"><span>FX Enabled</span><input type="checkbox" checked={selectedGroup.fxEnabled} onChange={(event) => updateFixtureGroup(selectedGroup.id,{ fxEnabled:event.target.checked })} /></label></> : inspectedFixture ? <><div className="program-fixture-summary"><i style={{ background: inspectedFixture.labelColor ?? '#55e98d' }} /><span><strong>{findProfile(inspectedFixture.profileId)?.model ?? inspectedFixture.name}</strong><small>U{inspectedFixture.universe ?? 1} · {addressLabel(inspectedFixture.address)}</small></span></div><button onClick={() => { setWorkspace('setup'); setSetupView('stage'); setInspectorTab('inspector'); }}>Open Spatial Inspector</button></> : <div className="empty-inspector"><strong>Select a fixture or group</strong><span>The inspector follows your programming target.</span></div>}<EffectsPanel title="FX" targetName={programEffectName} fixtures={programEffectFixtures} activeEffect={activeEffect} bpm={effectBpm} depth={effectDepth} disabled={programMode === 'groups' && !selectedGroup?.fxEnabled} onBpmChange={(value) => { setEffectBpm(value); effectBpmRef.current = value; setTempoSource('manual'); }} onDepthChange={(value) => { setEffectDepth(value); effectDepthRef.current = value; }} onStart={(effect) => toggleEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onPress={(effect) => startMomentaryEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onRelease={releaseMomentaryEffect} onStop={() => stopEffect()} /></aside>
      </section>}

      {workspace === 'show' && <section className="show-console show-reference-shell">
        <aside className="show-sidebar"><header><strong>SHOW</strong><span>Program the service.</span></header><nav><button className={showMode === 'cues' ? 'active' : ''} onClick={() => setShowMode('cues')}>▣ <span>Cues</span></button><button onClick={() => setShowMode('cues')}>▻ <span>Timeline</span></button><button className={showMode === 'tracks' ? 'active' : ''} onClick={() => setShowMode('tracks')}>↔ <span>Tracks</span></button><button className={showMode === 'library' ? 'active' : ''} onClick={() => setShowMode('library')}>▤ <span>Show Library</span></button><button onClick={() => { setWorkspace('setup'); setSetupView('settings'); }}>∿ <span>MIDI / Sync</span></button><button onClick={() => setShowMode('tracks')}>◉ <span>Recordings</span></button></nav><blockquote>“Light supports<br/>the moment.”</blockquote></aside>
        {showMode === 'cues' ? <div className="show-reference-main">
          <section className="show-cues-card"><header><div><strong>Cues</strong><small>Create, organize, and fine-tune your cues.</small></div><input aria-label="Search cues" placeholder="Search cues…" /></header><div className="show-cue-actions"><button className="console-primary" onClick={captureCue}>＋ Add Cue</button><button>＋ Add Folder</button><button>•••</button></div><div className="show-cue-columns"><span>#</span><span>Name</span><span>Fade</span><span>Delay</span></div><div className="show-reference-cue-list">{showFile.cues.length ? showFile.cues.map((cue,index) => <button key={cue.id} className={activeCueId === cue.id ? 'active' : ''} onClick={() => { setActiveCueId(cue.id); }}><b>{cue.number}</b><i style={{background:cue.color ?? lookSwatch(cue.values)}}/><span>{cue.name}</span><small>{cue.fadeMs ? `${cue.fadeMs/1000}s` : 'Snap'}</small><small>{(cue.delayMs ?? 0)/1000}s</small><em>•••</em></button>) : <div className="empty-cues"><strong>No cues yet</strong><span>Build a look in Program, then add your first cue.</span></div>}</div></section>
          <section className="show-cue-details"><header><strong>Cue Details</strong><button>•••</button></header>{activeCue ? <><label><span>Name</span><input value={activeCue.name} onChange={(event)=>updateCueProperties(activeCue.id,{name:event.target.value})}/></label><label><span>Color</span><input type="color" value={activeCue.color ?? '#55e98d'} onChange={(event)=>updateCueProperties(activeCue.id,{color:event.target.value})}/></label><div className="inspector-pair"><label><span>Fade Time</span><input type="number" min="0" step=".1" value={activeCue.fadeMs/1000} onChange={(event)=>updateCueProperties(activeCue.id,{fadeMs:Number(event.target.value)*1000})}/></label><label><span>Delay</span><input type="number" min="0" step=".1" value={(activeCue.delayMs ?? 0)/1000} onChange={(event)=>updateCueProperties(activeCue.id,{delayMs:Number(event.target.value)*1000})}/></label></div><label><span>Follow</span><select value={(activeCue.followMs ?? 0)>0?'follow':'manual'} onChange={(event)=>updateCueProperties(activeCue.id,{followMs:event.target.value==='follow'?Math.max(1000,activeCue.followMs ?? 1000):0})}><option value="manual">Next Cue / Manual</option><option value="follow">Timed Follow</option></select></label><label><span>Description</span><textarea value={activeCue.description ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{description:event.target.value})}/></label><div className="cue-target-summary"><strong>Included Targets</strong><span>{patch.length} fixtures · {fixtureGroups.length} groups</span></div><button className="console-primary" onClick={()=>updateCue(activeCue.id)}>Update From Output</button></> : <div className="empty-inspector"><strong>Select a cue</strong><span>Its timing and metadata will appear here.</span></div>}</section>
          <section className="show-stage-preview"><header><div className="preview-title"><strong>Stage Preview</strong><small className={lumaVizPreview ? 'viz-live' : 'local-live'}>● {lumaVizPreview ? `LumaViz LIVE · ${(lumaVizPreview.view ?? 'camera').toUpperCase()}` : 'LumaRig LOCAL'}</small></div><div>{!lumaVizPreview && <><button onClick={()=>setStageView('front')}>Front</button><button onClick={()=>setStageView(stageView==='perspective'?'front':'perspective')}>{stageView==='perspective'?'2D':'3D'}</button></>}</div></header>{lumaVizPreview ? <div className="lumaviz-preview-feed"><img src={lumaVizPreview.dataUrl} alt="Live LumaViz stage preview" /><span>LIVE VISUALIZER FEED</span></div> : renderStagePreview()}</section>
          <section className="show-cue-timeline"><header><strong>Cue Timeline</strong><small>{activeCue?.name ?? 'Select a cue'}</small></header><div className="cue-timeline-ruler">{[0,1,2,3,4,5,6,7,8].map((n)=><span key={n}>{n}s</span>)}</div><div className="cue-timeline-tracks"><label>☼ Intensity<i style={{width:activeCue?`${Math.min(92,28+(activeCue.fadeMs/1000)*16)}%`:'0%'}}/></label><label>● Color<i className="color" style={{width:activeCue?'48%':'0%'}}/></label><label>✣ Position<i className="position" style={{width:activeCue?'66%':'0%'}}/></label><label>✳ FX<i className="fx" style={{width:activeCue?.linkedEffectId?'72%':'0%'}}/></label></div></section>
          <section className="show-settings-card"><header><strong>Show Settings</strong></header><div><label><span>Tempo (BPM)</span><input type="number" min="20" max="240" value={effectBpm} onChange={(event)=>{setEffectBpm(Number(event.target.value));effectBpmRef.current=Number(event.target.value);}}/></label><label><span>Timecode</span><input value={formatShowTime(externalSongPositionMs || showTrackPositionMs)} readOnly/></label><label><span>External Sync</span><select value={tempoSource} onChange={(event)=>setTempoSource(event.target.value as 'manual'|'midi')}><option value="manual">Internal</option><option value="midi">MIDI Clock</option></select></label></div></section>
          <section className="show-mini-library"><header><strong>Show Library</strong><button onClick={()=>setShowMode('library')}>＋ New Show</button></header>{showLibrary.slice(0,4).map((item)=><button key={item.id} onClick={()=>loadShowProject(item)}><span>▤ <strong>{item.name}</strong></span><small>{new Date(item.savedAt).toLocaleDateString()}</small></button>)}</section>
          <section className="show-playback-order"><header><strong>Playback Order</strong></header>{showFile.cues.slice(0,6).map((cue,index)=><div key={cue.id}><b>{index+1}</b><span>{cue.name}</span><small>⠿</small></div>)}</section>
        </div> : showMode === 'tracks' ? <div className="tracks-console show-reference-alt"><section className="console-panel track-source"><header><div><span>AUDIO & SHOW RECORDER</span><h2>{showTrackName || 'No track loaded'}</h2></div><label className="file-button"><input type="file" accept="audio/*" onChange={loadShowTrack}/>{showTrackName?'Change Track':'Load Track'}</label></header><div className="track-timeline"><span>{formatShowTime(showTrackPositionMs)}</span><input type="range" min="0" max={Math.max(1,showTrackDurationMs)} value={Math.min(showTrackPositionMs,Math.max(1,showTrackDurationMs))} onChange={(event)=>{const next=Number(event.target.value);if(showTrackAudioRef.current)showTrackAudioRef.current.currentTime=next/1000;setShowTrackPositionMs(next);}}/><span>{formatShowTime(showTrackDurationMs)}</span></div><div className="track-actions"><button onClick={toggleShowTrackPreview}>Play / Pause</button><button className="record-button" onClick={startShowRecording}>● Record Show</button></div></section><section className="console-panel recorded-takes-console"><header><div><span>LIGHTING TAKES</span><h2>{showFile.recordings?.length ?? 0} saved</h2></div></header>{showFile.recordings?.map((recording)=><article key={recording.id}><span><strong>{recording.name}</strong><small>{formatShowTime(recording.durationMs)}</small></span><button onClick={()=>playingRecordingId===recording.id?stopRecordedShowPlayback():playShowRecording(recording)}>{playingRecordingId===recording.id?'Stop':'Play'}</button></article>)}</section></div> : <div className="show-library-console show-reference-alt"><header><div><span>SHOW LIBRARY</span><h2>{showFile.name}</h2></div><div><button onClick={newShowProject}>＋ New Show</button><button className="console-primary" onClick={()=>saveShowProject('show')}>Save Current Show</button></div></header><div className="show-library-grid">{showLibrary.map((item)=><article key={item.id}><div><strong>{item.name}</strong><small>{item.show.cues.length} cues · {item.patch.length} fixtures</small></div><button onClick={()=>loadShowProject(item)}>Load</button></article>)}</div></div>}
      </section>}

      {workspace === 'live' && <section className="live-reference-shell">
        <aside className="live-sidebar"><header><strong>LIVE</strong><span>Operate the show.</span></header><nav>{([['performance','▷','Performance'],['fixtures','♙','Fixture Overrides'],['groups','♧','Groups'],['masters','⌘','Master Controls'],['shortcuts','▣','Shortcuts']] as Array<[LiveView,string,string]>).map(([id,icon,label])=><button key={id} className={liveView===id?'active':''} onClick={()=>{setLiveView(id);if(id==='fixtures')setLiveBank('fixtures');if(id==='groups')setLiveBank('groups')}}><b>{icon}</b><span>{label}</span></button>)}<button onClick={()=>{setWorkspace('setup');setSetupView('settings')}}><b>⚙</b><span>Settings</span></button></nav><blockquote><b>LIVE</b>Run your show with confidence.</blockquote></aside>
        <div className="live-reference-main">
          <header className="live-summary-row"><article><span>Current Cue</span><div><b>{activeCue?.number ?? '—'}</b><strong>{activeCue?.name ?? 'Ready'}</strong><small>{activeCue ? `Cue ${activeCue.number}` : 'No cue running'}</small></div></article><article><span>Next Cue</span><div><b>{nextCue?.number ?? '—'}</b><strong>{nextCue?.name ?? 'End of Show'}</strong><small>{nextCue ? 'Standing by' : 'Complete'}</small></div></article><article className="service-progress"><span>Service Progress</span><progress max={Math.max(1,showFile.cues.length)} value={Math.max(0,showFile.cues.findIndex((cue)=>cue.id===activeCueId)+1)} /><small>{showFile.cues.length ? `${Math.max(0,showFile.cues.findIndex((cue)=>cue.id===activeCueId)+1)} / ${showFile.cues.length} cues` : 'No cues'}</small></article></header>
          {liveView === 'performance' ? <>
            <section className="live-stage-card"><header><div><strong>Live Stage</strong><small className={lumaVizPreview?'viz-live':'local-live'}>● {lumaVizPreview?'LumaViz LIVE':'LumaRig LOCAL'}</small></div><button onClick={()=>setStageView(stageView==='perspective'?'front':'perspective')}>{stageView==='perspective'?'3D':'Front View'}</button></header>{lumaVizPreview?<div className="lumaviz-preview-feed"><img src={lumaVizPreview.dataUrl} alt="Live LumaViz stage preview"/><span>LIVE VISUALIZER FEED</span></div>:renderStagePreview()}</section>
            <aside className="live-go-rail"><section><header>GO</header><button className="live-reference-go" onClick={goNextCue} disabled={!nextCue}>GO</button><div><button onClick={goPreviousCue}>◀ Back</button><button onClick={goNextCue} disabled={!nextCue}>Next ▶</button></div></section><section className="live-reference-blackout"><header>Blackout</header><button className={dmxStatus.blackout?'active':''} onClick={toggleBlackout}>{dmxStatus.blackout?'RELEASE BLACKOUT':'BLACKOUT'}</button></section></aside>
            <section className="live-reference-masters"><header><strong>Master Controls</strong></header><div>{[['Master',globalMaster,(v:number)=>applyGlobalMaster(v)],['Intensity',selectedFixtureTargets.length===1?(fixtureIntensityPercent(universe,selectedFixtureTargets[0])??0):100,(v:number)=>selectedFixtureTargets.forEach((fixture)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(v)))],['FX',effectDepth,(v:number)=>setEffectDepth(v)]] .map(([label,value,handler])=><label key={label as string}><span>{label as string}</span><input type="range" min="0" max="100" value={value as number} onChange={(event)=>(handler as (v:number)=>void)(Number(event.target.value))}/><b>{value as number}%</b></label>)}</div></section>
            <section className="live-reference-looks"><header><strong>Quick Looks</strong><button onClick={()=>setWorkspace('program')}>Edit</button></header><div>{allLooks.slice(0,6).map((look)=><button key={look.id} onClick={()=>runLook(look)}><i style={{background:lookSwatch(look.values)}}/><strong>{look.name}</strong></button>)}</div></section>
            <section className="live-reference-fx"><header><strong>Performance FX</strong>{activeEffect&&<button onClick={()=>stopEffect()}>STOP</button>}</header><div>{EFFECT_PRESETS.filter((effect)=>['chase','color-chase','sweep','strobe','pulse','sparkle','bump','blinder'].includes(effect.id)&&effectSupportedByFixtures(effect.id,selectedFixtureTargets)).slice(0,8).map((effect)=>renderEffectButton(effect,true))}</div></section>
          </> : liveView === 'masters' ? <section className="live-alt-panel live-master-alt"><header><div><strong>Master Controls</strong><small>Global output and performance shaping</small></div></header><div className="master-alt-grid"><label><span>GRAND MASTER</span><strong>{globalMaster}%</strong><input type="range" min="0" max={settings.masterLimit} value={globalMaster} onChange={(event)=>applyGlobalMaster(Number(event.target.value))}/></label><label><span>FX DEPTH</span><strong>{effectDepth}%</strong><input type="range" min="0" max="100" value={effectDepth} onChange={(event)=>setEffectDepth(Number(event.target.value))}/></label><label><span>FX SPEED</span><strong>{effectBpm} BPM</strong><input type="range" min="30" max="240" value={effectBpm} onChange={(event)=>setEffectBpm(Number(event.target.value))}/></label></div><button className={dmxStatus.blackout?'master-blackout active':'master-blackout'} onClick={toggleBlackout}>{dmxStatus.blackout?'RELEASE BLACKOUT':'BLACKOUT'}</button></section> : liveView === 'shortcuts' ? <section className="live-alt-panel live-shortcuts"><header><div><strong>Shortcuts</strong><small>Fast FOH actions</small></div></header><div><button onClick={goPreviousCue}>← PREVIOUS CUE</button><button className="console-primary" onClick={goNextCue} disabled={!nextCue}>GO · {nextCue?.name??'END'}</button>{allLooks.slice(0,6).map((look)=><button key={look.id} onClick={()=>runLook(look)}>{look.name}</button>)}{EFFECT_PRESETS.filter((effect)=>effectSupportedByFixtures(effect.id,selectedFixtureTargets)).slice(0,6).map((effect)=>renderEffectButton(effect,true))}</div></section> : <section className="live-alt-panel live-overrides"><header><div><strong>{liveView==='groups'?'Groups':'Fixture Overrides'}</strong><small>{liveView==='groups'?'Busk groups without leaving LIVE':'Temporary live fixture control'}</small></div><div><button onClick={selectAllFixtures}>All</button><button onClick={clearFixtureSelection}>Clear</button></div></header><div className="live-fader-row">{liveView==='fixtures'?patch.map((fixture)=><VerticalFader key={fixture.id} id={`live-${fixture.id}`} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={fixture.labelColor??'#55e98d'} value={fixtureIntensityPercent(universe,fixture)} selected={fixture.selected} onChange={(value)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value))} onSelect={()=>selectFixtureFromConsole(fixture.id,true)} onFx={()=>selectFixtureFromConsole(fixture.id)}/>):fixtureGroups.map((group)=>{const members=fixturesInGroup(patch,group);return <VerticalFader key={group.id} id={`live-${group.id}`} name={group.name} subtitle={`${members.length} fixtures`} color={group.labelColor} value={Math.round(groupMasters[group.id]??group.masterDefault)} selected={selectedGroupId===group.id} onChange={(value)=>applyGroupMaster(group,value)} onSelect={()=>selectFixtureGroup(group.id)} onFx={()=>selectFixtureGroup(group.id)} quickAction={{label:'Chase',onPress:()=>toggleEffect('chase',members.map((fixture)=>fixture.id))}}/>})}</div></section>}
          <section className="live-busk-deck"><header><nav><button className="active">EXECUTORS</button><button onClick={()=>setLiveView('groups')}>GROUPS</button><button onClick={()=>setLiveProgrammerOpen((value)=>!value)}>PROGRAMMER</button><button onClick={()=>{setLiveProgrammerOpen(true);setControlSurfaceTab('fx')}}>FX</button></nav><div><button onClick={()=>setLiveExecutorBank((bank)=>Math.max(0,bank-1))}>‹</button><strong>BANK {String.fromCharCode(65+liveExecutorBank)}</strong><button onClick={()=>setLiveExecutorBank((bank)=>(bank+1)%4)}>›</button></div></header><div className="live-executor-strip">{Array.from({length:10},(_,slot)=>{const index=liveExecutorBank*10+slot;const item=liveExecutorItems[index];return <article key={slot} className={item?`executor ${item.kind}`:'executor empty'}><button className="executor-main" disabled={!item} onClick={()=>item&&fireLiveExecutor(item)}><b>{index+1}</b><span>{item?.name??'—'}</span><small>{item?.kind.toUpperCase()??'EMPTY'}</small></button><input aria-label={item?`${item.name} level`:`Executor ${index+1}`} type="range" min="0" max="100" defaultValue={item?.kind==='group'?Math.round(groupMasters[item.group.id]??item.group.masterDefault):item?100:0} disabled={!item} onChange={(event)=>{if(item?.kind==='group')applyGroupMaster(item.group,Number(event.target.value))}}/><button className="executor-flash" disabled={!item} onPointerDown={()=>item&&flashLiveExecutor(item,true)} onPointerUp={()=>item&&flashLiveExecutor(item,false)} onPointerCancel={()=>item&&flashLiveExecutor(item,false)}>FLASH</button></article>})}</div></section>
          {liveProgrammerOpen&&<section className="live-programmer-drawer"><header><div><span>PROGRAMMER</span><strong>{selectedFixtureTargets.length? `${selectedFixtureTargets.length} selected`:'No selection'}</strong></div><nav>{(['groups','intensity','position','color','beam','fx'] as const).map((family)=><button key={family} className={livePaletteFamily===family?'active':''} onClick={()=>setLivePaletteFamily(family)}>{family.toUpperCase()}</button>)}</nav><button onClick={()=>setLiveProgrammerOpen(false)}>×</button></header><div className="live-palette-grid">
{livePaletteFamily==='groups'&&<>{fixtureGroups.map((group,index)=><button key={group.id} className={selectedGroupId===group.id?'selected':''} onClick={()=>selectFixtureGroup(group.id)}><b>{index+1}</b><span>{group.name}</span><small>{fixturesInGroup(patch,group).length} FIXTURES</small></button>)}</>}
{livePaletteFamily==='intensity'&&<>{[0,25,50,75,100].map((value)=><button key={value} onClick={()=>selectedFixtureTargets.forEach((fixture)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value)))}><b>{value===0?'OFF':value}</b><span>{value===0?'Black':'Intensity'}</span><small>{value}%</small></button>)}</>}
{livePaletteFamily==='position'&&<>{(showFile.positionPalettes??[]).map((palette,index)=><button key={palette.id} onClick={()=>void runPositionPalette(palette)}><b>{index+1}</b><span>{palette.name}</span><small>{palette.kind.toUpperCase()}</small></button>)}{!(showFile.positionPalettes??[]).length&&<div className="palette-empty">Save Position palettes in PROGRAM and they will appear here.</div>}</>}
{livePaletteFamily==='color'&&<>{consoleColorPresets.map((preset,index)=><button key={preset.name} className="color-palette" onClick={()=>applyGlobalColor(preset.color)}><i style={{background:preset.color}}/><b>{index+1}</b><span>{preset.name}</span><small>{preset.color}</small></button>)}</>}
{livePaletteFamily==='beam'&&<>{[['Open',255,255,255],['Tight',65,180,210],['Wide',230,110,255],['Soft',200,80,170]] .map(([name,zoom,focus,iris],index)=><button key={name as string} onClick={()=>selectedFixtureTargets.forEach((fixture)=>{if(parameterChannel(fixture,'zoom'))void setFixtureAttribute(fixture,'zoom',zoom as number);if(parameterChannel(fixture,'focus'))void setFixtureAttribute(fixture,'focus',focus as number);if(parameterChannel(fixture,'iris'))void setFixtureAttribute(fixture,'iris',iris as number)})}><b>{index+1}</b><span>{name as string}</span><small>BEAM</small></button>)}</>}
{livePaletteFamily==='fx'&&<>{EFFECT_PRESETS.filter((effect)=>effectSupportedByFixtures(effect.id,selectedFixtureTargets)).map((effect,index)=><button key={effect.id} className={activeEffect===effect.id?'selected':''} onClick={()=>toggleEffect(effect.id,selectedFixtureTargets.map((fixture)=>fixture.id))}><b>{index+1}</b><span>{effect.name}</span><small>{effect.defaultBpm} BPM</small></button>)}</>}
</div></section>}
          <footer className="live-reference-health"><span>LumaRig {appVersion}</span><b>LIVE</b><span>Universes: {Math.max(1,...patch.map((fixture)=>fixture.universe??1))}</span><span className={dmxStatus.connected?'healthy':''}>● DMX {dmxStatus.connected?'OK':'VIRTUAL'}</span><span>{patch.length} Fixtures</span><span>40 FPS</span></footer>
        </div>
      </section>}

      {(workspace === 'setup' || workspace === 'program') && <section className="persistent-control-surface">
        <div className="surface-tabs">{(['intensity','color','position','beam','gobo','fx','speed'] as ControlSurfaceTab[]).map((tab) => <button key={tab} disabled={!surfaceSupports(tab)} className={controlSurfaceTab === tab ? 'active' : ''} onClick={() => setControlSurfaceTab(tab)}>{tab.toUpperCase()}</button>)}<span>{selectedFixtureTargets.length ? `${selectedFixtureTargets.length} SELECTED` : 'NO SELECTION'}</span>{(['encoders','faders','xy','palettes'] as ControlSurfaceMode[]).map((mode) => <button key={mode} className={controlSurfaceMode === mode ? 'surface-mode active' : 'surface-mode'} onClick={() => setControlSurfaceMode(mode)}>{mode.toUpperCase()}</button>)}</div>
        <div className={`surface-controls surface-${controlSurfaceTab}`}>
          {controlSurfaceTab === 'intensity' && <><label><span>DIMMER</span><input type="range" min="0" max="100" value={selectedFixtureTargets.length === 1 ? (fixtureIntensityPercent(universe, selectedFixtureTargets[0]) ?? 0) : 0} disabled={!selectedFixtureTargets.length} onChange={(event) => selectedFixtureTargets.forEach((fixture) => void setFixtureAttribute(fixture, 'dimmer', percentToDmx(Number(event.target.value))))} /></label><label><span>GRAND MASTER</span><input type="range" min="0" max={settings.masterLimit} value={globalMaster} onChange={(event) => applyGlobalMaster(Number(event.target.value))} /></label></>}
          {controlSurfaceTab === 'color' && <ColorDeck title="COLOR" subtitle={compatibleColorFixtures(selectedFixtureTargets).length ? `${compatibleColorFixtures(selectedFixtureTargets).length} compatible fixture${compatibleColorFixtures(selectedFixtureTargets).length === 1 ? '' : 's'}` : 'Color wheel fixture'} color={globalColor} disabled={!surfaceSupports('color')} onChange={(color) => { setGlobalColor(color); const rgb = hexToRgb(color); compatibleColorFixtures(selectedFixtureTargets).forEach((fixture) => void setFixtureColor(fixture, rgb)); }} presets={COLOR_PRESETS.map((preset) => ({ name: preset.name, color: rgbToHex(preset.rgb[0], preset.rgb[1], preset.rgb[2]) }))} />}
          {controlSurfaceTab === 'position' && (controlSurfaceMode === 'xy' ? <div className="surface-xy-pad" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); applySurfaceXY(event.clientX,event.clientY,event.currentTarget); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) applySurfaceXY(event.clientX,event.clientY,event.currentTarget); }}><i /><span>PAN</span><b>TILT</b></div> : controlSurfaceMode === 'palettes' ? <div className="surface-palette-bank">{(showFile.positionPalettes ?? []).map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}><i>◎</i><strong>{palette.name}</strong><small>{palette.kind}</small></button>)}{!(showFile.positionPalettes ?? []).length && <small>No position palettes saved yet.</small>}</div> : <div className="surface-parameter-bank">{surfaceParameterControl('pan','PAN')}{surfaceParameterControl('tilt','TILT')}{selectedCapabilities.has('panFine') && surfaceParameterControl('panFine','PAN FINE')}{selectedCapabilities.has('tiltFine') && surfaceParameterControl('tiltFine','TILT FINE')}</div>)}
          {controlSurfaceTab === 'beam' && <div className="surface-parameter-bank">{surfaceParameterControl('zoom','ZOOM')}{surfaceParameterControl('focus','FOCUS')}{surfaceParameterControl('iris','IRIS')}{surfaceParameterControl('prism','PRISM')}</div>}
          {controlSurfaceTab === 'gobo' && <div className="surface-parameter-bank">{(['gobo','goboRotate'] as FixtureParameter[]).map((parameter) => <label key={parameter}><span>{parameter === 'goboRotate' ? 'ROTATE' : 'GOBO'}</span><input type="range" min="0" max="255" disabled={!selectedCapabilities.has(parameter)} value={selectedFixtureTargets.length === 1 ? readFixtureParameter(universe, selectedFixtureTargets[0], parameter) : 0} onChange={(event) => selectedFixtureTargets.forEach((fixture) => void setFixtureAttribute(fixture, parameter, Number(event.target.value)))} /></label>)}</div>}
          {controlSurfaceTab === 'fx' && <div className="surface-fx-bank">{EFFECT_PRESETS.map((effect) => <button key={effect.id} disabled={!effectSupportedByFixtures(effect.id, selectedFixtureTargets)} className={activeEffect === effect.id ? 'active' : ''} onClick={() => toggleEffect(effect.id)}><span className={`fx-icon fx-${effect.id}`} /><b>{effect.name}</b></button>)}</div>}
          {controlSurfaceTab === 'speed' && <div className="surface-parameter-bank"><label><span>FX SPEED</span><input type="range" min="30" max="240" value={effectBpm} onChange={(event) => setEffectBpm(Number(event.target.value))} /></label><label><span>FX DEPTH</span><input type="range" min="0" max="100" value={effectDepth} onChange={(event) => setEffectDepth(Number(event.target.value))} /></label>{selectedCapabilities.has('movementSpeed') && <label><span>MOVE SPEED</span><input type="range" min="0" max="255" value={selectedFixtureTargets.length === 1 ? readFixtureParameter(universe, selectedFixtureTargets[0], 'movementSpeed') : 0} onChange={(event) => selectedFixtureTargets.forEach((fixture) => void setFixtureAttribute(fixture, 'movementSpeed', Number(event.target.value)))} /></label>}</div>}
          <div className="surface-quick"><button onClick={() => setWorkspace('show')}>CUES</button><button onClick={goPreviousCue}>PREV</button><button className="surface-go" onClick={goNextCue} disabled={!nextCue}>GO <small>{nextCue?.name ?? 'END'}</small></button><button onClick={() => setWorkspace('live')}>LIVE</button></div>
        </div>
      </section>}
      <footer className="console-footer"><span>{dmxStatus.last_error || midiStatus.last_error || message}</span><b>{patch.length} fixtures · {showFile.cues.length} cues · {showFile.recordings?.length ?? 0} takes · 40 Hz output{isFading ? ' · Fading' : ''}</b></footer>
    </main>
  );

}
