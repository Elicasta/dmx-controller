import { findMode, type FixtureParameter, type PatchedFixture } from './fixtures';
import { EFFECT_PRESETS } from './effects';

export type MidiSourceKind = 'note' | 'cc';
export type MidiControlType = 'button' | 'slider';

export type MidiMapping = {
  id: string;
  target: string;
  kind: MidiSourceKind | null;
  channel: number | null;
  number: number | null;
  /** CC value required to press a button-style control. Notes ignore this value. */
  triggerValue: number;
};

export type MidiAssignableControl = {
  id: string;
  label: string;
  group: string;
  type: MidiControlType;
  min?: number;
  max?: number;
};

export const DEFAULT_MIDI_MAPPINGS: MidiMapping[] = [
  { id: 'midi-go', target: 'go', kind: 'cc', channel: 1, number: 1, triggerValue: 100 },
  { id: 'midi-previous', target: 'previous', kind: 'cc', channel: 1, number: 2, triggerValue: 100 },
  { id: 'midi-blackout', target: 'blackout', kind: 'cc', channel: 1, number: 3, triggerValue: 100 },
  { id: 'midi-master', target: 'master', kind: 'cc', channel: 1, number: 7, triggerValue: 100 }
];

export const BASE_MIDI_CONTROLS: ReadonlyArray<MidiAssignableControl> = [
  { id: 'go', label: 'GO / next cue', group: 'Show', type: 'button' },
  { id: 'previous', label: 'Previous cue', group: 'Show', type: 'button' },
  { id: 'blackout', label: 'Blackout toggle', group: 'Show', type: 'button' },
  { id: 'master', label: 'Grand master', group: 'Live controls', type: 'slider', min: 0, max: 100 },
  { id: 'tempo', label: 'Effect tempo', group: 'Live controls', type: 'slider', min: 30, max: 240 },
  { id: 'effect-depth', label: 'Effect depth', group: 'Live controls', type: 'slider', min: 0, max: 100 },
  { id: 'tap-tempo', label: 'Tap tempo', group: 'Live controls', type: 'button' },
  { id: 'stop-effect', label: 'Stop active effect', group: 'Live controls', type: 'button' },
  { id: 'global-red', label: 'Global red level', group: 'Color', type: 'slider', min: 0, max: 255 },
  { id: 'global-green', label: 'Global green level', group: 'Color', type: 'slider', min: 0, max: 255 },
  { id: 'global-blue', label: 'Global blue level', group: 'Color', type: 'slider', min: 0, max: 255 },
  ...['Red', 'Amber', 'Yellow', 'Green', 'Cyan', 'Blue', 'Magenta', 'White'].map((name) => ({
    id: `color:${name.toLowerCase()}`,
    label: `${name} preset`,
    group: 'Color',
    type: 'button' as const
  })),
  ...EFFECT_PRESETS.map((effect) => ({
    id: `effect:${effect.id}`,
    label: effect.name,
    group: 'Effects',
    type: 'button' as const
  }))
];

const PARAMETER_LABELS: Partial<Record<FixtureParameter, string>> = {
  dimmer: 'Brightness',
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  white: 'White',
  amber: 'Amber',
  uv: 'UV',
  strobe: 'Strobe',
  pan: 'Pan',
  panFine: 'Pan fine',
  tilt: 'Tilt',
  tiltFine: 'Tilt fine',
  movementSpeed: 'Movement speed',
  colorWheel: 'Color wheel',
  gobo: 'Gobo',
  focus: 'Focus',
  prism: 'Prism',
  macro: 'Macro'
};

export function buildMidiControls(fixtures: readonly PatchedFixture[]): MidiAssignableControl[] {
  const fixtureControls = fixtures.flatMap((fixture) => {
    const parameters = [...new Set((findMode(fixture)?.channels ?? []).flatMap((channel) => channel.parameter ? [channel.parameter] : []))];
    return [
      { id: `fixture-select:${fixture.id}`, label: 'Select / deselect', group: `Fixture · ${fixture.name}`, type: 'button' as const },
      ...parameters.map((parameter) => ({
        id: `fixture:${fixture.id}:${parameter}`,
        label: PARAMETER_LABELS[parameter] ?? parameter,
        group: `Fixture · ${fixture.name}`,
        type: 'slider' as const,
        min: 0,
        max: 255
      }))
    ];
  });
  return [...BASE_MIDI_CONTROLS, ...fixtureControls];
}

export function sanitizeMidiMappings(value: unknown, fallback = DEFAULT_MIDI_MAPPINGS): MidiMapping[] {
  if (!Array.isArray(value)) return fallback.map((mapping) => ({ ...mapping }));
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const mapping = item as Partial<MidiMapping>;
    if (typeof mapping.target !== 'string' || !mapping.target) return [];
    const kind = mapping.kind === 'note' || mapping.kind === 'cc' ? mapping.kind : null;
    const channel = Number.isInteger(mapping.channel) && Number(mapping.channel) >= 1 && Number(mapping.channel) <= 16 ? Number(mapping.channel) : null;
    const number = Number.isInteger(mapping.number) && Number(mapping.number) >= 0 && Number(mapping.number) <= 127 ? Number(mapping.number) : null;
    const bound = kind !== null && channel !== null && number !== null;
    return [{
      id: typeof mapping.id === 'string' && mapping.id ? mapping.id : `midi-${mapping.target}-${index}`,
      target: mapping.target,
      kind: bound ? kind : null,
      channel: bound ? channel : null,
      number: bound ? number : null,
      triggerValue: Math.max(1, Math.min(127, Number.isFinite(mapping.triggerValue) ? Math.round(Number(mapping.triggerValue)) : 100))
    }];
  });
}

export function midiValueToRange(value: number, min: number, max: number) {
  const normalized = Math.max(0, Math.min(127, value)) / 127;
  return min + normalized * (max - min);
}

export function midiBindingLabel(mapping: MidiMapping) {
  if (!mapping.kind || mapping.channel == null || mapping.number == null) return 'Waiting for input';
  const trigger = mapping.kind === 'cc' ? ` · trigger ≥ ${mapping.triggerValue}` : '';
  return `${mapping.kind === 'cc' ? 'CC' : 'Note'} ${mapping.number} · Ch ${mapping.channel}${trigger}`;
}
