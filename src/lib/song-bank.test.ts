import { describe, expect, it } from "vitest";
import { EMPTY_SHOW, isShowFile, sanitizeShow } from "./show";
import { DEFAULT_PATCH } from "./fixtures";
import { createSection, EMPTY_TIMELINE } from "./show-design";
import {
  buildSong,
  renameSong,
  songsForShow,
  type SongRecord,
} from "./song-bank";
const song: SongRecord = {
  id: "s1",
  name: "First Song",
  bpm: 128,
  mediaId: "audio1",
  mediaName: "first.wav",
};
const other: SongRecord = { id: "s2", name: "Second Song", bpm: 90 };
const base = () => ({
  ...structuredClone(EMPTY_SHOW),
  songs: [song, other],
  creatorSections: [
    createSection("Verse", song.name, "", 128),
    createSection("Chorus", song.name, "", 128),
    createSection("Intro", other.name, "", 90),
  ],
});
describe("song bank lifecycle", () => {
  it("migrates existing names without dropping cues or timelines", () => {
    const show = base();
    delete (show as { songs?: SongRecord[] }).songs;
    expect(songsForShow(show).map((s) => s.name)).toEqual([
      song.name,
      other.name,
    ]);
  });
  it("preserves song IDs and media links through save and validation", () => {
    const show = sanitizeShow(base());
    expect(isShowFile(show)).toBe(true);
    expect(show.songs).toEqual([song, other]);
    expect(
      isShowFile({ ...show, songs: [song, { ...other, id: song.id }] }),
    ).toBe(false);
    expect(isShowFile({ ...show, songs: [{ ...song, bpm: NaN }] })).toBe(false);
  });
  it("builds separate timelines, rebuilds idempotently and preserves manual arrangement", () => {
    let show = buildSong(
      buildSong(base(), song, DEFAULT_PATCH),
      other,
      DEFAULT_PATCH,
    );
    expect(show.cues).toHaveLength(3);
    expect(show.timelineShows).toHaveLength(2);
    expect(show.timelineShows![0].timeline.clips).toHaveLength(2);
    const timeline = show.timelineShows!.find((t) => t.name === song.name)!;
    timeline.timeline.clips[0].startBar = 12;
    timeline.timeline.clips[0].lengthBars = 3;
    timeline.timeline.audioOffsetBars = 2;
    const untouched = structuredClone(
      show.timelineShows!.find((t) => t.name === other.name),
    );
    const ids = show.cues.map((c) => c.id);
    show = buildSong(show, song, DEFAULT_PATCH);
    expect(show.cues.map((c) => c.id)).toEqual(ids);
    expect(
      show.timelineShows!.find((t) => t.name === song.name)!.timeline,
    ).toMatchObject({
      audioName: "first.wav",
      audioOffsetBars: 2,
      clips: [
        expect.objectContaining({ startBar: 12, lengthBars: 3 }),
        expect.anything(),
      ],
    });
    expect(show.timelineShows!.find((t) => t.name === other.name)).toEqual(
      untouched,
    );
  });
  it("removes deleted generated cues and their clips, retaining the other song", () => {
    let show = buildSong(
      buildSong(base(), song, DEFAULT_PATCH),
      other,
      DEFAULT_PATCH,
    );
    const removed = show.creatorSections![0].id;
    const cueId = show.cues.find((c) => c.sourceSectionId === removed)!.id;
    show.creatorSections = show.creatorSections!.filter(
      (s) => s.id !== removed,
    );
    show.timeline = {
      ...EMPTY_TIMELINE,
      clips: [
        {
          id: "legacy",
          cueId,
          startBar: 0,
          lengthBars: 8,
          lane: 0,
          enabled: true,
        },
      ],
    };
    show = buildSong(show, song, DEFAULT_PATCH);
    expect(show.cues).toHaveLength(2);
    expect(show.cues.some((c) => c.id === cueId)).toBe(false);
    expect(show.timeline!.clips).toHaveLength(0);
    expect(
      show.timelineShows!.find((t) => t.name === song.name)!.timeline.clips,
    ).toHaveLength(1);
  });
  it("renames all song references and keeps linked media", () => {
    const show = renameSong(
      buildSong(base(), song, DEFAULT_PATCH),
      song.id,
      "Renamed",
    );
    expect(show.songs![0]).toMatchObject({
      id: song.id,
      name: "Renamed",
      mediaId: "audio1",
    });
    expect(show.cues.every((c) => c.trackName === "Renamed")).toBe(true);
    expect(
      show.creatorSections!.filter((s) => s.song === "Renamed"),
    ).toHaveLength(2);
    expect(show.timelineShows![0].name).toBe("Renamed");
    expect(() => renameSong(show, song.id, other.name)).toThrow(
      "already exists",
    );
  });
});
