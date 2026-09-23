import { ColorPaletteLibrary } from './components/ColorPaletteLibrary';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
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
import { StudioBridgeDispatcher } from './core/studio-bridge-dispatcher';
import type { StudioBridgeCommand, StudioSongIdentity } from './core/studio-bridge-protocol';

type Workspace = 'build' | 'create' | 'show' | 'live';
type SetupView = 'fixtures' | 'groups' | 'stage' | 'settings';
type ProgramMode = 'stage' | 'looks' | 'fx' | 'colors' | 'media' | 'presets';
type ShowMode = 'cues' | 'timeline' | 'tracks' | 'library' | 'sync' | 'recordings';
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

function isCustomEffect(value: unknown): value is CustomEffect {
  if (!value || typeof value !== 'object') return false;
  const effect = value as Partial<CustomEffect>;
  return typeof effect.id === 'string'
    && typeof effect.name === 'string'
    && ['dimmer', 'pan', 'tilt', 'uv'].includes(String(effect.parameter))
    && ['sine', 'triangle', 'square', 'saw', 'reverse-saw', 'step'].includes(String(effect.waveform))
    && [effect.bpm, effect.depth, effect.phaseSpread, effect.offset].every((part) => typeof part === 'number' && Number.isFinite(part));
}

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
        && (candidate.status === 'template' || candidate.status === 'draft' || candidate.status === 'show')
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
  const [workspace, setWorkspace] = useState<Workspace>(() => initialConsoleValue('workspace', ['build', 'create', 'show', 'live'], 'create'));
  const [setupView, setSetupView] = useState<SetupView>(() => initialConsoleValue('setup', ['fixtures', 'groups', 'stage', 'settings'], 'stage'));
  const [programMode, setProgramMode] = useState<ProgramMode>(() => initialConsoleValue('program', ['stage', 'looks', 'fx', 'colors', 'media', 'presets'], 'stage'));
  const [showMode, setShowMode] = useState<ShowMode>(() => initialConsoleValue('show', ['cues', 'timeline', 'tracks', 'library', 'sync', 'recordings'], 'cues'));
  const [liveView, setLiveView] = useState<LiveView>(() => initialConsoleValue('live', ['performance', 'overrides', 'groups', 'masters', 'shortcuts', 'settings'], 'performance'));
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
  const [liveProgrammerOpen, setLiveProgrammerOpen] = useState(true);
  const [liveFaderPage, setLiveFaderPage] = useState(0);
  const [livePaletteFamily, setLivePaletteFamily] = useState<LivePaletteFamily>('groups');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  const [artNetTelemetry, setArtNetTelemetry] = useState({ framesSent: 0, lastError: "" });
  const [directStatus, setDirectStatus] = useState<LumaVizDirectStatus>({ listening: false, port: 9460, clients: 0, framesSent: 0 });
  const [lumaVizPreview, setLumaVizPreview] = useState<{ dataUrl: string; timestamp: number; view?: string } | null>(null);
  const [studioBridgeStatus, setStudioBridgeStatus] = useState<StudioBridgeStatus>({ listening: false, port: 47777, connectedClients: 0 });
  useEffect(() => {
    const refresh = () => {
      void invoke<StudioBridgeStatus>('studio_bridge_status')
        .then(setStudioBridgeStatus)
        .catch((error) => setStudioBridgeStatus((current) => ({ ...current, lastError: String(error) })));
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
      });
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
  const [remoteRelayStatus, setRemoteRelayStatus] = useState<RemoteRelayStatus>('disconnected');
  const [remoteRelayError, setRemoteRelayError] = useState('');
  const remoteRelayRef = useRef<RemoteRelay | null>(null);
  const remoteCommandHandlerRef = useRef<((envelope: RelayCommandEnvelope) => void) | null>(null);
  const remoteSnapshotHandlerRef = useRef<(() => void) | null>(null);
  const remotePublishTimerRef = useRef<number | null>(null);
  const remoteFlashLeaseRef = useRef<Map<string, number>>(new Map());
  const remoteEffectLeaseRef = useRef<Map<string, number>>(new Map());
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
    offset: 0
  });
  const [selectedFxBankId, setSelectedFxBankId] = useState<string>('pulse');
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
  const activeCueIdRef = useRef<string | null>(null);
  const pendingCueIdRef = useRef<string | null>(null);
  const cueDelayTimerRef = useRef<number | null>(null);
  const cueFollowTimerRef = useRef<number | null>(null);
  const cueGenerationRef = useRef(0);

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
      target: settingsRef.current.visualizerArtNetTarget.trim() || '127.0.0.1',
      blackout: runtimeRef.current?.snapshot.blackout ?? false
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
    const timer = window.setTimeout(() => window.localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(makePatchDocument(patch))), 120);
    return () => window.clearTimeout(timer);
  }, [patch]);
  useEffect(() => window.localStorage.setItem(LOOKS_STORAGE_KEY, JSON.stringify(savedLooks)), [savedLooks]);
  useEffect(() => window.localStorage.setItem(CUSTOM_FX_STORAGE_KEY, JSON.stringify(customEffects)), [customEffects]);
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
    activeCustomEffectIdRef.current = null;
    effectTargetIdsRef.current = [];
    setActiveEffect(null);
    setActiveCustomEffectId(null);
    if (effectAnimationRef.current !== null) window.cancelAnimationFrame(effectAnimationRef.current);
    effectAnimationRef.current = null;
    if (announce) setMessage('Effect stopped. The current output is held.');
  }

  async function publishRuntimeResult(result: RuntimeDispatchResult) {
    universeRef.current = result.baseFrame;
    setUniverse(result.baseFrame);
    outputUniverseRef.current = result.frame;
    setOutputUniverse(result.frame);
    try {
      await Promise.all(result.outputs.map((output) => outputRouterRef.current?.route(output.universe, output.frame)));
    } catch (error) {
      setMessage(`Output update failed: ${String(error)}`);
    }
    const blackout = runtimeRef.current?.snapshot.blackout ?? false;
    for (const output of result.outputs) {
      directSequenceRef.current += 1;
      const visualFrame = blackout ? makeUniverse() : output.frame;
      const directFrame = semanticFrameFromResolvedOutput(
        directSequenceRef.current,
        visualFrame,
        patchRef.current,
        output.universe,
        showFile.name
      );
      void sendLumaVizDirectFrame(directFrame).catch(() => {
        // Direct visualization is non-fatal and must never interrupt physical output.
      });
    }
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
    const targets = compatibleColorFixtures(selectedFixtures(patch));
    const updates = targets.flatMap((fixture) => {
      const result = fixtureColorUpdates(fixture, rgb);
      // Color recall preserves intensity; it must never bring a dark fixture live.
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

  function cancelPendingCueLaunches() {
    cueGenerationRef.current += 1;
    pendingCueIdRef.current = null;
    if (cueDelayTimerRef.current !== null) window.clearTimeout(cueDelayTimerRef.current);
    if (cueFollowTimerRef.current !== null) window.clearTimeout(cueFollowTimerRef.current);
    cueDelayTimerRef.current = null;
    cueFollowTimerRef.current = null;
  }

  function runCue(cue: ShowCue) {
    if (pendingCueIdRef.current === cue.id) return;
    cancelPendingCueLaunches();
    const generation = cueGenerationRef.current;
    const launch = () => {
      if (generation !== cueGenerationRef.current) return;
      cueDelayTimerRef.current = null;
      pendingCueIdRef.current = null;
      activeCueIdRef.current = cue.id;
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
        if (following) {
          cueFollowTimerRef.current = window.setTimeout(() => {
            if (generation === cueGenerationRef.current) runCue(following);
          }, cue.followMs);
        }
      }
    };
    if ((cue.delayMs ?? 0) > 0) {
      pendingCueIdRef.current = cue.id;
      cueDelayTimerRef.current = window.setTimeout(launch, cue.delayMs);
    } else launch();
  }

  function goNextCue() {
    if (pendingCueIdRef.current) return;
    const currentIndex = showFile.cues.findIndex((cue) => cue.id === activeCueIdRef.current);
    const next = currentIndex < 0 ? showFile.cues[0] : showFile.cues[currentIndex + 1];
    if (next) runCue(next);
    else setMessage(showFile.cues.length ? 'End of cue stack.' : 'Capture a cue before pressing GO.');
  }

  function goPreviousCue() {
    if (!showFile.cues.length) return;
    const currentIndex = showFile.cues.findIndex((cue) => cue.id === activeCueIdRef.current);
    runCue(showFile.cues[currentIndex <= 0 ? 0 : currentIndex - 1]);
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
    if (activeCueIdRef.current === id) {
      cancelPendingCueLaunches();
      activeCueIdRef.current = null;
      setActiveCueId(null);
    }
  }

  function saveShowProject(status: 'template' | 'draft' | 'show' = 'show') {
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
      show: sanitizeShow({ ...showFile, name: cleanName }),
      patch: patch.map((fixture, index) => migratePatchedFixture(fixture, index, patch.length, stageSettings.dimensions)),
      stageElements: stageElements.map((element) => migrateStageElement(element, stageSettings.dimensions)),
      stageSettings: { ...stageSettings, dimensions: { ...stageSettings.dimensions } },
      looks: [...savedLooks]
    };
    setShowLibrary((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 40));
    setMessage(`${cleanName} saved to the show library as ${status === 'template' ? 'a template' : status === 'draft' ? 'a draft' : 'a service show'}.`);
  }

  function loadShowProject(snapshot: ShowProjectSnapshot) {
    stopFade();
    if (activeEffectRef.current) stopEffect(false);
    setShowFile(sanitizeShow(snapshot.show));
    setPatch(snapshot.patch.map((fixture, index) => migratePatchedFixture(fixture, index, snapshot.patch.length, snapshot.stageSettings.dimensions)));
    setStageElements(snapshot.stageElements.map((element) => migrateStageElement(element, snapshot.stageSettings.dimensions)));
    setStageSettings(snapshot.stageSettings);
    setSavedLooks(snapshot.looks);
    cancelPendingCueLaunches();
    activeCueIdRef.current = null;
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
    cancelPendingCueLaunches();
    activeCueIdRef.current = null;
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

  async function dispatchStudioBridgeCommand(id: string, command: StudioBridgeCommand) {
    let createdSnapshot: ShowProjectSnapshot | undefined;
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
        createdSnapshot = snapshot;
        setShowLibrary((current) =>
          [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 40)
        );
        return snapshot.id;
      },
      loadShow: (showId) => {
        const snapshot = createdSnapshot?.id === showId ? createdSnapshot : showLibrary.find((item) => item.id === showId);
        if (!snapshot) throw new Error('The linked LumaRig show is missing from this device.');
        loadShowProject(snapshot);
      },
      goCue: (cueId) => {
        const cue = cueId ? showFile.cues.find((item) => item.id === cueId) : nextCue;
        if (!cue) throw new Error('No LumaRig cue is available.');
        const target = cue.universe?.length === 512 ? [...cue.universe] : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));
        fadeToUniverse(cue.name, target, cue.fadeMs, 'remote');
        setActiveCueId(cue.id);
      },
      fireScene: (sceneId) => {
        const cue = showFile.cues.find((item) => item.id === sceneId);
        if (!cue) throw new Error('LumaRig scene was not found.');
        const target = cue.universe?.length === 512 ? [...cue.universe] : applyUniverseUpdates(universeRef.current, lookUpdates(cue.values, selectedFixtures(patch)));
        fadeToUniverse(cue.name, target, cue.fadeMs, 'remote');
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
        setEffectBpm(bpm);
        effectBpmRef.current = bpm;
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
        setExternalSongPositionMs(positionMs);
        externalSongPositionMsRef.current = positionMs;
        setExternalTransportRunning(playing);
        externalTransportRunningRef.current = playing;
        setEffectBpm(bpm);
        effectBpmRef.current = bpm;
      }
    });
    return dispatcher.dispatch(id, command);
  }

  const studioDispatchRef = useRef(dispatchStudioBridgeCommand);
  studioDispatchRef.current = dispatchStudioBridgeCommand;
  const studioPollBusyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled || studioPollBusyRef.current) return;
      studioPollBusyRef.current = true;
      try {
        const requests = await invoke<Array<{ id: string; command: StudioBridgeCommand }>>('drain_studio_bridge');
        for (const request of requests) {
          if (cancelled) break;
          const response = await studioDispatchRef.current(request.id, request.command);
          try { await invoke('reply_studio_bridge', response); }
          catch (error) { setStudioBridgeStatus(current => ({ ...current, lastError: `Studio reply failed: ${String(error)}` })); }
        }
      } catch (error) {
        if ('__TAURI_INTERNALS__' in window) setStudioBridgeStatus(current => ({ ...current, lastError: `Studio bridge failed: ${String(error)}` }));
      } finally { studioPollBusyRef.current = false; }
    };
    const timer = window.setInterval(() => void poll(), 25);
    void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

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
    clearAllRemoteEffectLeases();
    clearAllRemoteFlashLeases(true);
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
    }
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
    setFxEditor({
      id: `factory-${effect.id}`,
      name: effect.name,
      parameter: shape.parameter,
      waveform: shape.waveform,
      bpm: effect.defaultBpm,
      depth: 100,
      phaseSpread: shape.phaseSpread,
      offset: 0
    });
  }

  function saveCustomFx() {
    const cleanName = fxEditor.name.trim() || 'Custom FX';
    const saved: CustomEffect = {
      ...fxEditor,
      name: cleanName,
      bpm: Math.max(20, Math.min(300, fxEditor.bpm)),
      depth: Math.max(0, Math.min(100, fxEditor.depth)),
      phaseSpread: Math.max(0, Math.min(100, fxEditor.phaseSpread)),
      offset: Math.max(0, Math.min(100, fxEditor.offset)),
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
    stopFade();
    stopEffect(false);
    setAudioArmed(false);
    const targetSet = targetIds?.length ? new Set(targetIds) : null;
    const effectFixtures = patchRef.current.map((fixture) => ({
      ...fixture,
      selected: targetSet ? targetSet.has(fixture.id) : fixture.selected
    }));
    if (!effectFixtures.some((fixture) => fixture.selected)) {
      setMessage('Select fixtures or a group before running the custom FX.');
      return;
    }
    effectBaseUniverseRef.current = [...universeRef.current];
    const startedAt = performance.now();
    activeCustomEffectIdRef.current = effect.id;
    setActiveCustomEffectId(effect.id);
    const tick = (now: number) => {
      if (activeCustomEffectIdRef.current !== effect.id) return;
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
          {(['perspective', 'top', 'front', 'side'] as StageView[]).map((view) => <button key={view} className={stageView === view ? 'active' : ''} onClick={() => setStageView(view)}>{view}</button>)}
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
    const bpm = tempoSource === 'midi' && midiBpm ? midiBpm : effectBpm;
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

  const consoleColorPresets = [...COLOR_PRESETS.map((preset) => ({
    name: preset.name,
    color: rgbToHex(preset.rgb[0], preset.rgb[1], preset.rgb[2])
  })), ...(showFile.colorPalettes ?? [])];
  const allLooks = [...STARTER_LOOKS, ...savedLooks];
  const programEffectFixtures = selectedFixtureTargets;
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
      <header className="console-header">
        <div className="console-brand"><span className="brand-mark">◆</span><div className="brand-product"><b>LUMARIG</b><small>SHOW</small></div><div className="brand-show"><input aria-label="Current show name" value={showFile.name} onChange={(event) => setShowFile((current) => ({ ...current, name: event.target.value }))} /><small>LIVE SHOWFILE · R{sharedShowRevisionRef.current}</small></div></div>
        <nav className="console-workspace-tabs" aria-label="Workspace">{(['build', 'create', 'show', 'live'] as Workspace[]).map((item) => <button key={item} className={workspace === item ? 'active' : ''} onClick={() => setWorkspace(item)}>{item.toUpperCase()}</button>)}</nav>
        <div className="console-header-status">
          <button className="tempo-pill" onClick={tapTempo}><strong>{tempoSource === 'midi' && midiBpm ? midiBpm : effectBpm} BPM</strong><small>{tempoSource === 'midi' ? 'MIDI CLOCK' : 'TAP'}</small></button>
          <button className={`connection-pill ${dmxStatus.connected ? 'online' : ''}`} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i /><span><strong>DMX</strong><small>{dmxStatus.connected ? 'CONNECTED' : 'VIRTUAL'}</small></span></button>
          <button className={`console-blackout ${dmxStatus.blackout ? 'active' : ''}`} onClick={toggleBlackout}>{dmxStatus.blackout ? 'RELEASE BLACKOUT' : 'BLACKOUT'}</button>
        </div>
      </header>

      <audio ref={showTrackAudioRef} src={showTrackUrl || undefined} preload="metadata" onLoadedMetadata={(event) => setShowTrackDurationMs(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration * 1000 : 0)} onTimeUpdate={(event) => setShowTrackPositionMs(event.currentTarget.currentTime * 1000)} onEnded={handleShowTrackEnded} />
      {dmxStatus.blackout && <div className="blackout-banner"><strong>BLACKOUT ACTIVE</strong><span>Programmed fixture values are preserved.</span><button onClick={toggleBlackout}>Release Blackout</button></div>}
      {showRecordingActive && <section className="console-recording-bar"><span className="recording-pulse" /><div><strong>RECORDING SHOW</strong><small>{showTrackName || 'Lighting only'} · {formatShowTime(showRecordingElapsedMs)}</small></div><button onClick={() => stopShowRecording(true)}>Stop + save</button><button onClick={() => stopShowRecording(false)}>Cancel</button></section>}
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

        <div className="setup-center console-center">
          {setupView === 'stage' && <>
            <div className="stage-console-toolbar"><div role="toolbar" aria-label="Stage Designer mode">{STAGE_DESIGNER_MODES.map((mode) => <button key={mode.id} className={stageMode === mode.id ? 'active' : ''} onClick={() => setStageMode(mode.id)}>{mode.label}</button>)}</div><span>{stageSettings.unit === 'feet' ? 'FEET' : 'METERS'} · {stageSettings.dimensions.width.toFixed(1)} × {stageSettings.dimensions.depth.toFixed(1)} m</span></div>
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

          {setupView === 'settings' && <div className="setup-scroll-area settings-console">
            <section className="console-panel connection-console"><header><div><span>DMX OUTPUT</span><h2>Anyma uDMX</h2></div><b className={dmxStatus.connected ? 'healthy' : ''}>{dmxStatus.connected ? 'Connected' : 'Virtual only'}</b></header><label><span>USB Interface</span><select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)} disabled={dmxStatus.connected}><option value="">Select uDMX</option>{devices.map((device) => <option key={device.device_key} value={device.device_key}>{deviceLabel(device)}</option>)}</select></label><div className="settings-actions"><button onClick={scanDevices}>Scan USB</button>{dmxStatus.connected ? <button onClick={disconnectDmx}>Disconnect + zero</button> : <button className="console-primary" disabled={!selectedInfo?.likely_udmx || busy} onClick={connectDmx}>Connect uDMX</button>}<button onClick={zeroAll}>Zero all</button></div></section>
            <section className="console-panel connection-console"><header><div><span>GENERAL MIDI</span><h2>Controller / Network Session</h2></div><b className={midiStatus.connected ? 'healthy' : ''}>{midiStatus.connected ? 'Listening' : 'Offline'}</b></header><label><span>MIDI Input</span><select value={selectedMidiInput} disabled={midiStatus.connected} onChange={(event) => setSelectedMidiInput(event.target.value)}><option value="">Select input</option>{midiInputs.map((input) => <option key={input.id} value={input.id}>{input.name}</option>)}</select></label><div className="settings-actions"><button onClick={scanMidi}>Scan MIDI</button>{midiStatus.connected ? <button onClick={disconnectMidi}>Disconnect</button> : <button className="console-primary" disabled={!selectedMidiInput} onClick={connectMidi}>Connect MIDI</button>}</div><div className="midi-event-monitor"><i className={midiStatus.last_event ? 'active' : ''} /><span><strong>{midiStatus.last_event || 'Waiting for MIDI'}</strong><small>{midiStatus.messages_received} messages · {midiClockSeen ? 'Clock detected' : 'No clock'}</small></span></div></section>
            <section className="console-panel midi-mapping-console"><header><div><span>MIDI ASSIGNER</span><h2>Map controls</h2></div><b>{midiMappings.length} mappings</b></header><div className="midi-add-row"><select value={newMidiTarget} onChange={(event) => setNewMidiTarget(event.target.value)}>{midiControlGroups.map(([group, controls]) => <optgroup key={group} label={group}>{controls.map((control) => <option key={control.id} value={control.id}>{control.label}</option>)}</optgroup>)}</select><button className="console-primary" onClick={() => beginMidiAssignment()}>Add + Learn</button></div><div className="midi-map-list">{midiMappings.map((mapping) => { const control = midiControls.find((item) => item.id === mapping.target); const learning = midiLearnMappingId === mapping.id; return <div className={`midi-map-row ${learning ? 'is-learning' : ''}`} key={mapping.id}><strong>{control?.label ?? 'Unavailable'}</strong><span>{learning ? 'Move or press a control…' : midiBindingLabel(mapping)}</span><button onClick={() => setMidiLearnMappingId(learning ? null : mapping.id)}>{learning ? 'Cancel' : 'Learn'}</button><button onClick={() => removeMidiAssignment(mapping.id)}>Remove</button></div>; })}</div></section>
            <section className="console-panel connection-console remote-relay-console"><header><div><span>REMOTE CONTROL · SEPARATE NETWORKS</span><h2>Secure Cloud Relay</h2></div><b className={remoteRelayStatus === 'connected' ? 'healthy' : ''}>{remoteRelayStatus}</b></header><p>Both this Mac and the Vercel controller connect outbound to one private Supabase Realtime channel. No router port forwarding is required.</p><label><span>Supabase Project URL</span><input value={remoteRelayConfig.url} placeholder="https://project.supabase.co" onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, url: event.target.value }))} /></label><label><span>Publishable Key</span><input type="password" value={remoteRelayConfig.publishableKey} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, publishableKey: event.target.value }))} /></label><div className="inspector-pair"><label><span>Account Email</span><input type="email" value={remoteRelayConfig.email} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, email: event.target.value }))} /></label><label><span>Password · never stored</span><input type="password" value={remoteRelayConfig.password ?? ''} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, password: event.target.value }))} /></label></div><label><span>Room Code · use the same code on the remote</span><div className="relay-room-row"><input value={remoteRelayConfig.roomCode} onChange={(event) => setRemoteRelayConfig((current) => ({ ...current, roomCode: event.target.value }))} /><button onClick={() => setRemoteRelayConfig((current) => ({ ...current, roomCode: `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}` }))}>Generate</button></div></label>{remoteRelayError && <p className="relay-error">{remoteRelayError}</p>}<div className="settings-actions">{remoteRelayStatus === 'connected' ? <button onClick={disconnectRemoteRelay}>Disconnect relay</button> : <button className="console-primary" onClick={connectRemoteRelay}>Connect remote relay</button>}</div></section>
            <section className="console-panel connection-console studio-bridge-console"><header><div><span>STUDIO LINK · SHOW CONTROL</span><h2>LumaStudio</h2></div><b className={studioBridgeStatus.listening && !studioBridgeStatus.lastError ? 'healthy' : ''}>{studioBridgeStatus.lastError ? 'Error' : studioBridgeStatus.connectedClients > 0 ? 'Connected' : studioBridgeStatus.listening ? 'Ready' : 'Starting'}</b></header><p>Semantic show-control bridge for Studio transport, cue recall, recorded lighting, FX and blackout. Studio never sends raw DMX.</p><div className="artnet-health-grid"><div><span>ENDPOINT</span><strong>ws://127.0.0.1:{studioBridgeStatus.port}/studio</strong></div><div><span>CLIENTS</span><strong>{studioBridgeStatus.connectedClients}</strong></div><div><span>PROTOCOL</span><strong>studio-bridge-v1</strong></div><div><span>AUTHORITY</span><strong>LumaRig</strong></div></div>{studioBridgeStatus.lastError && <p className="artnet-error">Studio Bridge: {studioBridgeStatus.lastError}</p>}<small>The bridge starts automatically. If Studio closes, lighting continues locally in LumaRig.</small></section>
            <section className="console-panel connection-console visualizer-direct-console"><header><div><span>VISUALIZER LINK · SEMANTIC WEBSOCKET</span><h2>LumaRig Direct</h2></div><b className={directStatus.listening && !directStatus.lastError ? 'healthy' : ''}>{directStatus.clients > 0 ? 'Connected' : directStatus.listening ? 'Ready' : 'Error'}</b></header><p>Native semantic link for LumaViz. Sends resolved fixture identity, intensity, color, movement, beam and strobe without making LumaViz decode DMX.</p><div className="artnet-health-grid"><div><span>ENDPOINT</span><strong>ws://127.0.0.1:{directStatus.port}/lumaviz</strong></div><div><span>CLIENTS</span><strong>{directStatus.clients}</strong></div><div><span>FRAMES SENT</span><strong>{directStatus.framesSent.toLocaleString()}</strong></div><div><span>PROTOCOL</span><strong>fixture-frame-v1</strong></div></div>{directStatus.lastError && <p className="artnet-error">Direct: {directStatus.lastError}</p>}<small>LumaRig Direct starts automatically. Art-Net remains available below as the standard DMX-over-network fallback.</small></section>
            <section className="console-panel connection-console visualizer-output-console"><header><div><span>VISUALIZER LINK · ART-NET</span><h2>LumaViz Connection</h2></div><b className={settings.visualizerArtNetEnabled && !artNetTelemetry.lastError ? 'healthy' : ''}>{artNetTelemetry.lastError ? 'Error' : settings.visualizerArtNetEnabled ? 'Live' : 'Off'}</b></header><p>LumaRig mirrors the final resolved DMX frame after cues, FX, manual overrides, group masters, and grand master. Physical DMX remains independent if the visualizer closes.</p><div className="artnet-health-grid"><div><span>TRANSPORT</span><strong>Art-Net / UDP 6454</strong></div><div><span>TARGET</span><strong>{settings.visualizerArtNetTarget || '127.0.0.1'}</strong></div><div><span>FRAMES SENT</span><strong>{artNetTelemetry.framesSent.toLocaleString()}</strong></div><div><span>STATUS</span><strong>{artNetTelemetry.lastError ? 'Send error' : settings.visualizerArtNetEnabled ? artNetTelemetry.framesSent > 0 ? 'Streaming' : 'Armed' : 'Stopped'}</strong></div></div>{artNetTelemetry.lastError && <p className="artnet-error">Art-Net: {artNetTelemetry.lastError}</p>}<label className="inspector-toggle"><span>Enable visualizer output</span><input type="checkbox" checked={settings.visualizerArtNetEnabled} onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetEnabled: event.target.checked }))} /></label><label><span>Target IPv4 address</span><input value={settings.visualizerArtNetTarget} placeholder="127.0.0.1" onChange={(event) => setSettings((current) => ({ ...current, visualizerArtNetTarget: event.target.value }))} /></label><small>Use 127.0.0.1 when LumaViz is on this computer. For another computer, use that machine's LAN IPv4. 255.255.255.255 broadcasts to the LAN.</small><div className="settings-actions"><button className="console-primary" onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '127.0.0.1', visualizerArtNetEnabled: true }))}>Connect LumaViz · This Mac</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetTarget: '255.255.255.255', visualizerArtNetEnabled: true }))}>Broadcast LAN</button><button onClick={() => setSettings((current) => ({ ...current, visualizerArtNetEnabled: false }))}>Stop Link</button></div></section>
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
            <div className="calibration-status"><span>CALIBRATION</span><strong>{inspectedFixture.calibration?.status ?? 'uncalibrated'}</strong><small>{Math.round((inspectedFixture.calibration?.confidence ?? 0) * 100)}% confidence</small></div><button onClick={() => setCalibrationOpen((value) => !value)}>{calibrationOpen ? 'Close Calibration' : 'Calibrate Position'}</button>{calibrationOpen && <div className="calibration-mini"><button onClick={homeActiveFixture}>Send Home</button><button onClick={captureCalibrationObservation}>Capture Target</button><button onClick={solveActiveFixtureCalibration}>Solve</button><button onClick={resetActiveFixtureCalibration}>Reset</button></div>}
          </> : <div className="empty-inspector"><strong>No selection</strong><span>Select a fixture or stage object to inspect it.</span></div>}
        </aside>
      </section>}

      {workspace === 'create' && <section className="console-workspace program-console create-console-v3">
        <FixtureBrowser patch={patch} groups={fixtureGroups} search={fixtureSearch} onSearchChange={setFixtureSearch} onSelectAll={selectAllFixtures} onClearSelection={clearFixtureSelection} onSelectFixture={selectFixtureFromConsole} onSelectGroup={selectFixtureGroup} selectedGroupId={selectedGroupId} />
        <div className="program-center console-center">
          <nav className="workspace-subtabs program-subtabs">{([
            ['stage', 'Programmer'], ['looks', 'Looks'], ['fx', 'FX'], ['colors', 'Color Palettes'], ['media', 'Media'], ['presets', 'Presets']
          ] as Array<[ProgramMode, string]>).map(([id, label]) => <button key={id} className={programMode === id ? 'active' : ''} onClick={() => setProgramMode(id)}>{label}</button>)}</nav>

          {programMode === 'stage' && <div className="programmer-v3">
            <div className="programmer-stage-head"><div><span>PROGRAMMER</span><strong>{selectedFixtureTargets.length ? `${selectedFixtureTargets.length} fixture${selectedFixtureTargets.length === 1 ? '' : 's'} selected` : 'Select fixtures or a group'}</strong></div><div className="programmer-target-actions"><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></div></div>
            <div className="programmer-stage">{renderStagePreview(true)}</div>
            <div className="programmer-attribute-deck programmer-attribute-deck-v4">
              <section className="attribute-module intensity-module">
                <header><span>INTENSITY</span><strong>{selectedFixtureTargets.length ? 'SELECTED' : '—'}</strong></header>
                <div className="attribute-faders">{selectedFixtureTargets.slice(0,8).map((fixture) => <VerticalFader key={fixture.id} id={`program-${fixture.id}`} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={fixture.labelColor ?? '#55e98d'} value={fixtureIntensityPercent(universe, fixture)} selected={fixture.selected} onChange={(value) => void setFixtureAttribute(fixture, 'dimmer', percentToDmx(value))} onSelect={() => selectFixtureFromConsole(fixture.id, true)} onFx={() => setProgramMode('fx')} />)}</div>
              </section>

              <ColorDeck title="COLOR" subtitle={selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected` : 'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length === 0} presets={consoleColorPresets} onChange={applyGlobalColor} />

              <section className="attribute-module position-module">
                <header><span>POSITION</span><strong>{selectedMovingFixtures.length} MOVERS</strong></header>
                <div className="position-actions">{showFile.positionPalettes?.slice(0,4).map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}>{palette.name}</button>)}<button onClick={savePositionPalette}>＋ SAVE</button></div>
                <div className="position-shortcuts"><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('aim'); }}>AIM</button><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('move'); }}>MOVE</button><button onClick={() => { setWorkspace('build'); setSetupView('stage'); setStageMode('rotate'); }}>ROTATE</button></div>
              </section>

              <section className="attribute-module beam-module">
                <header><span>BEAM</span><strong>OPTICS</strong></header>
                <div className="semantic-button-grid">
                  <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'zoom'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'zoom') && void setFixtureAttribute(fixture,'zoom',55))}>TIGHT</button>
                  <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'zoom'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'zoom') && void setFixtureAttribute(fixture,'zoom',225))}>WIDE</button>
                  <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'focus'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'focus') && void setFixtureAttribute(fixture,'focus',190))}>FOCUS</button>
                  <button disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'prism'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'prism') && void setFixtureAttribute(fixture,'prism',255))}>PRISM</button>
                </div>
              </section>

              <section className="attribute-module gobo-module">
                <header><span>GOBO</span><strong>WHEEL</strong></header>
                <div className="semantic-button-grid gobo-buttons">
                  {[0,64,128,192].map((value,index) => <button key={value} disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'gobo'))} className={index===0 ? 'open' : ''} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'gobo') && void setFixtureAttribute(fixture,'gobo',value))}>{index===0 ? 'OPEN' : `G${index}`}</button>)}
                  <button className="wide" disabled={!selectedFixtureTargets.some((fixture) => parameterChannel(fixture,'goboRotate'))} onClick={() => selectedFixtureTargets.forEach((fixture) => parameterChannel(fixture,'goboRotate') && void setFixtureAttribute(fixture,'goboRotate',190))}>ROTATE</button>
                </div>
              </section>

              <section className="attribute-module fx-module">
                <header><span>FX</span><strong>{liveEffectLabel || 'READY'}</strong></header>
                <div className="semantic-button-grid">
                  <button disabled={!effectSupportedByFixtures('pulse',selectedFixtureTargets)} className={activeEffect==='pulse'?'active':''} onClick={() => toggleEffect('pulse',selectedFixtureTargets.map((fixture)=>fixture.id))}>PULSE</button>
                  <button disabled={!effectSupportedByFixtures('chase',selectedFixtureTargets)} className={activeEffect==='chase'?'active':''} onClick={() => toggleEffect('chase',selectedFixtureTargets.map((fixture)=>fixture.id))}>CHASE</button>
                  <button disabled={!effectSupportedByFixtures('strobe',selectedFixtureTargets)} className={activeEffect==='strobe'?'active':''} onClick={() => toggleEffect('strobe',selectedFixtureTargets.map((fixture)=>fixture.id))}>STROBE</button>
                  <button className="wide open-fx" onClick={() => setProgramMode('fx')}>OPEN FX EDITOR</button>
                </div>
              </section>
            </div>
            <LooksStrip looks={allLooks} onApply={runLook} onSave={saveCurrentLook} />
          </div>}

          {programMode === 'looks' && <div className="create-focus-view"><header><div><span>LOOKS</span><h2>Reusable lighting looks</h2></div><button className="console-primary" onClick={saveCurrentLook}>＋ Save Current Look</button></header><LooksStrip looks={allLooks} onApply={runLook} onSave={saveCurrentLook} /></div>}

          {programMode === 'fx' && <div className="create-focus-view fx-workbench fx-workbench-v4">
            <header>
              <div><span>FX WORKBENCH</span><h2>{programEffectName || 'Choose fixtures or a group'}</h2></div>
              <b className={activeEffect || activeCustomEffectId ? 'healthy' : ''}>{activeCustomEffectId ? `CUSTOM · ${customEffects.find((effect) => effect.id === activeCustomEffectId)?.name ?? fxEditor.name}` : activeEffect ? `FACTORY · ${EFFECT_PRESETS.find((effect) => effect.id === activeEffect)?.name ?? activeEffect}` : 'READY'}</b>
            </header>

            <div className="fx-editor-layout">
              <section className="fx-graph-editor">
                <header><span>WAVEFORM</span><strong>{fxEditor.waveform.toUpperCase()} · {fxEditor.parameter.toUpperCase()}</strong></header>
                <div className="fx-graph-canvas">
                  <svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-label="FX waveform preview">
                    <defs><pattern id="fx-grid-v4" width="75" height="30" patternUnits="userSpaceOnUse"><path d="M 75 0 L 0 0 0 30" fill="none" stroke="rgba(115,132,142,.18)" strokeWidth="1"/></pattern></defs>
                    <rect width="600" height="120" fill="url(#fx-grid-v4)"/>
                    <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(115,132,142,.28)" strokeWidth="1"/>
                    <polyline className={activeCustomEffectId === fxEditor.id ? 'running' : ''} points={fxGraphPoints(fxEditor.waveform, fxEditor.depth, fxEditor.offset)} fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
                  </svg>
                </div>
                <div className="fx-editor-readouts">
                  <span><small>BPM</small><strong>{fxEditor.bpm}</strong></span>
                  <span><small>DEPTH</small><strong>{fxEditor.depth}%</strong></span>
                  <span><small>PHASE</small><strong>{fxEditor.phaseSpread}%</strong></span>
                  <span><small>BASE</small><strong>{fxEditor.offset}%</strong></span>
                  <span><small>TARGETS</small><strong>{programEffectFixtures.length}</strong></span>
                </div>
              </section>

              <section className="fx-editor-controls">
                <header><span>FX PARAMETERS</span><small>Graphical generator</small></header>
                <label><span>Name</span><input value={fxEditor.name} onChange={(event) => setFxEditor((current) => ({ ...current, name: event.target.value }))}/></label>
                <div className="inspector-pair">
                  <label><span>Parameter</span><select value={fxEditor.parameter} onChange={(event) => setFxEditor((current) => ({ ...current, parameter: event.target.value as EffectParameter }))}><option value="dimmer">Dimmer</option><option value="pan">Pan</option><option value="tilt">Tilt</option><option value="uv">UV</option></select></label>
                  <label><span>Waveform</span><select value={fxEditor.waveform} onChange={(event) => setFxEditor((current) => ({ ...current, waveform: event.target.value as EffectWaveform }))}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="saw">Saw</option><option value="reverse-saw">Reverse Saw</option><option value="step">Step</option></select></label>
                </div>
                <label><span>Speed · {fxEditor.bpm} BPM</span><input type="range" min="20" max="300" value={fxEditor.bpm} onChange={(event) => setFxEditor((current) => ({ ...current, bpm: Number(event.target.value) }))}/></label>
                <label><span>Depth · {fxEditor.depth}%</span><input type="range" min="0" max="100" value={fxEditor.depth} onChange={(event) => setFxEditor((current) => ({ ...current, depth: Number(event.target.value) }))}/></label>
                <label><span>Phase Spread · {fxEditor.phaseSpread}%</span><input type="range" min="0" max="100" value={fxEditor.phaseSpread} onChange={(event) => setFxEditor((current) => ({ ...current, phaseSpread: Number(event.target.value) }))}/></label>
                <label><span>Base · {fxEditor.offset}%</span><input type="range" min="0" max="100" value={fxEditor.offset} onChange={(event) => setFxEditor((current) => ({ ...current, offset: Number(event.target.value) }))}/></label>
                <div className="fx-editor-actions">
                  <button className={activeCustomEffectId === fxEditor.id ? 'danger-button' : 'console-primary'} disabled={!programEffectFixtures.length} onClick={() => runCustomFx(fxEditor, programEffectFixtures.map((fixture) => fixture.id))}>{activeCustomEffectId === fxEditor.id ? 'STOP FX' : 'RUN FX'}</button>
                  <button onClick={saveCustomFx}>SAVE TO BANK</button>
                  {(activeEffect || activeCustomEffectId) && <button onClick={() => stopEffect()}>STOP ALL</button>}
                </div>
              </section>
            </div>

            <section className="fx-bank-v4">
              <header><div><span>FX BANK</span><strong>Factory + saved custom effects</strong></div><small>{EFFECT_PRESETS.length + customEffects.length} effects</small></header>
              <div className="fx-bank-grid">
                {EFFECT_PRESETS.map((effect) => <button key={effect.id} className={`${selectedFxBankId === effect.id ? 'selected' : ''} ${activeEffect === effect.id ? 'running' : ''}`} onClick={() => loadFactoryFx(effect)} onDoubleClick={() => toggleEffect(effect.id, programEffectFixtures.map((fixture) => fixture.id))}><i className={`fx-icon fx-${effect.id}`}/><span><strong>{effect.name}</strong><small>{EFFECT_SHAPES[effect.id].waveform} · {effect.defaultBpm} BPM</small></span><b>{activeEffect === effect.id ? 'LIVE' : 'FACTORY'}</b></button>)}
                {customEffects.map((effect) => <article key={effect.id} className={`${selectedFxBankId === effect.id ? 'selected' : ''} ${activeCustomEffectId === effect.id ? 'running' : ''}`}><button className="fx-bank-load" onClick={() => { setSelectedFxBankId(effect.id); setFxEditor(effect); }} onDoubleClick={() => runCustomFx(effect, programEffectFixtures.map((fixture) => fixture.id))}><i>∿</i><span><strong>{effect.name}</strong><small>{effect.waveform} · {effect.bpm} BPM</small></span><b>{activeCustomEffectId === effect.id ? 'LIVE' : 'CUSTOM'}</b></button><button className="fx-bank-delete" aria-label={`Delete ${effect.name}`} onClick={() => deleteCustomFx(effect.id)}>×</button></article>)}
              </div>
              <footer><span>Single click loads an effect into the graph. Double-click a bank item to run it immediately.</span><button onClick={() => { setFxEditor({ id: 'custom-preview', name: 'New FX', parameter: 'dimmer', waveform: 'sine', bpm: 100, depth: 100, phaseSpread: 0, offset: 0 }); setSelectedFxBankId('custom-preview'); }}>＋ NEW FX</button></footer>
            </section>
          </div>}

          {programMode === 'colors' && <div className="create-focus-view"><header><div><span>COLOR PALETTES</span><h2>Fixture-aware color programming</h2></div></header><ColorDeck title="SELECTED COLOR" subtitle={selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected fixtures` : 'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length === 0} presets={consoleColorPresets} onChange={applyGlobalColor} /><ColorPaletteLibrary palettes={showFile.colorPalettes ?? []} color={globalColor} disabled={!selectedCompatibleColors.length} onChange={palettes=>setShowFile(current=>({...current,colorPalettes:palettes}))} onRecall={applyGlobalColor}/><section className="palette-library-v3"><header><span>QUICK PALETTES</span><small>Applies to selected compatible fixtures</small></header><div>{consoleColorPresets.map((preset, index) => <button key={`${index}-${preset.name}`} disabled={selectedCompatibleColors.length === 0} onClick={() => applyGlobalColor(preset.color)}><i style={{background:preset.color}}/><strong>{preset.name}</strong><small>{preset.color.toUpperCase()}</small></button>)}</div></section></div>}

          {programMode === 'media' && <div className="create-focus-view media-programmer"><header><div><span>MEDIA</span><h2>LumaViz + LumaStudio</h2></div><b className={directStatus.clients > 0 || studioBridgeStatus.connectedClients > 0 ? 'healthy' : ''}>{directStatus.clients + studioBridgeStatus.connectedClients > 0 ? 'LINKED' : 'WAITING'}</b></header><div className="media-link-grid"><section><span>LUMAVIZ DIRECT</span><strong>{directStatus.clients > 0 ? 'Connected' : 'Ready'}</strong><small>Semantic fixture + stage preview</small><div className="media-stage-preview">{renderStagePreview()}</div></section><section><span>LUMASTUDIO</span><strong>{studioBridgeStatus.connectedClients > 0 ? 'Connected' : 'Ready'}</strong><small>Studio transport authority · Rig lighting authority</small><div className="media-status-stack"><p>Port {studioBridgeStatus.port}</p><p>{externalTransportRunning ? 'Transport following' : externalTrack.armed ? 'External sync armed' : 'Local transport'}</p><p>{externalTrack.songName || showTrackName || 'No active media track'}</p></div><button onClick={() => { setWorkspace('show'); setShowMode('sync'); }}>OPEN SYNC</button></section></div></div>}

          {programMode === 'presets' && <div className="create-focus-view"><header><div><span>PRESETS</span><h2>Position + look library</h2></div><button onClick={savePositionPalette}>＋ Save Position</button></header><section className="preset-bank-v3"><div><h3>POSITION PALETTES</h3>{showFile.positionPalettes?.length ? showFile.positionPalettes.map((palette) => <button key={palette.id} onClick={() => void runPositionPalette(palette)}><span>{palette.kind}</span><strong>{palette.name}</strong></button>) : <p>No position palettes saved.</p>}</div><div><h3>LOOK PRESETS</h3>{allLooks.map((look) => <button key={look.id} onClick={() => runLook(look)}><i style={{background:lookSwatch(look.values)}}/><strong>{look.name}</strong></button>)}</div></section></div>}
        </div>

        {programMode !== 'fx' && <EffectsPanel title="FX / SELECTED TARGET" targetName={programEffectName} fixtures={programEffectFixtures} activeEffect={activeEffect} bpm={effectBpm} depth={effectDepth} disabled={false} onBpmChange={(value) => { setEffectBpm(value); effectBpmRef.current = value; setTempoSource('manual'); }} onDepthChange={(value) => { setEffectDepth(value); effectDepthRef.current = value; }} onStart={(effect) => toggleEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onPress={(effect) => startMomentaryEffect(effect, programEffectFixtures.map((fixture) => fixture.id))} onRelease={releaseMomentaryEffect} onStop={() => stopEffect()} />}
      </section>}

      {workspace === 'show' && <section className="show-console console-workspace-wide show-console-v3">
        <nav className="workspace-subtabs show-subtabs">{([
          ['cues','Cues'],['timeline','Timeline'],['tracks','Tracks'],['library','Show Library'],['sync','MIDI & Sync'],['recordings','Recordings']
        ] as Array<[ShowMode,string]>).map(([id,label]) => <button key={id} className={showMode === id ? 'active' : ''} onClick={() => setShowMode(id)}>{label}</button>)}</nav>

        {showMode === 'cues' && <div className="show-cue-layout">
          <aside className="cue-list-console"><header><span>CUE LIST</span><button onClick={captureCue}>＋ Capture</button></header>{showFile.cues.length ? showFile.cues.map((cue,index) => <article className={activeCueId === cue.id ? 'active' : ''} key={cue.id}><button className="cue-line" onClick={() => runCue(cue)}><b>{String(cue.number).padStart(2,'0')}</b><i style={{background:lookSwatch(cue.values)}}/><span><strong>{cue.name}</strong><small>{cue.fadeMs ? `${cue.fadeMs/1000}s fade` : 'Snap'}{cue.followMs ? ` · follow ${cue.followMs/1000}s` : ''}</small></span></button><div><button disabled={index===0} onClick={() => setShowFile((current)=>({...current,cues:moveCue(current.cues,cue.id,-1)}))}>↑</button><button disabled={index===showFile.cues.length-1} onClick={() => setShowFile((current)=>({...current,cues:moveCue(current.cues,cue.id,1)}))}>↓</button><button onClick={() => deleteCue(cue.id)}>×</button></div></article>) : <div className="empty-cues"><strong>No cues yet</strong><span>Build a look in CREATE, then capture it here.</span><button onClick={() => setWorkspace('create')}>Open CREATE</button></div>}</aside>

          <main className="cue-preview-console"><header><span>{directStatus.clients > 0 ? 'LUMAVIZ LIVE PREVIEW' : 'STAGE / CUE PREVIEW'}</span><b>{activeCue?.name ?? 'Live output'}</b></header><div className={`show-viz-preview ${liveLumaVizPreview ? 'linked external-feed' : directStatus.clients > 0 ? 'linked' : ''}`}>{liveLumaVizPreview ? <img src={liveLumaVizPreview.dataUrl} alt={`LumaViz ${liveLumaVizPreview.view ?? 'live'} preview`} /> : renderStagePreview()}</div><div className="cue-preview-meta"><span>CURRENT<strong>{activeCue ? `${activeCue.number}. ${activeCue.name}` : 'Ready'}</strong></span><span>NEXT<strong>{nextCue ? `${nextCue.number}. ${nextCue.name}` : 'End of show'}</strong></span></div></main>

          <aside className="cue-inspector-console"><header><span>CUE INSPECTOR</span><strong>{activeCue?.name ?? 'New cue'}</strong></header>{activeCue ? <><label><span>Cue Name</span><input value={activeCue.name} onChange={(event)=>updateCueProperties(activeCue.id,{name:event.target.value})}/></label><label><span>Cue Color</span><input type="color" value={activeCue.color ?? '#55e98d'} onChange={(event)=>updateCueProperties(activeCue.id,{color:event.target.value})}/></label><label><span>Description</span><textarea value={activeCue.description ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{description:event.target.value})}/></label><div className="inspector-pair"><label><span>Fade In ms</span><input type="number" min="0" value={activeCue.fadeMs} onChange={(event)=>updateCueProperties(activeCue.id,{fadeMs:Number(event.target.value)})}/></label><label><span>Fade Out ms</span><input type="number" min="0" value={activeCue.fadeOutMs ?? activeCue.fadeMs} onChange={(event)=>updateCueProperties(activeCue.id,{fadeOutMs:Number(event.target.value)})}/></label></div><div className="inspector-pair"><label><span>Delay ms</span><input type="number" min="0" value={activeCue.delayMs ?? 0} onChange={(event)=>updateCueProperties(activeCue.id,{delayMs:Number(event.target.value)})}/></label><label><span>Follow ms</span><input type="number" min="0" value={activeCue.followMs ?? 0} onChange={(event)=>updateCueProperties(activeCue.id,{followMs:Number(event.target.value)})}/></label></div><label><span>Linked Effect</span><select value={activeCue.linkedEffectId ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{linkedEffectId:event.target.value})}><option value="">None</option>{EFFECT_PRESETS.map((effect)=><option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label><label><span>Track / Audio Note</span><input value={activeCue.trackName ?? ''} onChange={(event)=>updateCueProperties(activeCue.id,{trackName:event.target.value})}/></label><button className="console-primary" onClick={()=>updateCue(activeCue.id)}>Update Look From Output</button></> : <><label><span>New Cue Name</span><input value={cueName} placeholder={`Cue ${showFile.cues.length+1}`} onChange={(event)=>setCueName(event.target.value)}/></label><label><span>Fade In</span><select value={cueFadeMs} onChange={(event)=>setCueFadeMs(Number(event.target.value))}>{FADE_TIMES.map((time)=><option key={time} value={time}>{time===0?'Snap':`${time/1000}s`}</option>)}</select></label><button className="console-primary" onClick={captureCue}>Capture Current Look</button></>}<label><span>Show Notes</span><textarea value={showFile.notes ?? ''} placeholder="Set list, transitions, safety notes…" onChange={(event)=>setShowFile((current)=>({...current,notes:event.target.value}))}/></label></aside>

          <div className="cue-transport-console"><button onClick={goPreviousCue} disabled={!showFile.cues.length}>BACK</button><span><small>CURRENT</small><strong>{activeCue?.name ?? 'Ready'}</strong></span><button className="giant-go" onClick={goNextCue} disabled={!nextCue}>GO<small>{nextCue?.name ?? 'End'}</small></button><span><small>NEXT</small><strong>{nextCue?.name ?? 'End of show'}</strong></span><button onClick={goNextCue} disabled={!nextCue}>NEXT</button></div>
        </div>}

        {showMode === 'timeline' && <div className="show-timeline-v3">
          <header className="timeline-command"><div><span>SHOW TIMELINE</span><h2>{showTrackName || externalTrack.songName || showFile.name}</h2></div><div className="timeline-transport"><button onClick={goPreviousCue}>BACK</button><button onClick={toggleShowTrackPreview}>PLAY / PAUSE</button><button className="console-primary" onClick={goNextCue}>GO</button></div></header>
          <div className="timeline-ruler"><span>{formatShowTime(showTrackPositionMs)}</span><input type="range" min="0" max={Math.max(1,showTrackDurationMs)} value={Math.min(showTrackPositionMs,Math.max(1,showTrackDurationMs))} onChange={(event)=>{const next=Number(event.target.value);if(showTrackAudioRef.current)showTrackAudioRef.current.currentTime=next/1000;setShowTrackPositionMs(next);}}/><span>{formatShowTime(showTrackDurationMs)}</span></div>
          <div className="timeline-lanes">
            <section><header><span>LIGHTING CUES</span><small>{showFile.cues.length}</small></header><div className="timeline-cue-sequence">{showFile.cues.map((cue,index)=><button key={cue.id} className={activeCueId===cue.id?'active':''} onClick={()=>runCue(cue)} style={{'--cue-color':cue.color ?? lookSwatch(cue.values)} as import('react').CSSProperties}><b>{cue.number}</b><span>{cue.name}</span><small>{cue.fadeMs ? `${cue.fadeMs/1000}s`:'SNAP'}</small>{index<showFile.cues.length-1&&<i/>}</button>)}</div></section>
            <section><header><span>MEDIA / TRACK</span><small>{showTrackName || 'No local track'}</small></header><div className="timeline-media-lane"><div className={externalTransportRunning?'running':''}><span>STUDIO</span><strong>{externalTrack.songName || 'External transport'}</strong><small>{externalTrack.armed ? `${externalTrack.bpm} BPM · ${externalTrack.lightingOffsetMs}ms offset` : 'Not armed'}</small></div></div></section>
            <section><header><span>RECORDED LIGHTING</span><small>{showFile.recordings?.length ?? 0} takes</small></header><div className="timeline-recording-lane">{showFile.recordings?.map((recording)=><button key={recording.id} onClick={()=>playingRecordingId===recording.id?stopRecordedShowPlayback():playShowRecording(recording)}><strong>{recording.name}</strong><span>{formatShowTime(recording.durationMs)}</span><small>{recording.frames.length} changes</small></button>)}</div></section>
          </div>
        </div>}

        {showMode === 'tracks' && <div className="tracks-console tracks-console-v3">
          <section className="console-panel track-source"><header><div><span>LOCAL AUDIO TRACK</span><h2>{showTrackName || 'No track loaded'}</h2></div><label className="file-button"><input type="file" accept="audio/*" onChange={loadShowTrack}/>{showTrackName?'Change Track':'Load Track'}</label></header><div className="track-timeline"><span>{formatShowTime(showTrackPositionMs)}</span><input type="range" min="0" max={Math.max(1,showTrackDurationMs)} value={Math.min(showTrackPositionMs,Math.max(1,showTrackDurationMs))} onChange={(event)=>{const next=Number(event.target.value);if(showTrackAudioRef.current)showTrackAudioRef.current.currentTime=next/1000;setShowTrackPositionMs(next);}}/><span>{formatShowTime(showTrackDurationMs)}</span></div><div className="track-actions"><button onClick={toggleShowTrackPreview}>Play / Pause</button><button onClick={()=>setShowMode('timeline')}>Open Timeline</button></div></section>
          <section className="console-panel external-track-console"><header><div><span>STUDIO / DAW TRACK</span><h2>{externalTrack.songName || 'External Track'}</h2></div><b className={externalTransportRunning?'healthy':''}>{externalTransportRunning?'Following':externalTrack.armed?'Armed':'Off'}</b></header><label><span>Song Name</span><input value={externalTrack.songName} onChange={(event)=>updateExternalTrack({songName:event.target.value})}/></label><label><span>Lighting Take</span><select value={externalTrack.recordingId} onChange={(event)=>assignExternalRecording(event.target.value)}><option value="">Choose take</option>{showFile.recordings?.map((recording)=><option key={recording.id} value={recording.id}>{recording.name}</option>)}</select></label><div className="inspector-pair"><label><span>BPM</span><input type="number" value={externalTrack.bpm} onChange={(event)=>updateExternalTrack({bpm:Number(event.target.value)})}/></label><label><span>Advance ms</span><input type="number" value={externalTrack.lightingOffsetMs} onChange={(event)=>updateExternalTrack({lightingOffsetMs:Number(event.target.value)})}/></label></div><button className={externalTrack.armed?'danger-button':'console-primary'} onClick={toggleExternalTrackArm}>{externalTrack.armed?'Disarm External Sync':'Arm External Sync'}</button></section>
        </div>}

        {showMode === 'library' && <div className="show-library-console show-library-v3">
          <header><div><span>SHOW LIBRARY</span><h2>{showFile.name}</h2><small>Templates define the rig. Drafts and service shows inherit that structure with cues, tracks, looks and show-specific changes.</small></div><div><button onClick={newShowProject}>＋ New Show</button><button onClick={()=>saveShowProject('template')}>Save Template</button><button onClick={()=>saveShowProject('draft')}>Save Draft</button><button className="console-primary" onClick={()=>saveShowProject('show')}>Save Service Show</button></div></header>
          <div className="show-library-grid">{showLibrary.length?showLibrary.map((item)=><article key={item.id}><div><span className={item.status}>{item.status.toUpperCase()}</span><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleString()} · R{item.revision ?? 1} · {item.lastEditor ?? 'lumarig'} · {item.show.cues.length} cues · {item.patch.length} fixtures</small></div><div><button onClick={()=>loadShowProject(item)}>Load</button><button className="danger-button" onClick={()=>deleteShowProject(item.id)}>Delete</button></div></article>):<div className="empty-show-library"><strong>No saved shows yet</strong><span>Save the current show or a draft. Your working show continues to autosave separately.</span></div>}</div>
        </div>}

        {showMode === 'sync' && <div className="show-sync-v3">
          <section className="console-panel sync-status-card"><header><div><span>LUMASTUDIO</span><h2>Transport Authority</h2></div><b className={studioBridgeStatus.connectedClients>0?'healthy':''}>{studioBridgeStatus.connectedClients>0?'CONNECTED':studioBridgeStatus.listening?'READY':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>PORT</small><strong>{studioBridgeStatus.port}</strong></span><span><small>CLIENTS</small><strong>{studioBridgeStatus.connectedClients}</strong></span><span><small>TRANSPORT</small><strong>{externalTransportRunning?'FOLLOWING':'LOCAL'}</strong></span><span><small>AUTHORITY</small><strong>RIG LIGHTING</strong></span></div><p>Studio controls transport and song position. LumaRig keeps authority over cue execution, FX and DMX output.</p></section>
          <section className="console-panel sync-status-card"><header><div><span>MIDI</span><h2>Clock + Transport</h2></div><b className={midiStatus.connected?'healthy':''}>{midiStatus.connected?'CONNECTED':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>INPUT</small><strong>{midiStatus.input_name || '—'}</strong></span><span><small>CLOCK</small><strong>{midiClockSeen?'SEEN':'WAITING'}</strong></span><span><small>BPM</small><strong>{midiBpm || effectBpm}</strong></span><span><small>MESSAGES</small><strong>{midiStatus.messages_received}</strong></span></div><button onClick={()=>{setWorkspace('build');setSetupView('settings');}}>Open Connections</button></section>
          <section className="console-panel sync-status-card"><header><div><span>LUMAVIZ</span><h2>Preview + Shared Show</h2></div><b className={directStatus.clients>0?'healthy':''}>{directStatus.clients>0?'CONNECTED':directStatus.listening?'READY':'OFFLINE'}</b></header><div className="sync-metrics"><span><small>DIRECT PORT</small><strong>{directStatus.port}</strong></span><span><small>CLIENTS</small><strong>{directStatus.clients}</strong></span><span><small>FRAMES</small><strong>{directStatus.framesSent}</strong></span><span><small>LOCATION</small><strong>{activeLocation?.name || '—'}</strong></span></div></section>
          <section className="console-panel external-track-console sync-track-card"><header><div><span>SYNC OFFSET</span><h2>{externalTrack.songName || 'Active Song'}</h2></div><b>{externalTrack.lightingOffsetMs} ms</b></header><label><span>Lighting Advance / Delay</span><input type="range" min="-5000" max="5000" step="10" value={externalTrack.lightingOffsetMs} onChange={(event)=>updateExternalTrack({lightingOffsetMs:Number(event.target.value)})}/></label><div className="inspector-pair"><label><span>BPM</span><input type="number" value={externalTrack.bpm} onChange={(event)=>updateExternalTrack({bpm:Number(event.target.value)})}/></label><label><span>Take</span><select value={externalTrack.recordingId} onChange={(event)=>assignExternalRecording(event.target.value)}><option value="">None</option>{showFile.recordings?.map((recording)=><option key={recording.id} value={recording.id}>{recording.name}</option>)}</select></label></div><button className={externalTrack.armed?'danger-button':'console-primary'} onClick={toggleExternalTrackArm}>{externalTrack.armed?'DISARM':'ARM SYNC'}</button></section>
        </div>}

        {showMode === 'recordings' && <div className="recordings-console-v3">
          <section className="console-panel recording-command"><header><div><span>SHOW RECORDER</span><h2>Capture live lighting performance</h2></div><b>{showFile.recordings?.length ?? 0} TAKES</b></header><div className="recording-arm-row"><input value={recordingTakeName} placeholder={`Take ${(showFile.recordings?.length ?? 0)+1}`} onChange={(event)=>setRecordingTakeName(event.target.value)}/><button className="record-button" onClick={startShowRecording}>● RECORD SHOW</button></div><small>Records resolved lighting changes so the take can be replayed locally or driven by LumaStudio / MIDI transport.</small></section>
          <section className="console-panel recorded-takes-console"><header><div><span>LIGHTING TAKES</span><h2>Saved Performances</h2></div></header>{showFile.recordings?.length?showFile.recordings.map((recording)=><article key={recording.id}><span><strong>{recording.name}</strong><small>{formatShowTime(recording.durationMs)} · {recording.frames.length} changes</small></span><button className={playingRecordingId===recording.id?'console-primary':''} onClick={()=>playingRecordingId===recording.id?stopRecordedShowPlayback():playShowRecording(recording)}>{playingRecordingId===recording.id?'Stop':'Play'}</button><button onClick={()=>assignExternalRecording(recording.id)}>Assign to Sync</button><button className="danger-button" onClick={()=>deleteShowRecording(recording)}>Delete</button></article>):<div className="empty-cues"><strong>No recordings yet</strong><span>Arm the recorder and perform the show from LIVE.</span></div>}</section>
        </div>}
      </section>}

      {workspace === 'live' && <section className={`live-console live-console-v3 ${liveView === 'performance' && liveProgrammerOpen ? 'with-palette-dock' : ''}`}>
        <header className="live-command-bar">
          <div className="live-show-state"><small>LIVE PERFORMANCE</small><strong>{showFile.name}</strong><span>{dmxStatus.blackout ? 'BLACKOUT ACTIVE' : liveEffectLabel ? `FX · ${liveEffectLabel}` : 'LOCAL CONTROL'}</span></div>
          <div className="live-cue-deck">
            <button className="live-back" onClick={goPreviousCue}>BACK</button>
            <div className="live-cue-card current"><small>CURRENT</small><strong>{activeCue?.name ?? 'Ready'}</strong><span>{activeCue ? `Cue ${activeCue.number}` : 'No cue running'}</span></div>
            <button className="live-go-v3" onClick={goNextCue} disabled={!nextCue}><b>GO</b><small>{nextCue?.name ?? 'END'}</small></button>
            <div className="live-cue-card next"><small>NEXT</small><strong>{nextCue?.name ?? 'End of show'}</strong><span>{nextCue ? `Cue ${nextCue.number}` : '—'}</span></div>
          </div>
          <button className={`live-blackout-v3 ${dmxStatus.blackout?'active':''}`} onClick={toggleBlackout}>{dmxStatus.blackout?'RELEASE':'BLACKOUT'}</button>
        </header>

        <nav className="live-view-tabs">{([
          ['performance','Performance'],['overrides','Fixture Overrides'],['groups','Groups'],['masters','Master Controls'],['shortcuts','Shortcuts'],['settings','Settings']
        ] as Array<[LiveView,string]>).map(([id,label])=><button key={id} className={liveView===id?'active':''} onClick={()=>setLiveView(id)}>{label}</button>)}</nav>

        {liveView === 'performance' && <div className="live-operator-grid">
          <aside className="live-executor-rail">
            <header><span>QUICK LOOKS</span><small>{allLooks.length} AVAILABLE</small></header>
            <div className="executor-grid">{allLooks.slice(0,12).map((look,index)=><button key={look.id} className="executor-key" onClick={()=>runLook(look)}><i style={{background:lookSwatch(look.values)}}/><small>{String(index+1).padStart(2,'0')}</small><strong>{look.name}</strong></button>)}</div>
            <header><span>PERFORMANCE FX</span><button className={activeEffect?'active':''} onClick={()=>stopEffect()}>STOP FX</button></header>
            <div className="executor-grid fx-executors">{EFFECT_PRESETS.filter((effect)=>['bump','blinder','strobe','pulse','sweep','lightning','finale','chase'].includes(effect.id)&&effectSupportedByFixtures(effect.id,selectedFixtureTargets)).slice(0,8).map((effect)=>renderEffectButton(effect,true))}</div>
            {!selectedFixtureTargets.length && <p className="live-target-hint">Select fixtures below their faders to enable compatible effects and palettes.</p>}
          </aside>

          <main className="live-playback-surface">
            <div className="live-surface-toolbar"><div><strong>PLAYBACK / OUTPUT</strong><small>{liveBank==='fixtures'?`${patch.length} FIXTURES`:`${fixtureGroups.length} GROUPS`} · {selectedFixtureTargets.length} SELECTED</small></div><div className="live-bank-tabs"><button className={liveBank==='fixtures'?'active':''} onClick={()=>setLiveBank('fixtures')}>FIXTURES</button><button className={liveBank==='groups'?'active':''} onClick={()=>setLiveBank('groups')}>GROUPS</button></div><div className="live-select-tools"><button className={liveProgrammerOpen?'active':''} onClick={()=>setLiveProgrammerOpen((value)=>!value)}>PROGRAMMER</button>{liveBank==='fixtures'&&<><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></>}</div></div>
            <div className="live-fader-deck">{liveBank==='fixtures' ? patch.slice(Math.min(liveFaderPage, Math.max(0, Math.ceil(patch.length/8)-1))*8, (Math.min(liveFaderPage, Math.max(0, Math.ceil(patch.length/8)-1))+1)*8).map((fixture)=>{const v=fixtureValues(outputUniverse,fixture);const outputColor=(v.red+v.green+v.blue)>0?rgbToHex(v.red,v.green,v.blue):(fixture.labelColor ?? '#55e98d');return <VerticalFader key={fixture.id} id={`live-${fixture.id}`} name={fixture.name} subtitle={activeEffect?`${fixtureBrowserSubtitle(fixture)} · ${activeEffect}`:fixtureBrowserSubtitle(fixture)} color={outputColor} value={fixtureIntensityPercent(universe,fixture)} outputValue={fixtureIntensityPercent(outputUniverse,fixture)} selected={fixture.selected} onChange={(value)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value))} onSelect={()=>selectFixtureFromConsole(fixture.id,true)} onFx={()=>{selectFixtureFromConsole(fixture.id);setWorkspace('create');setProgramMode('fx');}}/>}) : fixtureGroups.map((group)=>{const members=fixturesInGroup(patch,group);const first=members[0];const v=first?fixtureValues(outputUniverse,first):null;const outputColor=v&&(v.red+v.green+v.blue)>0?rgbToHex(v.red,v.green,v.blue):group.labelColor;return <VerticalFader key={group.id} id={`live-${group.id}`} name={group.name} subtitle={activeEffect?`${members.length} fixtures · ${activeEffect}`:`${members.length} fixtures`} color={outputColor} value={Math.round(groupMasters[group.id] ?? group.masterDefault)} selected={selectedGroupId===group.id} onChange={(value)=>applyGroupMaster(group,value)} onSelect={()=>selectFixtureGroup(group.id)} onFx={()=>{selectFixtureGroup(group.id);setWorkspace('create');setProgramMode('fx');}} quickAction={{label:'Chase',onPress:()=>toggleEffect('chase',members.map((fixture)=>fixture.id))}}/>;})}</div>
            {!patch.length && <div className="live-empty-state"><span>01 / BUILD YOUR RIG</span><h2>Your performance starts here.</h2><p>Add your fixtures to reveal live faders, output meters and compatible effects.</p><button className="console-primary" onClick={()=>{setWorkspace('build');setSetupView('fixtures');}}>Patch fixtures</button></div>}
            {liveBank==='groups' && !fixtureGroups.length && patch.length>0 && <div className="live-empty-state"><h2>Organize your rig.</h2><p>Create fixture groups to control washes, movers and stage areas together.</p><button onClick={()=>{setWorkspace('build');setSetupView('groups');}}>Create groups</button></div>}
            <div className="live-bank-footer"><span>FADER = PROGRAMMER <i/> METER = RESOLVED OUTPUT</span>{liveBank==='fixtures'&&<div><button aria-label="Previous fixture bank" disabled={liveFaderPage===0} onClick={()=>setLiveFaderPage(p=>Math.max(0,p-1))}>←</button><b>BANK {Math.min(liveFaderPage+1,Math.max(1,Math.ceil(patch.length/8)))} / {Math.max(1,Math.ceil(patch.length/8))}</b><button aria-label="Next fixture bank" disabled={(liveFaderPage+1)*8>=patch.length} onClick={()=>setLiveFaderPage(p=>p+1)}>→</button></div>}</div>
          </main>

          <aside className="live-master-rack">
            <section className="live-master-card"><header><span>GRAND MASTER</span><strong>{globalMaster}%</strong></header><input className="live-master-slider" type="range" min="0" max={settings.masterLimit} value={globalMaster} onChange={(event)=>applyGlobalMaster(Number(event.target.value))}/><div>{[0,25,50,75,100].map((value)=><button key={value} className={globalMaster===value?'active':''} onClick={()=>applyGlobalMaster(value)}>{value}</button>)}</div></section>
            <section className="live-viz-monitor"><header><span>LUMAVIZ</span><b className={directStatus.clients>0?'healthy':''}>{liveLumaVizPreview ? 'LIVE FEED' : directStatus.clients>0 ? 'LINKED · LOCAL FALLBACK' : 'LOCAL PREVIEW'}</b></header><div className={`live-viz-stage ${liveLumaVizPreview ? 'external-feed' : ''}`}>{liveLumaVizPreview ? <img src={liveLumaVizPreview.dataUrl} alt={`LumaViz ${liveLumaVizPreview.view ?? 'live'} preview`} /> : renderStagePreview()}</div></section>
            <section className="live-tempo-card"><span>TEMPO</span><button onClick={tapTempo}><strong>{tempoSource==='midi'&&midiBpm?midiBpm:effectBpm}</strong><small>BPM · TAP</small></button><label>DEPTH <input type="range" min="0" max="100" value={effectDepth} onChange={(event)=>{const value=Number(event.target.value);setEffectDepth(value);effectDepthRef.current=value;}}/></label></section>
          </aside>
        </div>}

        {liveView === 'performance' && liveProgrammerOpen && <section className="live-programmer-drawer">
          <header>
            <div><span>LIVE PROGRAMMER</span><strong>{selectedFixtureTargets.length ? `${selectedFixtureTargets.length} selected` : 'Select a group or fixture'}</strong></div>
            <nav>{(['groups','intensity','position','color','beam','fx'] as LivePaletteFamily[]).map((family)=><button key={family} className={livePaletteFamily===family?'active':''} onClick={()=>setLivePaletteFamily(family)}>{family.toUpperCase()}</button>)}</nav>
            <button className="live-programmer-close" onClick={()=>setLiveProgrammerOpen(false)}>×</button>
          </header>
          <div className="live-palette-grid">
            {livePaletteFamily==='groups' && <>{fixtureGroups.map((group,index)=><button key={group.id} className={selectedGroupId===group.id?'selected':''} onClick={()=>selectFixtureGroup(group.id)} style={{'--palette-color':group.labelColor} as import('react').CSSProperties}><i/><b>{index+1}</b><span>{group.name}</span><small>{fixturesInGroup(patch,group).length} FIXTURES</small></button>)}</>}
            {livePaletteFamily==='intensity' && <>{[0,25,50,75,100].map((value)=><button key={value} disabled={!selectedFixtureTargets.length} onClick={()=>selectedFixtureTargets.forEach((fixture)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value)))}><b>{value===0?'OUT':value}</b><span>{value===100?'FULL':'Intensity'}</span><small>{value}%</small></button>)}</>}
            {livePaletteFamily==='position' && <>{(showFile.positionPalettes??[]).map((palette,index)=><button key={palette.id} disabled={!selectedMovingFixtures.length} onClick={()=>void runPositionPalette(palette)}><b>{index+1}</b><span>{palette.name}</span><small>{palette.kind.toUpperCase()}</small></button>)}{!(showFile.positionPalettes??[]).length&&<div className="live-palette-empty">Save position palettes in CREATE and they appear here.</div>}</>}
            {livePaletteFamily==='color' && <>{consoleColorPresets.map((preset,index)=><button key={`${index}-${preset.name}`} className="color-palette" disabled={!selectedCompatibleColors.length} onClick={()=>applyGlobalColor(preset.color)} style={{'--palette-color':preset.color} as import('react').CSSProperties}><i/><b>{index+1}</b><span>{preset.name}</span><small>{preset.color.toUpperCase()}</small></button>)}</>}
            {livePaletteFamily==='beam' && <>{([
              ['OPEN',255,255,255],['TIGHT',65,180,210],['WIDE',230,110,255],['SOFT',200,80,170]
            ] as Array<[string,number,number,number]>).map(([name,zoom,focus,iris],index)=><button key={name} disabled={!selectedFixtureTargets.length} onClick={()=>selectedFixtureTargets.forEach((fixture)=>{if(parameterChannel(fixture,'zoom'))void setFixtureAttribute(fixture,'zoom',zoom);if(parameterChannel(fixture,'focus'))void setFixtureAttribute(fixture,'focus',focus);if(parameterChannel(fixture,'iris'))void setFixtureAttribute(fixture,'iris',iris);})}><b>{index+1}</b><span>{name}</span><small>BEAM</small></button>)}</>}
            {livePaletteFamily==='fx' && <>{EFFECT_PRESETS.filter((effect)=>effectSupportedByFixtures(effect.id,selectedFixtureTargets)).map((effect,index)=><button key={effect.id} className={activeEffect===effect.id?'selected':''} onClick={()=>toggleEffect(effect.id,selectedFixtureTargets.map((fixture)=>fixture.id))}><b>{index+1}</b><span>{effect.name}</span><small>{effect.defaultBpm} BPM</small></button>)}{customEffects.map((effect,index)=><button key={effect.id} className={activeCustomEffectId===effect.id?'selected':''} disabled={!selectedFixtureTargets.length} onClick={()=>runCustomFx(effect,selectedFixtureTargets.map((fixture)=>fixture.id))}><b>C{index+1}</b><span>{effect.name}</span><small>{effect.waveform.toUpperCase()}</small></button>)}</>}
          </div>
        </section>}

        {liveView === 'overrides' && <div className="live-detail-view">
          <header><div><span>FIXTURE OVERRIDES</span><h2>Direct live control</h2></div><div><button onClick={selectAllFixtures}>ALL</button><button onClick={clearFixtureSelection}>CLEAR</button></div></header>
          <div className="override-layout"><div className="override-fader-bank">{patch.map((fixture)=>{const v=fixtureValues(outputUniverse,fixture);const outputColor=(v.red+v.green+v.blue)>0?rgbToHex(v.red,v.green,v.blue):(fixture.labelColor ?? '#55e98d');return <VerticalFader key={fixture.id} id={`override-${fixture.id}`} name={fixture.name} subtitle={fixtureBrowserSubtitle(fixture)} color={outputColor} value={fixtureIntensityPercent(universe,fixture)} outputValue={fixtureIntensityPercent(outputUniverse,fixture)} selected={fixture.selected} onChange={(value)=>void setFixtureAttribute(fixture,'dimmer',percentToDmx(value))} onSelect={()=>selectFixtureFromConsole(fixture.id,true)} onFx={()=>{setWorkspace('create');setProgramMode('fx');}}/>})}</div><aside><ColorDeck title="OVERRIDE COLOR" subtitle={selectedFixtureTargets.length?`${selectedFixtureTargets.length} selected`:'Select fixtures'} color={globalColor} disabled={selectedCompatibleColors.length===0} presets={consoleColorPresets} onChange={applyGlobalColor}/><button className="console-primary" onClick={()=>{setWorkspace('create');setProgramMode('stage');}}>OPEN FULL PROGRAMMER</button></aside></div>
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

      <footer className="console-footer console-status-strip">
        <div className="status-connections">
          <button className={dmxStatus.connected ? 'healthy' : ''} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i />DMX <b>{dmxStatus.connected ? 'ONLINE' : 'VIRTUAL'}</b></button>
          <button className={directStatus.clients > 0 ? 'healthy' : ''} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i />LUMAVIZ <b>{directStatus.clients > 0 ? 'LINKED' : 'READY'}</b></button>
          <button className={studioBridgeStatus.connectedClients > 0 ? 'healthy' : ''} onClick={() => { setWorkspace('show'); setShowMode('sync'); }}><i />STUDIO <b>{studioBridgeStatus.connectedClients > 0 ? 'LINKED' : 'READY'}</b></button>
          <button className={midiStatus.connected ? 'healthy' : ''} onClick={() => { setWorkspace('build'); setSetupView('settings'); }}><i />MIDI <b>{midiStatus.connected ? 'ONLINE' : 'OFF'}</b></button>
        </div>
        <span className="status-message">{dmxStatus.last_error || midiStatus.last_error || message}</span>
        <div className="status-show-readout"><span>U1</span><span>40 HZ</span><span>{patch.length} FXT</span><span>{showFile.cues.length} CUES</span>{isFading && <span className="attention">FADING</span>}<b>{formatShowTime(externalSongPositionMs || showTrackPositionMs)}</b></div>
      </footer>
    </main>
  );

}
