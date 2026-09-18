import { describe, expect, it } from 'vitest';
import { easeInOutCubic, interpolateLook, isFixtureLook, STARTER_LOOKS } from './looks';

const dark = { red: 0, green: 0, blue: 0, uv: 0, dimmer: 0 };
const bright = { red: 255, green: 128, blue: 64, uv: 32, dimmer: 255 };

describe('fixture looks', () => {
  it('keeps fade easing inside the normalized range', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(.5)).toBe(.5);
    expect(easeInOutCubic(4)).toBe(1);
  });

  it('interpolates every fixture parameter', () => {
    expect(interpolateLook(dark, bright, 0)).toEqual(dark);
    expect(interpolateLook(dark, bright, 1)).toEqual(bright);
    expect(interpolateLook(dark, bright, .5)).toEqual({
      red: 128,
      green: 64,
      blue: 32,
      uv: 16,
      dimmer: 128
    });
  });

  it('validates persisted look data', () => {
    expect(isFixtureLook({ id: '1', name: 'Look', values: bright })).toBe(true);
    expect(isFixtureLook({ id: '1', name: 'Broken', values: { red: 255 } })).toBe(false);
  });

  it('ships a practical starter palette library', () => {
    expect(STARTER_LOOKS.length).toBeGreaterThanOrEqual(10);
    expect(STARTER_LOOKS.some((look) => look.id === 'clean-white')).toBe(true);
    expect(STARTER_LOOKS.some((look) => look.id === 'blacklight')).toBe(true);
  });
});
