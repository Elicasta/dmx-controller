import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export type LiveSurfaceMode = 'faders' | 'ma' | 'busk';
export type LiveAssignmentKind = 'empty' | 'group' | 'fixture' | 'look' | 'effect' | 'color' | 'level' | 'cue-go' | 'cue-back' | 'blackout' | 'master' | 'stop-fx';

export type LiveSurfaceAssignment = {
  id: string;
  kind: LiveAssignmentKind;
  targetId?: string;
  label: string;
  color?: string;
  momentary?: boolean;
  value?: number;
};

export type LiveSurfaceFixture = {
  id: string;
  name: string;
  subtitle: string;
  intensity: number;
  outputIntensity: number;
  color: string;
  selected: boolean;
};

export type LiveSurfaceGroup = {
  id: string;
  name: string;
  fixtureIds: string[];
  intensity: number;
  color: string;
  selected: boolean;
};

export type LiveSurfaceLook = { id: string; name: string; color: string };
export type LiveSurfaceEffect = { id: string; name: string; active: boolean; momentary?: boolean; color?: string };

type AssignmentMap = Record<string, LiveSurfaceAssignment>;
type PoolMode = 'groups' | 'fixtures' | 'intensity';

export type DesktopLiveControllerProps = {
  showName: string;
  bpm: number;
  currentCue: string;
  currentCueNumber?: number;
  nextCue?: string;
  blackout: boolean;
  outputHealthy: boolean;
  dmxConnected: boolean;
  master: number;
  fxSpeed: number;
  fxDepth: number;
  fixtures: LiveSurfaceFixture[];
  groups: LiveSurfaceGroup[];
  looks: LiveSurfaceLook[];
  effects: LiveSurfaceEffect[];
  onGo: () => void;
  onBack: () => void;
  onBlackout: () => void;
  onMaster: (value: number) => void;
  onFxSpeed: (value: number) => void;
  onFxDepth: (value: number) => void;
  onSelectFixtures: (fixtureIds: string[], mode: 'replace' | 'toggle') => void;
  onFixtureLevel: (fixtureId: string, value: number) => void;
  onGroupLevel: (groupId: string, value: number) => void;
  onFlashFixtures: (fixtureIds: string[], active: boolean) => void;
  onLook: (lookId: string) => void;
  onEffectPress: (effectId: string, momentary: boolean) => void;
  onEffectRelease: (effectId: string) => void;
  onStopFx: () => void;
  onColor: (color: string) => void;
  onSelectedLevel: (value: number) => void;
};

const STORAGE_PREFIX = 'lumarig.desktop-live.assignments.v1';
const PAGE_COUNT = 4;
const FADER_COUNT = 8;

export function liveSlotKey(mode: LiveSurfaceMode, page: number, index: number) {
  return `${mode}:${page}:${index}`;
}

export function emptyLiveAssignment(id: string): LiveSurfaceAssignment {
  return { id, kind: 'empty', label: 'EMPTY' };
}

export function sanitizeLiveAssignments(value: unknown): AssignmentMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set<LiveAssignmentKind>(['empty', 'group', 'fixture', 'look', 'effect', 'color', 'level', 'cue-go', 'cue-back', 'blackout', 'master', 'stop-fx']);
  return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<LiveSurfaceAssignment>;
    if (typeof item.id !== 'string' || typeof item.label !== 'string' || !allowed.has(item.kind as LiveAssignmentKind)) return [];
    if (item.targetId !== undefined && typeof item.targetId !== 'string') return [];
    if (item.color !== undefined && (typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color))) return [];
    if (item.value !== undefined && (typeof item.value !== 'number' || !Number.isFinite(item.value))) return [];
    return [[key.slice(0, 80), {
      id: item.id.slice(0, 100),
      kind: item.kind as LiveAssignmentKind,
      targetId: item.targetId?.slice(0, 100),
      label: item.label.slice(0, 64),
      color: item.color,
      momentary: Boolean(item.momentary),
      value: item.value
    } satisfies LiveSurfaceAssignment]];
  }));
}

function safeStorageKey(showName: string) {
  return `${STORAGE_PREFIX}:${showName.trim().toLowerCase().slice(0, 64) || 'untitled'}`;
}

