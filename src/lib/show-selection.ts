import type { ShowFile, ShowCue, FixtureGroup } from './show';
import { findMode, type PatchedFixture } from './fixtures';
import { fixturesInGroup } from '../core/console-domain';
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

/** Include actual patch targets so fixture inspectors cannot retain another cue's focus. */
export function cueTargetIds(show: ShowFile, cue: ShowCue, fixtures: readonly PatchedFixture[], groups: readonly FixtureGroup[]) {
  const valid=new Set(fixtures.map(item=>item.id));
  const section=show.creatorSections?.find(item=>item.id===cue.sourceSectionId);
  const group=groups.find(item=>item.id===section?.groupId);
  let targets=[...new Set((cue.effectStack ?? []).filter(layer=>layer.enabled !== false).flatMap(layer=>layer.targetIds))].filter(id=>valid.has(id));
  if (!targets.length && group) targets=fixturesInGroup(fixtures,group).map(item=>item.id);
  if (!targets.length) {
    const channels=new Set(cue.changes?.map(([channel])=>channel) ?? []);
    targets=fixtures.filter(fixture=>Array.from({length:findMode(fixture)?.channelCount ?? 1},(_,offset)=>fixture.address+offset).some(channel=>channels.has(channel))).map(item=>item.id);
  }
  if (!targets.length && cue.universe?.length===512) targets=fixtures.map(item=>item.id);
  return targets;
}
