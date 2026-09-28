import { clampDmx } from '../lib/dmx';

export type PlaybackLayerMode = 'ltp' | 'htp' | 'add' | 'multiply';

export type PlaybackLayer = {
  id: string;
  priority: number;
  mode: PlaybackLayerMode;
  values: ReadonlyMap<number, number>;
  enabled?: boolean;
};

export function resolvePlaybackStack(
  baseFrame: readonly number[],
  layers: readonly PlaybackLayer[],
  htpChannels: ReadonlySet<number> = new Set()
): number[] {
  const frame = Array.from({ length: 512 }, (_, index) => clampDmx(baseFrame[index] ?? 0));
  const sorted = [...layers]
    .filter((layer) => layer.enabled !== false)
    .sort((left, right) => left.priority - right.priority);

  for (const layer of sorted) {
    for (const [channel, raw] of layer.values) {
      if (channel < 1 || channel > 512) continue;
      const index = channel - 1;
      const value = clampDmx(raw);
      if (layer.mode === 'htp' || htpChannels.has(channel)) {
        frame[index] = Math.max(frame[index], value);
      } else if (layer.mode === 'add') {
        frame[index] = clampDmx(frame[index] + value);
      } else if (layer.mode === 'multiply') {
        frame[index] = clampDmx(frame[index] * (value / 255));
      } else {
        frame[index] = value;
      }
    }
  }
  return frame;
}