function loadAssignments(showName: string): AssignmentMap {
  try { return sanitizeLiveAssignments(JSON.parse(localStorage.getItem(safeStorageKey(showName)) || '{}')); }
  catch { return {}; }
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function TouchFader({ label, value, outputValue, color, disabled, onChange }: {
  label: string;
  value: number;
  outputValue?: number;
  color: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const changeFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    onChange(clampPercent(((bounds.bottom - event.clientY) / bounds.height) * 100));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const amount = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); onChange(clampPercent(value + amount)); }
    if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); onChange(clampPercent(value - amount)); }
    if (event.key === 'Home') { event.preventDefault(); onChange(0); }
    if (event.key === 'End') { event.preventDefault(); onChange(100); }
  };
  return <div
    ref={ref}
    className={`desk-touch-fader ${disabled ? 'disabled' : ''}`}
    style={{ '--fader-value': `${clampPercent(value)}%`, '--output-value': `${clampPercent(outputValue ?? value)}%`, '--fader-color': color } as CSSProperties}
    role="slider"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(value)}
    tabIndex={disabled ? -1 : 0}
    onKeyDown={onKeyDown}
    onPointerDown={(event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      changeFromPointer(event);
    }}
    onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) changeFromPointer(event); }}
    onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
  >
    <i className="desk-touch-output" />
    <i className="desk-touch-groove" />
    <i className="desk-touch-fill" />
    <span className="desk-touch-thumb"><i /></span>
  </div>;
}

