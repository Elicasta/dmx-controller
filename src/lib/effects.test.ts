import { describe, expect, it } from 'vitest';
import { EFFECT_PRESETS, renderEffect } from './effects';
import { DEFAULT_PATCH, type PatchedFixture } from './fixtures';

describe('portable effects', () => {
  it('uses the semantic dimmer channel for pulse and strobe', () => {
    expect(renderEffect('pulse', DEFAULT_PATCH, 0, 60, 1)[0][0]).toBe(5);
    expect(renderEffect('strobe', DEFAULT_PATCH, 300, 120, 1)[0][0]).toBe(5);
  });

  it('renders rainbow through semantic RGB channels', () => {
    expect(renderEffect('rainbow', DEFAULT_PATCH, 0, 60, 1).map(([channel]) => channel)).toEqual([1, 2, 3]);
  });

  it('renders blinder and finale as portable RGB plus dimmer output', () => {
    expect(renderEffect('blinder', DEFAULT_PATCH, 0, 120, 1).map(([channel]) => channel)).toEqual([1, 2, 3, 5]);
    expect(renderEffect('finale', DEFAULT_PATCH, 0, 120, 1).some(([channel]) => channel === 5)).toBe(true);
  });

  it('includes popular wave, color, sparkle, UV, and momentary hit presets', () => {
    expect(EFFECT_PRESETS.find((effect) => effect.id === 'blinder')?.momentary).toBe(true);
    expect(EFFECT_PRESETS.find((effect) => effect.id === 'bump')?.momentary).toBe(true);
    expect(renderEffect('wave', DEFAULT_PATCH, 250, 120, 1)[0][0]).toBe(5);
    expect(renderEffect('color-chase', DEFAULT_PATCH, 0, 120, 1).map(([channel]) => channel)).toEqual([1, 2, 3]);
    expect(renderEffect('sparkle', DEFAULT_PATCH, 0, 120, 1).some(([channel]) => channel === 5)).toBe(true);
    expect(renderEffect('uv-pulse', DEFAULT_PATCH, 250, 120, 1).some(([channel]) => channel === 4)).toBe(true);
  });

  it('uses profile-mapped pan and tilt for moving sweeps', () => {
    const mover: PatchedFixture = { id: 'm', name: 'Mover', profileId: 'adj-pocket-pro', modeId: '11ch-starter', address: 20, group: 'Moving', selected: true, collapsed: false };
    expect(renderEffect('sweep', [mover], 0, 60, 1).map(([channel]) => channel)).toEqual([20, 22]);
  });

  it('does not treat an empty selection as the whole rig', () => {
    const unselected = DEFAULT_PATCH.map((fixture) => ({ ...fixture, selected: false }));
    expect(renderEffect('pulse', unselected, 0, 60, 1)).toEqual([]);
  });

  it('chases in the supplied group fixture order', () => {
    const first = { ...DEFAULT_PATCH[0], id: 'first', address: 1, selected: true };
    const second = { ...DEFAULT_PATCH[0], id: 'second', address: 11, selected: true };
    expect(renderEffect('chase', [second, first], 0, 120, 1)).toEqual([[15, 255], [5, 0]]);
  });
});
