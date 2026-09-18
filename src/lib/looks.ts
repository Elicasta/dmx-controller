import { clampDmx } from './dmx';

export type FixtureLookValues = {
  red: number;
  green: number;
  blue: number;
  uv: number;
  dimmer: number;
};

export type FixtureLook = {
  id: string;
  name: string;
  values: FixtureLookValues;
};

export const STARTER_LOOKS: readonly FixtureLook[] = [
  {
    id: 'warm-wash',
    name: 'Warm Wash',
    values: { red: 255, green: 86, blue: 24, uv: 0, dimmer: 210 }
  },
  {
    id: 'electric-blue',
    name: 'Electric Blue',
    values: { red: 12, green: 72, blue: 255, uv: 0, dimmer: 225 }
  },
  {
    id: 'hot-magenta',
    name: 'Hot Magenta',
    values: { red: 255, green: 0, blue: 176, uv: 0, dimmer: 220 }
  },
  {
    id: 'uv-glow',
    name: 'UV Glow',
    values: { red: 18, green: 0, blue: 58, uv: 150, dimmer: 180 }
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    values: { red: 255, green: 255, blue: 255, uv: 0, dimmer: 230 }
  },
  {
    id: 'deep-red',
    name: 'Deep Red',
    values: { red: 255, green: 0, blue: 0, uv: 0, dimmer: 220 }
  },
  {
    id: 'teal',
    name: 'Teal',
    values: { red: 0, green: 220, blue: 180, uv: 0, dimmer: 220 }
  },
  {
    id: 'amber',
    name: 'Amber',
    values: { red: 255, green: 72, blue: 0, uv: 0, dimmer: 215 }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    values: { red: 135, green: 60, blue: 255, uv: 36, dimmer: 210 }
  },
  {
    id: 'blacklight',
    name: 'Blacklight',
    values: { red: 0, green: 0, blue: 16, uv: 255, dimmer: 230 }
  },
  {
    id: 'house-lights',
    name: 'House Lights',
    values: { red: 255, green: 165, blue: 90, uv: 0, dimmer: 160 }
  }
] as const;

export function easeInOutCubic(progress: number) {
  const value = Math.max(0, Math.min(1, progress));
  return value < .5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function interpolateLook(
  from: FixtureLookValues,
  to: FixtureLookValues,
  progress: number
): FixtureLookValues {
  const eased = easeInOutCubic(progress);
  return {
    red: clampDmx(from.red + (to.red - from.red) * eased),
    green: clampDmx(from.green + (to.green - from.green) * eased),
    blue: clampDmx(from.blue + (to.blue - from.blue) * eased),
    uv: clampDmx(from.uv + (to.uv - from.uv) * eased),
    dimmer: clampDmx(from.dimmer + (to.dimmer - from.dimmer) * eased)
  };
}

export function isFixtureLook(value: unknown): value is FixtureLook {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FixtureLook>;
  const channels = candidate.values as Partial<FixtureLookValues> | undefined;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && Boolean(channels)
    && ['red', 'green', 'blue', 'uv', 'dimmer'].every((key) => {
      const channel = channels?.[key as keyof FixtureLookValues];
      return typeof channel === 'number' && Number.isFinite(channel);
    });
}
