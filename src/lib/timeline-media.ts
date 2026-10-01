import type { ShowTimeline } from './show-design';
export type MediaWindow = { startMs: number; endMs: number; durationMs: number };
export function mediaWindow(timeline: ShowTimeline, durationMs: number): MediaWindow {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const startMs = Math.min(duration, Math.max(0, timeline.audioTrimInMs ?? 0));
  const endMs = Math.max(startMs, Math.min(duration, timeline.audioTrimOutMs ?? duration));
  return { startMs, endMs, durationMs: endMs - startMs };
}
export function mediaPosition(timelineMs: number, offsetMs: number, window: MediaWindow): number | null {
  const local = timelineMs - offsetMs;
  return local < 0 || local >= window.durationMs ? null : window.startMs + local;
}
export function steppedBar(bar: number, direction: number, beatsPerBar: number, wholeBar = false): number {
  const step = wholeBar ? 1 : 1 / Math.max(1, beatsPerBar);
  return Math.max(0, Math.round((bar + direction * step) * 1000000) / 1000000);
}
