import { songsForShow } from './song-bank';
import { isShowFile, renumberCues, resolveShowCueFrame, type ShowFile } from './show';
import { EMPTY_TIMELINE, isShowTimeline } from './show-design';
import type { SongRecord } from './song-record';

/** The editable library master. Shows retain independent copies linked by libraryId. */
export type SongProgram = {
  id: string;
  savedAt: string;
  revision: number;
  show: ShowFile;
};
export function programId(show: ShowFile, song: SongRecord): string {
  return song.libraryId ?? (song.id.startsWith('legacy:') ? `${show.name}:${song.id}` : song.id);
}
export function extractSongProgram(show: ShowFile, song: SongRecord): ShowFile {
  const id = programId(show, song);
  const cues = show.cues.flatMap((cue, index) => cue.trackName === song.name
    ? [{ ...cue, universe: resolveShowCueFrame(show.cues, index), changes: undefined }] : []);
  const ids = new Set(cues.map(c => c.id));
  const timeline = structuredClone(show.timelineShows?.find(t => t.name === song.name)?.timeline ?? show.timeline ?? EMPTY_TIMELINE);
  timeline.clips = timeline.clips.filter(c => ids.has(c.cueId));
  timeline.bpm = song.bpm;
  timeline.audioName = song.mediaName ?? timeline.audioName;
  return structuredClone({
    version: 4, name: song.name, songs: [{ ...song, libraryId: id }],
    creatorSections: (show.creatorSections ?? []).filter(s => s.song === song.name),
    cues: renumberCues(cues), timeline,
    groups: show.groups ?? [], positionPalettes: show.positionPalettes ?? [],
  });
}
export function isSongProgram(value: unknown): value is SongProgram {
  if (!value || typeof value !== 'object') return false;
  const p = value as SongProgram;
  return typeof p.id === 'string' && !!p.id && typeof p.savedAt === 'string'
    && Number.isInteger(p.revision) && p.revision > 0 && isShowFile(p.show)
    && p.show.songs?.length === 1 && isShowTimeline(p.show.timeline)
    && new Set(p.show.cues.map(c => c.id)).size === p.show.cues.length
    && p.show.timeline.clips.every(clip => p.show.cues.some(cue => cue.id === clip.cueId));
}
/** Remap all editable IDs; never overwrite a show's existing cues or groups. */
export function insertSongProgram(show: ShowFile, program: SongProgram): { show: ShowFile; song: SongRecord } {
  if (!isSongProgram(program)) throw Error('This saved song is invalid.');
  if (songsForShow(show).length >= 100 || (show.timelineShows?.length ?? 0) >= 100)
    throw Error('This show is limited to 100 songs.');
  const source = structuredClone(program.show);
  if (show.cues.length + source.cues.length > 200) throw Error('This show is limited to 200 cues.');
  if ((show.creatorSections?.length ?? 0) + (source.creatorSections?.length ?? 0) > 200)
    throw Error('This show is limited to 200 sections.');
  const original = source.songs![0];
  const names = new Set(songsForShow(show).map(s => s.name.toLowerCase()));
  let name = original.name, suffix = 2;
  while (names.has(name.toLowerCase())) name = `${original.name} (${suffix++})`;
  const song: SongRecord = { ...original, id: crypto.randomUUID(), libraryId: program.id, name };
  const groupIds = new Map((source.groups ?? []).map(g => [g.id, crypto.randomUUID()]));
  const sectionIds = new Map((source.creatorSections ?? []).map(s => [s.id, crypto.randomUUID()]));
  const cueIds = new Map(source.cues.map(c => [c.id, crypto.randomUUID()]));
  const group = (id: string) => groupIds.get(id) ?? id;
  const rundown = { id: crypto.randomUUID(), name: song.name };
  const sections = (source.creatorSections ?? []).map(s => ({ ...s, id: sectionIds.get(s.id)!, song: name,
    groupId: group(s.groupId), layers: s.layers.map(l => ({ ...l, id: crypto.randomUUID(), groupId: group(l.groupId) })) }));
  const cues = source.cues.map(c => ({ ...c, id: cueIds.get(c.id)!, trackName: name, rundownSectionId: rundown.id,
    name: c.name.startsWith(original.name + ' · ') ? name + c.name.slice(original.name.length) : c.name,
    sourceSectionId: c.sourceSectionId ? sectionIds.get(c.sourceSectionId) : undefined,
    effectStack: c.effectStack?.map(l => ({ ...l, id: crypto.randomUUID() })),
  }));
  const timeline = { ...source.timeline!, clips: (source.timeline?.clips ?? []).map(c => ({ ...c, id: crypto.randomUUID(), cueId: cueIds.get(c.cueId)! })) };
  const next: ShowFile = { ...show, songs: [...songsForShow(show), song],
    groups: [...(show.groups ?? []), ...(source.groups ?? []).map(g => ({ ...g, id: group(g.id) }))],
    positionPalettes: [...(show.positionPalettes ?? []), ...(source.positionPalettes ?? []).filter(p => !(show.positionPalettes ?? []).some(old => old.id === p.id))],
    creatorSections: [...(show.creatorSections ?? []), ...sections], cues: renumberCues([...show.cues, ...cues]),
    rundownSections: [...(show.rundownSections ?? []), rundown],
    timelineShows: [...(show.timelineShows ?? []), { id: song.id, name, timeline }],
  };
  if (!isShowFile(next)) throw Error('This song exceeds the show limits or contains invalid programming.');
  return { show: next, song };
}
