import { memo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { EFFECT_PRESETS, type EffectId } from '../lib/effects';
import { findProfile, type PatchedFixture } from '../lib/fixtures';
import type { FixtureLook } from '../lib/looks';
import type { FixtureGroup } from '../lib/show';
import {
  effectSupportedByFixtures,
  fixtureFootprintLabel,
  fixtureSupportsColor,
  fixturesInGroup
} from '../core/console-domain';

type FixtureBrowserProps = {
  patch: readonly PatchedFixture[];
  groups: readonly FixtureGroup[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectFixture: (fixtureId: string, additive: boolean) => void;
  onSelectGroup?: (groupId: string) => void;
  selectedGroupId?: string | null;
  assignmentIds?: readonly string[];
  onToggleAssignment?: (fixtureId: string) => void;
  scenery?: ReadonlyArray<{ id: string; label: string; type: string; color: string }>;
  selectedSceneryId?: string | null;
  onSelectScenery?: (id: string) => void;
};

export const FixtureBrowser = memo(function FixtureBrowser({
  patch,
  groups,
  search,
  onSearchChange,
  onSelectAll,
  onClearSelection,
  onSelectFixture,
  onSelectGroup,
  selectedGroupId,
  assignmentIds,
  onToggleAssignment,
  scenery = [],
  selectedSceneryId,
  onSelectScenery
}: FixtureBrowserProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const query = search.trim().toLowerCase();
  const assignmentSet = new Set(assignmentIds ?? []);
  const visibleGroups = groups.map((group) => ({
    group,
    fixtures: fixturesInGroup(patch, group).filter((fixture) => !query || fixture.name.toLowerCase().includes(query))
  })).filter(({ group, fixtures }) => !query || group.name.toLowerCase().includes(query) || fixtures.length > 0);
  const unassigned = patch.filter((fixture) => !fixture.group && (!query || fixture.name.toLowerCase().includes(query)));

  return <aside className="console-browser">
    <div className="console-browser-head">
      <div><span>FIXTURES &amp; GROUPS</span><strong>{patch.length} patched</strong></div>
      <button className="icon-button" onClick={onClearSelection} title="Clear fixture selection">×</button>
    </div>
    <label className="console-search"><span aria-hidden="true">⌕</span><input aria-label="Search fixtures" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search fixtures…" /></label>
    <button className={`browser-all ${patch.length > 0 && patch.every((fixture) => fixture.selected) ? 'active' : ''}`} onClick={onSelectAll}>
      <span className="browser-grid-icon">⠿</span><strong>All Fixtures</strong><b>{patch.length}</b>
    </button>
    <div className="browser-groups">
      {visibleGroups.map(({ group, fixtures }) => {
        const isCollapsed = collapsed[group.id] ?? false;
        return <section className={`browser-group ${selectedGroupId === group.id ? 'selected-group' : ''}`} key={group.id}>
          <div className="browser-group-title">
            <button className="browser-collapse" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.name}`} onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !isCollapsed }))}>{isCollapsed ? '›' : '⌄'}</button>
            <button className="browser-group-select" onClick={() => onSelectGroup?.(group.id)}><i style={{ background: group.labelColor }} /><strong>{group.name}</strong><b>{fixtures.length}</b></button>
          </div>
          {!isCollapsed && <div className="browser-fixtures">{fixtures.map((fixture) => <button
            key={fixture.id}
            className={`${fixture.selected ? 'active' : ''} ${onToggleAssignment ? 'with-checkbox' : 'no-checkbox'}`}
            onClick={(event) => onSelectFixture(fixture.id, event.metaKey || event.ctrlKey || event.shiftKey)}
          >
            {onToggleAssignment && <input aria-label={`Assign ${fixture.name}`} type="checkbox" checked={assignmentSet.has(fixture.id)} onClick={(event) => event.stopPropagation()} onChange={() => onToggleAssignment(fixture.id)} />}
            <i style={{ background: fixture.labelColor ?? group.labelColor }} />
            <span><strong>{fixture.name}</strong><small>{fixtureFootprintLabel(fixture)}</small></span>
          </button>)}</div>}
        </section>;
      })}
      {(unassigned.length > 0 || groups.length === 0) && <section className="browser-group">
        <div className="browser-group-title"><button className="browser-collapse">⌄</button><button className="browser-group-select"><i className="unassigned" /><strong>Unassigned</strong><b>{unassigned.length}</b></button></div>
        <div className="browser-fixtures">{unassigned.map((fixture) => <button key={fixture.id} className={`${fixture.selected ? 'active' : ''} no-checkbox`} onClick={(event) => onSelectFixture(fixture.id, event.metaKey || event.ctrlKey || event.shiftKey)}><i style={{ background: fixture.labelColor ?? '#64748b' }} /><span><strong>{fixture.name}</strong><small>{fixtureFootprintLabel(fixture)}</small></span></button>)}</div>
      </section>}
      {scenery.length > 0 && <section className="browser-group browser-scenery">
        <div className="browser-group-title"><button className="browser-collapse" aria-hidden="true">⌄</button><button className="browser-group-select" type="button"><i className="scenery-dot" /><strong>Scenery</strong><b>{scenery.length}</b></button></div>
        <div className="browser-fixtures">{scenery.map((item) => <button key={item.id} className={`${selectedSceneryId === item.id ? 'active' : ''} no-checkbox`} onClick={() => onSelectScenery?.(item.id)}><i style={{ background: item.color }} /><span><strong>{item.label}</strong><small>{item.type.replace(/-/g, ' ')}</small></span></button>)}</div>
      </section>}
    </div>
  </aside>;
});

type ColorDeckProps = {
  title: string;
  subtitle: string;
  color: string;
  disabled?: boolean;
  onChange: (color: string) => void;
  presets: ReadonlyArray<{ name: string; color: string }>;
};

export const ColorDeck = memo(function ColorDeck({ title, subtitle, color, disabled, onChange, presets }: ColorDeckProps) {
  const red = Number.parseInt(color.slice(1, 3), 16) || 0;
  const green = Number.parseInt(color.slice(3, 5), 16) || 0;
  const blue = Number.parseInt(color.slice(5, 7), 16) || 0;
  return <section className={`color-deck ${disabled ? 'disabled' : ''}`}>
    <div className="color-deck-title"><span>{title}</span><small>{subtitle}</small></div>
    <div className="hue-rail" aria-hidden="true"><span style={{ left: `${(red + green + blue) / 765 * 100}%` }} /></div>
    <label className="color-wheel-control" title="Choose color">
      <input type="color" value={color} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      <span style={{ background: color }} />
    </label>
    <div className="selected-color-readout"><i style={{ background: color }} /><div><span>SELECTED COLOR</span><strong>{color.toUpperCase()}</strong><small>R {red} &nbsp; G {green} &nbsp; B {blue}</small></div></div>
    <div className="color-preset-row">{presets.map((preset) => <button key={preset.name} disabled={disabled} title={preset.name} aria-label={preset.name} style={{ background: preset.color }} onClick={() => onChange(preset.color)} />)}</div>
  </section>;
});

type VerticalFaderProps = {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  value: number | null;
  selected: boolean;
  onChange: (value: number) => void;
  onSelect: () => void;
  onFx: () => void;
  quickAction?: { label: string; onPress: () => void };
};

export const VerticalFader = memo(function VerticalFader({ id, name, subtitle, color, value, selected, onChange, onSelect, onFx, quickAction }: VerticalFaderProps) {
  return <article className={`console-fader-strip ${selected ? 'selected' : ''}`} style={{ '--strip-color': color } as CSSProperties}>
    <header><strong title={name}>{name}</strong><small>{subtitle}</small><span className="fixture-glyph" aria-hidden="true">{subtitle.toLowerCase().includes('moving') ? '◉' : '✦'}</span></header>
    <div className="vertical-fader-wrap">
      <input aria-label={`${name} brightness`} id={`fader-${id}`} className="vertical-fader" type="range" min="0" max="100" value={value ?? 0} disabled={value === null} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
    <output htmlFor={`fader-${id}`}>{value === null ? 'N/A' : `${value}%`}</output>
    <button className={`strip-select ${selected ? 'active' : ''}`} onClick={onSelect}>{selected ? 'Selected' : 'Select'}</button>
    <button className="strip-fx" onClick={onFx}>FX</button>
    {quickAction && <button className="strip-quick" onClick={quickAction.onPress}>▶ {quickAction.label}</button>}
  </article>;
});

type EffectsPanelProps = {
  title: string;
  targetName: string;
  fixtures: readonly PatchedFixture[];
  activeEffect: EffectId | null;
  bpm: number;
  depth: number;
  disabled?: boolean;
  onBpmChange: (value: number) => void;
  onDepthChange: (value: number) => void;
  onStart: (effect: EffectId) => void;
  onPress: (effect: EffectId) => void;
  onRelease: (effect: EffectId) => void;
  onStop: () => void;
};

export const EffectsPanel = memo(function EffectsPanel({ title, targetName, fixtures, activeEffect, bpm, depth, disabled, onBpmChange, onDepthChange, onStart, onPress, onRelease, onStop }: EffectsPanelProps) {
  const pointerPress = (event: ReactPointerEvent<HTMLButtonElement>, effect: EffectId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPress(effect);
  };
  return <aside className="console-inspector effects-inspector">
    <header><span>{title}</span><strong>{targetName || 'No target selected'}</strong><small>{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'}</small></header>
    <div className="effect-tile-grid">{EFFECT_PRESETS.map((effect) => {
      const supported = !disabled && effectSupportedByFixtures(effect.id, fixtures);
      const className = `${activeEffect === effect.id ? 'active' : ''} ${effect.momentary ? 'momentary' : ''}`;
      return <button
        key={effect.id}
        className={className}
        disabled={!supported}
        title={supported ? effect.description : `${effect.name} is not supported by this target`}
        onClick={() => { if (!effect.momentary) onStart(effect.id); }}
        onPointerDown={(event) => { if (effect.momentary) pointerPress(event, effect.id); }}
        onPointerUp={(event) => { if (effect.momentary) { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onRelease(effect.id); } }}
        onPointerCancel={() => { if (effect.momentary) onRelease(effect.id); }}
        onBlur={() => { if (effect.momentary) onRelease(effect.id); }}
        onKeyDown={(event) => {
          if (effect.momentary && (event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault();
            onPress(effect.id);
          }
        }}
        onKeyUp={(event) => {
          if (effect.momentary && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            onRelease(effect.id);
          }
        }}
      ><span className={`fx-icon fx-${effect.id}`} /><strong>{effect.name}</strong>{effect.momentary && <small>HOLD</small>}</button>;
    })}</div>
    <div className="effect-parameter"><label><span>SPEED</span><b>{bpm} BPM</b></label><input type="range" min="30" max="240" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></div>
    <div className="effect-parameter"><label><span>DEPTH</span><b>{depth}%</b></label><input type="range" min="0" max="100" value={depth} onChange={(event) => onDepthChange(Number(event.target.value))} /></div>
    {activeEffect ? <button className="stop-effect-button" onClick={onStop}>Stop active FX</button> : <div className="effect-help">Choose an effect. Movement FX are available only when the target supports Pan and Tilt.</div>}
  </aside>;
});

export const LooksStrip = memo(function LooksStrip({ looks, onApply, onSave }: { looks: readonly FixtureLook[]; onApply: (look: FixtureLook) => void; onSave: () => void }) {
  return <section className="looks-strip"><div className="looks-label"><span>LOOKS / PRESETS</span><small>Selected fixtures</small></div><div className="looks-bank">{looks.map((look) => {
    const color = `rgb(${look.values.red} ${look.values.green} ${look.values.blue})`;
    return <button key={look.id} onClick={() => onApply(look)}><i style={{ background: `radial-gradient(circle at 50% 90%, ${color}, transparent 62%), #090b0e` }} /><strong>{look.name}</strong></button>;
  })}<button className="save-look" onClick={onSave}><i>＋</i><strong>Save Look</strong></button></div></section>;
});

export function fixtureBrowserSubtitle(fixture: PatchedFixture): string {
  return findProfile(fixture.profileId)?.category ?? 'Fixture';
}

export function compatibleColorFixtures(fixtures: readonly PatchedFixture[]): PatchedFixture[] {
  return fixtures.filter(fixtureSupportsColor);
}