function AssignmentPanel({ choices, selected, onPick, onClose }: {
  choices: LiveSurfaceAssignment[];
  selected?: LiveSurfaceAssignment;
  onPick: (assignment: LiveSurfaceAssignment) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const visible = choices.filter((choice) => `${choice.kind} ${choice.label}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="desk-assign-overlay">
    <button className="desk-assign-backdrop" aria-label="Close assignment panel" onClick={onClose} />
    <section className="desk-assign-panel">
      <header><div><small>CONTROL SURFACE</small><strong>Assign control</strong><span>{selected ? `${selected.kind.toUpperCase()} · ${selected.label}` : 'Choose a slot first'}</span></div><button onClick={onClose}>×</button></header>
      <label className="desk-assign-search"><span>SEARCH CONTROLS</span><input autoFocus value={filter} placeholder="Fixtures, groups, looks, effects…" onChange={(event) => setFilter(event.target.value)} /></label>
      <div className="desk-assign-grid">
        {visible.map((assignment, index) => <button key={`${assignment.kind}-${assignment.targetId ?? assignment.label}-${index}`} style={{ '--slot': assignment.color || '#65727a' } as CSSProperties} onClick={() => onPick(assignment)}><i /><small>{assignment.kind}</small><strong>{assignment.label}</strong></button>)}
      </div>
    </section>
  </div>;
}

function SurfaceFader({ assignment, value, outputValue, enabled, onActivate, onChange, onFlash }: {
  assignment: LiveSurfaceAssignment;
  value: number;
  outputValue?: number;
  enabled: boolean;
  onActivate: () => void;
  onChange: (value: number) => void;
  onFlash: (active: boolean) => void;
}) {
  const canFlash = assignment.kind === 'fixture' || assignment.kind === 'group';
  return <article className="desk-surface-fader" style={{ '--slot': assignment.color || '#5c6970' } as CSSProperties}>
    <button className="desk-surface-label" onClick={onActivate}><small>{assignment.kind.toUpperCase()}</small><strong>{assignment.label}</strong></button>
    <b>{Math.round(value)}</b>
    <TouchFader label={assignment.label} value={value} outputValue={outputValue} disabled={!enabled} color={assignment.color || '#55f29a'} onChange={onChange} />
    <button className="desk-surface-flash" disabled={!canFlash} onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onFlash(true); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onFlash(false); }} onPointerCancel={() => onFlash(false)} onLostPointerCapture={() => onFlash(false)}>FLASH</button>
  </article>;
}

export function DesktopLiveController(props: DesktopLiveControllerProps) {
  const [mode, setMode] = useState<LiveSurfaceMode>('faders');
  const [page, setPage] = useState(1);
  const [poolMode, setPoolMode] = useState<PoolMode>('groups');
  const [edit, setEdit] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentMap>(() => loadAssignments(props.showName));
  const heldEffects = useRef(new Set<string>());
  const onEffectReleaseRef = useRef(props.onEffectRelease);

  useEffect(() => { try { localStorage.setItem(safeStorageKey(props.showName), JSON.stringify(assignments)); } catch { /* keep the live surface operational if storage is full */ } }, [assignments, props.showName]);
  useEffect(() => { onEffectReleaseRef.current = props.onEffectRelease; }, [props.onEffectRelease]);
  useEffect(() => () => { heldEffects.current.forEach((effectId) => onEffectReleaseRef.current(effectId)); heldEffects.current.clear(); }, []);

  const defaults = useMemo(() => {
    const map: AssignmentMap = {};
    const faderSources: LiveSurfaceAssignment[] = [
      ...props.groups.map((group) => ({ id: group.id, kind: 'group' as const, targetId: group.id, label: group.name, color: group.color })),
      ...props.fixtures.map((fixture) => ({ id: fixture.id, kind: 'fixture' as const, targetId: fixture.id, label: fixture.name, color: fixture.color }))
    ];
    for (let index = 0; index < PAGE_COUNT * FADER_COUNT; index += 1) {
      const source = faderSources[index];
      if (source) {
        map[liveSlotKey('faders', Math.floor(index / FADER_COUNT) + 1, index % FADER_COUNT)] = source;
        map[liveSlotKey('ma', Math.floor(index / FADER_COUNT) + 1, index % FADER_COUNT)] = source;
      }
    }
    const buskSources: LiveSurfaceAssignment[] = [
      ...props.looks.map((look) => ({ id: look.id, kind: 'look' as const, targetId: look.id, label: look.name, color: look.color })),
      ...props.effects.map((effect) => ({ id: effect.id, kind: 'effect' as const, targetId: effect.id, label: effect.name, color: effect.color, momentary: effect.momentary }))
    ];
    buskSources.slice(0, 32).forEach((source, index) => { map[liveSlotKey('busk', 1, index)] = source; });
    return map;
  }, [props.effects, props.fixtures, props.groups, props.looks]);

  const assignment = (index: number) => assignments[liveSlotKey(mode, page, index)] || defaults[liveSlotKey(mode, page, index)] || emptyLiveAssignment(liveSlotKey(mode, page, index));
  const valueFor = (item: LiveSurfaceAssignment) => {
    if (item.kind === 'master') return props.master;
    if (item.kind === 'fixture') return props.fixtures.find((fixture) => fixture.id === item.targetId)?.intensity ?? 0;
    if (item.kind === 'group') return props.groups.find((group) => group.id === item.targetId)?.intensity ?? 0;
    return 0;
  };
  const outputFor = (item: LiveSurfaceAssignment) => item.kind === 'fixture' ? props.fixtures.find((fixture) => fixture.id === item.targetId)?.outputIntensity : undefined;
  const activeFor = (item: LiveSurfaceAssignment) => {
    if (item.kind === 'fixture') return props.fixtures.find((fixture) => fixture.id === item.targetId)?.selected ?? false;
    if (item.kind === 'group') return props.groups.find((group) => group.id === item.targetId)?.selected ?? false;
    if (item.kind === 'effect') return props.effects.find((effect) => effect.id === item.targetId)?.active ?? false;
    if (item.kind === 'blackout') return props.blackout;
    return false;
  };

  const releaseHeldEffects = () => {
    heldEffects.current.forEach(props.onEffectRelease);
    heldEffects.current.clear();
  };
  const activate = (item: LiveSurfaceAssignment) => {
    if (item.kind === 'group') {
      const group = props.groups.find((candidate) => candidate.id === item.targetId);
      if (group) props.onSelectFixtures(group.fixtureIds, 'replace');
    } else if (item.kind === 'fixture' && item.targetId) props.onSelectFixtures([item.targetId], 'replace');
    else if (item.kind === 'look' && item.targetId) props.onLook(item.targetId);
    else if (item.kind === 'effect' && item.targetId) {
      if (item.momentary) heldEffects.current.add(item.targetId);
      props.onEffectPress(item.targetId, Boolean(item.momentary));
    } else if (item.kind === 'color' && item.color) props.onColor(item.color);
    else if (item.kind === 'level') props.onSelectedLevel(clampPercent(item.value ?? 0));
    else if (item.kind === 'cue-go') props.onGo();
    else if (item.kind === 'cue-back') props.onBack();
    else if (item.kind === 'blackout') props.onBlackout();
    else if (item.kind === 'stop-fx') props.onStopFx();
  };
  const release = (item: LiveSurfaceAssignment) => {
    if (item.kind === 'effect' && item.targetId && heldEffects.current.has(item.targetId)) {
      heldEffects.current.delete(item.targetId);
      props.onEffectRelease(item.targetId);
    }
  };
  const changeLevel = (item: LiveSurfaceAssignment, value: number) => {
    if (item.kind === 'master') props.onMaster(value);
    if (item.kind === 'fixture' && item.targetId) props.onFixtureLevel(item.targetId, value);
    if (item.kind === 'group' && item.targetId) props.onGroupLevel(item.targetId, value);
  };
  const flash = (item: LiveSurfaceAssignment, active: boolean) => {
    if (item.kind === 'fixture' && item.targetId) props.onFlashFixtures([item.targetId], active);
    if (item.kind === 'group') {
      const group = props.groups.find((candidate) => candidate.id === item.targetId);
      if (group) props.onFlashFixtures(group.fixtureIds, active);
    }
  };
  const openAssignment = (index: number) => setAssigning(liveSlotKey(mode, page, index));
  const chooseAssignment = (next: LiveSurfaceAssignment) => {
    if (!assigning) return;
    setAssignments((current) => ({ ...current, [assigning]: { ...next, id: `${next.kind}-${crypto.randomUUID()}` } }));
    setAssigning(null);
  };
  const tapSlot = (index: number, item: LiveSurfaceAssignment) => edit ? openAssignment(index) : activate(item);
  const switchMode = (next: LiveSurfaceMode) => { releaseHeldEffects(); setMode(next); setPage(1); setAssigning(null); };

  const assignmentChoices = useMemo<LiveSurfaceAssignment[]>(() => [
    emptyLiveAssignment('empty'),
    ...props.groups.map((group) => ({ id: group.id, kind: 'group', targetId: group.id, label: group.name, color: group.color } as LiveSurfaceAssignment)),
    ...props.fixtures.map((fixture) => ({ id: fixture.id, kind: 'fixture', targetId: fixture.id, label: fixture.name, color: fixture.color } as LiveSurfaceAssignment)),
    ...props.looks.map((look) => ({ id: look.id, kind: 'look', targetId: look.id, label: look.name, color: look.color } as LiveSurfaceAssignment)),
    ...props.effects.map((effect) => ({ id: effect.id, kind: 'effect', targetId: effect.id, label: effect.name, color: effect.color, momentary: effect.momentary } as LiveSurfaceAssignment)),
    ...([['WHITE', '#ffffff'], ['WARM', '#ffb14a'], ['RED', '#ff2945'], ['AMBER', '#ff7a1a'], ['GREEN', '#38df72'], ['CYAN', '#25e3ef'], ['BLUE', '#286cff'], ['PURPLE', '#bc36ff']] as const).map(([label, color]) => ({ id: `color-${label}`, kind: 'color', label, color } as LiveSurfaceAssignment)),
    ...[0, 25, 50, 75, 100].map((value) => ({ id: `level-${value}`, kind: 'level', label: `${value}%`, value } as LiveSurfaceAssignment)),
    { id: 'cue-back', kind: 'cue-back', label: 'BACK' },
    { id: 'cue-go', kind: 'cue-go', label: 'GO', color: '#55f29a' },
    { id: 'stop-fx', kind: 'stop-fx', label: 'STOP FX', color: '#e0a24f' },
    { id: 'blackout', kind: 'blackout', label: 'BLACKOUT', color: '#e74b5b' },
    { id: 'master', kind: 'master', label: 'GRAND MASTER', color: '#55f29a' }
  ], [props.effects, props.fixtures, props.groups, props.looks]);

  const maPool = poolMode === 'groups'
    ? props.groups.slice(0, 12).map((group, index) => <button key={group.id} className={group.selected ? 'active' : ''} onClick={() => props.onSelectFixtures(group.fixtureIds, 'replace')}><em>{index + 1}</em><i style={{ background: group.color }} /><strong>{group.name}</strong><small>GROUP</small></button>)
    : poolMode === 'fixtures'
      ? props.fixtures.slice(0, 12).map((fixture, index) => <button key={fixture.id} className={fixture.selected ? 'active' : ''} onClick={() => props.onSelectFixtures([fixture.id], 'toggle')}><em>{index + 1}</em><i style={{ background: fixture.color }} /><strong>{fixture.name}</strong><small>FIXTURE</small></button>)
      : [0, 25, 50, 75, 100].map((value, index) => <button key={value} onClick={() => props.onSelectedLevel(value)}><em>{index + 1}</em><strong>{value}%</strong><small>AT LEVEL</small></button>);

  const buskAssignments = Array.from({ length: 32 }, (_, index) => assignment(index));

  return <section className="desk-live-controller">
    <header className="desk-surface-header">
      <div><small>LIVE CONTROL SURFACE</small><strong>{mode === 'ma' ? 'MA DESK' : mode.toUpperCase()}</strong><span>{props.showName}</span></div>
      <nav>{(['faders', 'ma', 'busk'] as LiveSurfaceMode[]).map((item) => <button key={item} className={mode === item ? 'active' : ''} onClick={() => switchMode(item)}>{item === 'ma' ? 'MA' : item.toUpperCase()}</button>)}</nav>
      <button className={edit ? 'desk-assign-toggle active' : 'desk-assign-toggle'} onClick={() => { releaseHeldEffects(); setEdit((current) => !current); setAssigning(null); }}>{edit ? 'DONE' : 'ASSIGN'}</button>
    </header>

    <div className="desk-surface-status"><span className={props.outputHealthy ? 'ok' : ''}>OUTPUT</span><span className={props.dmxConnected ? 'ok' : ''}>DMX</span><b>{Math.round(props.bpm)} <small>BPM</small></b><strong>{props.currentCueNumber ? `${props.currentCueNumber} · ` : ''}{props.currentCue}</strong><button disabled={!props.nextCue} onClick={props.onGo}>GO</button></div>

    {mode === 'faders' && <div className="desk-classic-scroll"><div className="desk-classic-surface">{Array.from({ length: FADER_COUNT }, (_, index) => {
      const item = assignment(index);
      return <SurfaceFader key={index} assignment={item} value={valueFor(item)} outputValue={outputFor(item)} enabled={['fixture', 'group', 'master'].includes(item.kind)} onActivate={() => tapSlot(index, item)} onChange={(value) => changeLevel(item, value)} onFlash={(active) => flash(item, active)} />;
    })}</div></div>}

    {mode === 'ma' && <div className="desk-ma-scroll"><div className="desk-ma-surface">
      <aside className="desk-ma-command"><button className={poolMode === 'groups' ? 'active' : ''} onClick={() => setPoolMode('groups')}>GROUP</button><button className={poolMode === 'fixtures' ? 'active' : ''} onClick={() => setPoolMode('fixtures')}>FIXTURE</button><button className={poolMode === 'intensity' ? 'active' : ''} onClick={() => setPoolMode('intensity')}>AT</button><button onClick={() => props.onSelectedLevel(100)}>FULL</button><button onClick={() => props.onSelectFixtures([], 'replace')}>CLEAR</button><button onClick={props.onStopFx}>OFF</button></aside>
      <main><div className="desk-ma-pool">{maPool}</div><div className="desk-ma-executors">{Array.from({ length: FADER_COUNT }, (_, index) => { const item = assignment(index); return <article key={index} className={activeFor(item) ? 'active' : ''}><button className="desk-exec-label" onClick={() => tapSlot(index, item)}><em>{(page - 1) * FADER_COUNT + index + 1}</em><strong>{item.label}</strong><small>{item.kind}</small></button><SurfaceFader assignment={item} value={valueFor(item)} outputValue={outputFor(item)} enabled={['fixture', 'group', 'master'].includes(item.kind)} onActivate={() => tapSlot(index, item)} onChange={(value) => changeLevel(item, value)} onFlash={(active) => flash(item, active)} /><button disabled={item.kind === 'empty'} onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); activate(item); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); release(item); }} onPointerCancel={() => release(item)} onLostPointerCapture={() => release(item)}>GO+</button></article>; })}</div></main>
    </div></div>}

    {mode === 'busk' && <div className="desk-busk-scroll"><div className="desk-busk-surface">
      <div className="desk-busk-display"><div><small>LUMARIG PERFORMANCE</small><strong>{props.currentCue}</strong></div><b>{Math.round(props.bpm)}<small>BPM</small></b><span>{props.fixtures.filter((fixture) => fixture.selected).length} SELECTED</span><button onClick={props.onStopFx}>STOP FX</button></div>
      <div className="desk-busk-encoders">
        {[['MASTER', props.master, props.onMaster], ['FX SPEED', props.fxSpeed, props.onFxSpeed], ['FX SIZE', props.fxDepth, props.onFxDepth]].map(([label, value, onChange]) => <label key={label as string}><span style={{ '--turn': `${-135 + (Number(value) / 100) * 270}deg` } as CSSProperties}><i /></span><strong>{label as string}</strong><small>{Math.round(Number(value))}</small><input aria-label={label as string} type="range" min="0" max="100" value={Number(value)} onChange={(event) => (onChange as (value: number) => void)(Number(event.target.value))} /></label>)}
        {['DIMMER', 'PAN', 'TILT', 'ZOOM', 'STROBE'].map((label) => <label className="disabled" key={label}><span style={{ '--turn': '-135deg' } as CSSProperties}><i /></span><strong>{label}</strong><small>SELECT</small></label>)}
      </div>
      <div className="desk-busk-body"><aside><button onClick={() => props.onSelectedLevel(100)}>FULL</button><button onClick={() => props.onSelectedLevel(0)}>OUT</button><button onClick={props.onBack}>BACK</button><button className="go" onClick={props.onGo}>GO</button></aside><main>{buskAssignments.map((item, index) => <button key={index} className={`desk-busk-pad ${activeFor(item) ? 'active' : ''} ${edit ? 'editing' : ''}`} style={{ '--pad': item.color || '#5e6b72' } as CSSProperties} onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); if (edit) openAssignment(index); else activate(item); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); release(item); }} onPointerCancel={() => release(item)} onLostPointerCapture={() => release(item)}><i /><strong>{item.label}</strong><small>{item.kind}</small><em>{index + 1}</em></button>)}</main><aside className="desk-busk-scenes">{[1, 2, 3, 4].map((scene) => <button key={scene} className={page === scene ? 'active' : ''} onClick={() => setPage(scene)}>SCENE <b>{scene}</b></button>)}<button onClick={props.onStopFx}>STOP FX</button><button className={props.blackout ? 'active danger' : 'danger'} onClick={props.onBlackout}>{props.blackout ? 'RELEASE' : 'BLACKOUT'}</button></aside></div>
      <div className="desk-busk-groups">{props.groups.slice(0, 8).map((group) => <button key={group.id} className={group.selected ? 'active' : ''} onClick={() => props.onSelectFixtures(group.fixtureIds, 'replace')}><i style={{ background: group.color }} /><small>GROUP</small><strong>{group.name}</strong></button>)}</div>
    </div></div>}

    <footer className="desk-surface-pages"><button aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>{[1, 2, 3, 4].map((number) => <button key={number} className={page === number ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button aria-label="Next page" onClick={() => setPage((current) => Math.min(PAGE_COUNT, current + 1))}>›</button><span>PAGE {page} · {edit ? 'TAP A CONTROL TO ASSIGN' : 'LIVE'}</span><button className={props.blackout ? 'danger active' : 'danger'} onClick={props.onBlackout}>{props.blackout ? 'RELEASE' : 'BLACKOUT'}</button></footer>

    {assigning && <AssignmentPanel choices={assignmentChoices} selected={assignments[assigning] || defaults[assigning]} onPick={chooseAssignment} onClose={() => setAssigning(null)} />}
  </section>;
}
