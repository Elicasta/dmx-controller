import { renumberCues, type ShowFile, type ShowCue } from './show';
import type { ShowSection, ShowTimeline, TimelineClip } from './show-design';

export type SongMediaReference = {
  assetId?: string;
  name: string;
  kind: 'audio' | 'video';
  durationMs?: number;
  trimInMs?: number;
  trimOutMs?: number;
};

export type SongProgram = {
  id: string;
  name: string;
  savedAt: string;
  bpm: number;
  notes?: string;
  media?: SongMediaReference;
  sections: ShowSection[];
  cues: ShowCue[];
  timeline?: ShowTimeline;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function showSongNames(show: ShowFile): string[] {
  const names = new Set<string>();
  for (const section of show.creatorSections ?? []) {
    const name = section.song.trim();
    if (name) names.add(name);
  }
  for (const cue of show.cues) {
    const name = cue.trackName?.trim();
    if (name) names.add(name);
  }
  for (const timeline of show.timelineShows ?? []) {
    const name = timeline.name.trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function deriveSongProgram(
  show: ShowFile,
  songName: string,
  existingId?: string,
  media?: SongMediaReference
): SongProgram {
  const cleanName = songName.trim() || 'Untitled Song';
  const sections = (show.creatorSections ?? []).filter((section) => section.song === cleanName).map(clone);
  const sectionIds = new Set(sections.map((section) => section.id));
  const cues = show.cues
    .filter((cue) => cue.trackName === cleanName || Boolean(cue.sourceSectionId && sectionIds.has(cue.sourceSectionId)))
    .map(clone);
  const cueIds = new Set(cues.map((cue) => cue.id));
  const namedTimeline = show.timelineShows?.find((item) => item.name === cleanName)?.timeline;
  const sourceTimeline = namedTimeline ?? show.timeline;
  const timeline = sourceTimeline
    ? {
        ...clone(sourceTimeline),
        clips: sourceTimeline.clips.filter((clip) => cueIds.has(clip.cueId)).map(clone)
      }
    : undefined;
  // A shared service timeline cannot silently assign one song's media to every song.
  if (timeline && !namedTimeline && showSongNames(show).length > 1) {
    delete timeline.mediaAssetId;
    delete timeline.mediaKind;
    delete timeline.audioName;
    delete timeline.trimInMs;
    delete timeline.trimOutMs;
  }
  const bpm = timeline?.bpm ?? sections[0]?.bpm ?? 120;
  const timelineMedia: SongMediaReference | undefined = timeline?.mediaAssetId
    ? {
        assetId: timeline.mediaAssetId,
        name: timeline.audioName ?? cleanName,
        kind: timeline.mediaKind ?? 'audio',
        trimInMs: timeline.trimInMs,
        trimOutMs: timeline.trimOutMs
      }
    : undefined;

  return {
    id: existingId ?? `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    savedAt: new Date().toISOString(),
    bpm,
    media: media ? clone(media) : timelineMedia,
    sections,
    cues,
    timeline
  };
}

export function instantiateSongProgram(program: SongProgram): {
  sections: ShowSection[];
  cues: ShowCue[];
  timeline?: ShowTimeline;
} {
  const sectionIdMap = new Map<string, string>();
  const cueIdMap = new Map<string, string>();

  const sections = program.sections.map((section) => {
    const id = crypto.randomUUID();
    sectionIdMap.set(section.id, id);
    return {
      ...clone(section),
      id,
      song: program.name,
      layers: section.layers.map((layer) => ({ ...clone(layer), id: crypto.randomUUID() }))
    };
  });

  const cues = program.cues.map((cue) => {
    const id = crypto.randomUUID();
    cueIdMap.set(cue.id, id);
    return {
      ...clone(cue),
      id,
      trackName: program.name,
      sourceSectionId: cue.sourceSectionId ? sectionIdMap.get(cue.sourceSectionId) : undefined
    };
  });

  const timeline = program.timeline
    ? {
        ...clone(program.timeline),
        bpm: program.bpm,
        ...(program.media ? {
          mediaAssetId: program.media.assetId,
          audioName: program.media.name,
          mediaKind: program.media.kind,
          trimInMs: program.media.trimInMs,
          trimOutMs: program.media.trimOutMs
        } : {}),
        clips: program.timeline.clips
          .map((clip): TimelineClip | null => {
            const cueId = cueIdMap.get(clip.cueId);
            return cueId ? { ...clone(clip), id: crypto.randomUUID(), cueId } : null;
          })
          .filter((clip): clip is TimelineClip => Boolean(clip))
      }
    : undefined;

  return { sections, cues, timeline };
}

export function mergeSongProgramIntoShow(show: ShowFile, program: SongProgram): ShowFile {
  const instantiated = instantiateSongProgram(program);
  const existingSectionIds = new Set(
    (show.creatorSections ?? []).filter((section) => section.song === program.name).map((section) => section.id)
  );
  const existingCueIds = new Set(
    show.cues
      .filter((cue) => cue.trackName === program.name || Boolean(cue.sourceSectionId && existingSectionIds.has(cue.sourceSectionId)))
      .map((cue) => cue.id)
  );

  const creatorSections = [
    ...(show.creatorSections ?? []).filter((section) => section.song !== program.name),
    ...instantiated.sections
  ];
  const cues = [
    ...show.cues.filter((cue) => !existingCueIds.has(cue.id) && cue.trackName !== program.name),
    ...instantiated.cues
  ];

  const timelineShows = [
    ...(show.timelineShows ?? []).filter((item) => item.name !== program.name),
    ...(instantiated.timeline ? [{ id: crypto.randomUUID(), name: program.name, timeline: instantiated.timeline }] : [])
  ];

  return {
    ...show,
    creatorSections,
    cues: renumberCues(cues),
    timeline: show.timeline ? {
      ...show.timeline,
      clips: show.timeline.clips.filter((clip) => !existingCueIds.has(clip.cueId))
    } : undefined,
    timelineShows
  };
}

export function isSongProgram(value: unknown): value is SongProgram {
  if (!value || typeof value !== 'object') return false;
  const program = value as Partial<SongProgram>;
  return typeof program.id === 'string'
    && typeof program.name === 'string'
    && typeof program.savedAt === 'string'
    && typeof program.bpm === 'number'
    && Number.isFinite(program.bpm)
    && program.bpm >= 20
    && program.bpm <= 300
    && Array.isArray(program.sections)
    && Array.isArray(program.cues)
    && (program.timeline === undefined || (
      typeof program.timeline === 'object'
      && Array.isArray(program.timeline.clips)
    ));
}
