import { renumberCues, type ShowFile } from "./show";
import { buildSectionCues, EMPTY_TIMELINE } from "./show-design";
import type { PatchedFixture } from "./fixtures";
import { nativeMediaLibraryAvailable, persistManagedMedia, readMediaAsset, readNativeMediaBlob } from "./media-library";

import type { SongRecord } from "./song-record";
export { isSongRecord, type SongRecord } from "./song-record";
/** Recover older drafts without replacing their cues or timeline edits. */
export function songsForShow(show: ShowFile): SongRecord[] {
  const songs = [...(show.songs ?? [])];
  const names = new Set(songs.map((s) => s.name));
  for (const name of new Set([
    ...(show.creatorSections ?? []).map((s) => s.song),
    ...show.cues.map((c) => c.trackName ?? "").filter(Boolean),
    ...(show.timelineShows ?? []).map((t) => t.name),
  ])) {
    if (names.has(name)) continue;
    const timeline = show.timelineShows?.find((t) => t.name === name)?.timeline;
    songs.push({
      id: `legacy:${name}`,
      name,
      bpm:
        timeline?.bpm ??
        show.creatorSections?.find((s) => s.song === name)?.bpm ??
        120,
      mediaName: timeline?.audioName,
    });
    names.add(name);
  }
  return songs;
}
export function renameSong(
  show: ShowFile,
  id: string,
  input: string,
): ShowFile {
  const songs = songsForShow(show),
    song = songs.find((s) => s.id === id),
    name = input.trim();
  if (!song || !name) throw Error("Enter a song name.");
  if (
    songs.some(
      (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw Error("That song name already exists.");
  return {
    ...show,
    songs: songs.map((s) => (s.id === id ? { ...s, name } : s)),
    creatorSections: show.creatorSections?.map((s) =>
      s.song === song.name ? { ...s, song: name } : s,
    ),
    cues: show.cues.map((c) =>
      c.trackName === song.name
        ? {
            ...c,
            trackName: name,
            name: c.name.startsWith(song.name + " · ")
              ? name + c.name.slice(song.name.length)
              : c.name,
          }
        : c,
    ),
    timelineShows: show.timelineShows?.map((t) =>
      t.name === song.name ? { ...t, name } : t,
    ),
  };
}
/** Build one song. Retain manually arranged clips; remove deleted generated sections. */
export function buildSong(
  show: ShowFile,
  song: SongRecord,
  fixtures: PatchedFixture[],
): ShowFile {
  const sections = (show.creatorSections ?? []).filter(
    (s) => s.song === song.name,
  );
  const generated = buildSectionCues(
    sections,
    fixtures,
    show.groups ?? [],
    show.cues,
  );
  const validSources = new Set(sections.map((s) => s.id));
  const removedIds = new Set(
    show.cues
      .filter(
        (c) =>
          c.trackName === song.name &&
          c.sourceSectionId &&
          !validSources.has(c.sourceSectionId),
      )
      .map((c) => c.id),
  );
  const rundown = show.rundownSections?.length
    ? show.rundownSections
    : [{ id: crypto.randomUUID(), name: "Songs" }];
  const updates = new Map(
    generated.map((c) => [
      c.id,
      {
        ...show.cues.find((old) => old.id === c.id),
        ...c,
        trackKind: "song" as const,
        rundownSectionId:
          show.cues.find((old) => old.id === c.id)?.rundownSectionId ??
          rundown[0].id,
      },
    ]),
  );
  const cues = renumberCues([
    ...show.cues
      .filter((c) => !removedIds.has(c.id))
      .map((c) => updates.get(c.id) ?? c),
    ...generated
      .filter((c) => !show.cues.some((old) => old.id === c.id))
      .map((c) => updates.get(c.id)!),
  ]);
  if (cues.length > 200) throw Error("This show is limited to 200 cues.");
  const saved = show.timelineShows?.find((t) => t.name === song.name);
  const ids = new Set(
    cues.filter((c) => c.trackName === song.name).map((c) => c.id),
  );
  const timeline = structuredClone(
    saved?.timeline ?? {
      ...(show.timeline ?? EMPTY_TIMELINE),
      clips: (show.timeline?.clips ?? []).filter((c) => ids.has(c.cueId)),
    },
  );
  timeline.bpm = song.bpm;
  timeline.audioName = song.mediaName ?? timeline.audioName;
  timeline.clips = timeline.clips.filter((c) => !removedIds.has(c.cueId));
  let cursor = Math.max(
    0,
    ...timeline.clips.map((c) => c.startBar + c.lengthBars),
  );
  generated.forEach((cue, index) => {
    if (!timeline.clips.some((c) => c.cueId === cue.id)) {
      timeline.clips.push({
        id: crypto.randomUUID(),
        cueId: cue.id,
        startBar: cursor,
        lengthBars: sections[index].bars,
        lane: 0,
        enabled: true,
      });
      cursor += sections[index].bars;
    }
  });
  const timelineShow = {
    id: saved?.id ?? crypto.randomUUID(),
    name: song.name,
    timeline,
  };
  const timelineShows = [
    ...(show.timelineShows ?? []).filter((t) => t.id !== saved?.id),
    timelineShow,
  ];
  if (timelineShows.length > 100)
    throw Error("This show is limited to 100 song timelines.");
  return {
    ...show,
    songs: songsForShow(show),
    cues,
    rundownSections: rundown,
    timelineShows,
    timeline: show.timeline
      ? {
          ...show.timeline,
          clips: show.timeline.clips.filter((c) => !removedIds.has(c.cueId)),
        }
      : undefined,
  };
}

function mediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lumarig-song-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? Error("Media storage unavailable."));
    request.onblocked = () =>
      reject(Error("Close other LumaRig windows and retry."));
  });
}
export async function storeSongMedia(id: string, file: File): Promise<void> {
  if (nativeMediaLibraryAvailable()) {
    await persistManagedMedia(id, file, file.name);
    void import('./media-waveform').then(({ waveformForBlob }) => waveformForBlob(file)).catch(() => {});
    return;
  }
  const db = await mediaDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          tx.error ?? Error("Could not save media. Free disk space and retry."),
        );
    });
    // Analysis runs after the durable media write; unsupported codecs still import and play.
    void import('./media-waveform').then(({ waveformForBlob }) => waveformForBlob(file)).catch(() => {});
  } finally {
    db.close();
  }
}
export async function readSongMedia(id: string): Promise<Blob | undefined> {
  if (nativeMediaLibraryAvailable()) {
    const asset = await readMediaAsset(id);
    if (asset) {
      if (asset.missing) return undefined;
      return readNativeMediaBlob(id);
    }
  }
  const db = await mediaDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
