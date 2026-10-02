import type { ShowFile } from './show';
import type { ShowTimeline } from './show-design';

/** Resolve cue navigation once for every editor, including repeated cue instances. */
export function cueContext(show: ShowFile, cueId: string, currentTimelineId = '', preferredClipId?: string) {
  const cue = show.cues.find(item => item.id === cueId);
  const timelines: { id: string; name?: string; timeline?: ShowTimeline }[] = [
    ...(show.timelineShows ?? []), { id: '', timeline: show.timeline },
  ];
  const matching = timelines.filter(item => item.timeline?.clips.some(clip => clip.cueId === cueId));
  const owner = matching.find(item => item.timeline?.clips.some(clip => clip.id === preferredClipId && clip.cueId === cueId))
    ?? matching.find(item => item.id === currentTimelineId)
    ?? matching.find(item => item.name === cue?.trackName)
    ?? matching[0]
    ?? timelines.find(item => item.name === cue?.trackName);
  const clips = owner?.timeline?.clips.filter(clip => clip.cueId === cueId) ?? [];
  const clip = clips.find(item => item.id === preferredClipId) ?? [...clips].sort((a,b) => a.startBar-b.startBar)[0];
  return { timelineId: owner?.id ?? '', timeline: owner?.timeline, clipId: clip?.id ?? '', bar: clip?.startBar ?? 0 };
}
