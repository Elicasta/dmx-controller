import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from './fixtures';
import { buildMidiControls, midiBindingLabel, midiValueToRange, sanitizeMidiMappings } from './midi';

describe('MIDI assignment helpers', () => {
  it('migrates the original mapping format and keeps its binding', () => {
    const [mapping] = sanitizeMidiMappings([{ target: 'go', kind: 'note', channel: 2, number: 64 }]);
    expect(mapping).toMatchObject({ target: 'go', kind: 'note', channel: 2, number: 64 });
    expect(mapping.id).toContain('go');
  });

  it('creates assignable fixture controls from profile parameters', () => {
    const controls = buildMidiControls(DEFAULT_PATCH);
    expect(controls.some((control) => control.id === `fixture:${DEFAULT_PATCH[0].id}:dimmer`)).toBe(true);
    expect(controls.some((control) => control.id === `fixture-select:${DEFAULT_PATCH[0].id}`)).toBe(true);
    expect(controls.some((control) => control.id === 'effect:sweep')).toBe(true);
    expect(controls.some((control) => control.id === 'effect:blinder')).toBe(true);
  });

  it('scales MIDI values and labels unassigned controls', () => {
    expect(midiValueToRange(64, 30, 240)).toBeCloseTo(135.83, 1);
    expect(midiBindingLabel({ id: 'new', target: 'tempo', kind: null, channel: null, number: null })).toBe('Waiting for input');
  });
});
