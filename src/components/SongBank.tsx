import { useState } from "react";
import type { ShowFile } from "../lib/show";
import { songsForShow, type SongRecord } from "../lib/song-bank";
type Props = {
  show: ShowFile;
  activeId: string;
  onAdd: (name: string) => void;
  onSelect: (song: SongRecord, mode: "creator" | "timeline") => void;
  onRename: (id: string, name: string) => void;
  onMedia: (song: SongRecord, file: File) => Promise<void>;
};
export default function SongBank(p: Props) {
  const [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const songs = songsForShow(p.show);
  async function attach(song: SongRecord, file?: File) {
    if (!file || busy) return;
    setBusy(song.id);
    setError("");
    try {
      await p.onMedia(song, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="song-bank">
      <header>
        <div>
          <span>SONG BANK</span>
          <h2>Your songs, ready for the show.</h2>
          <p>
            Add a song, link its audio or MP4, then build sections and arrange
            its timeline.
          </p>
        </div>
        <b>{songs.length} songs</b>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            p.onAdd(name.trim());
            setName("");
          }
        }}
      >
        <input
          aria-label="New song name"
          placeholder="Song name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={180}
        />
        <button
          className="console-primary"
          disabled={!name.trim() || songs.length >= 100}
        >
          Add song
        </button>
        <input
          aria-label="Search song bank"
          placeholder="Search songs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="song-bank-list">
        {songs
          .filter((s) =>
            `${s.name} ${s.mediaName ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((song) => {
            const sections =
              p.show.creatorSections?.filter((s) => s.song === song.name) ?? [];
            const cues = p.show.cues.filter((c) => c.trackName === song.name);
            return (
              <article
                key={song.id}
                className={p.activeId === song.id ? "active" : ""}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void attach(song, e.dataTransfer.files[0]);
                }}
              >
                <div>
                  <input
                    aria-label={`Song name ${song.name}`}
                    defaultValue={song.name}
                    key={song.name}
                    onBlur={(e) => p.onRename(song.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <small>
                    {song.bpm} BPM · {sections.length} sections · {cues.length}{" "}
                    cues
                  </small>
                  <span>
                    {song.mediaName || "Drop audio or MP4 here, or link media"}
                  </span>
                </div>
                <div className="song-bank-actions">
                  <label className="file-button">
                    {busy === song.id
                      ? "Saving…"
                      : song.mediaId
                        ? "Replace media"
                        : "Link media"}
                    <input
                      aria-label={`Link media for ${song.name}`}
                      type="file"
                      accept="audio/*,video/mp4,.mp4,.wav,.mp3,.m4a,.aiff,.flac"
                      disabled={!!busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        void attach(song, file);
                      }}
                    />
                  </label>
                  <button onClick={() => p.onSelect(song, "creator")}>
                    Build song
                  </button>
                  <button onClick={() => p.onSelect(song, "timeline")}>
                    Timeline
                  </button>
                </div>
              </article>
            );
          })}
      </div>
      {!songs.length && (
        <div className="song-bank-empty">
          <strong>Add your first song above.</strong>
          <p>
            Media stays linked when you switch songs or reopen LumaRig on this
            computer.
          </p>
        </div>
      )}
    </div>
  );
}
