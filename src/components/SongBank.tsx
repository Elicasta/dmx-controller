import { useState } from "react";
import type { ShowFile } from "../lib/show";
import { songsForShow, type SongRecord } from "../lib/song-bank";
import type { SongProgram } from '../lib/song-library';
type Props = {
  library: SongProgram[];
  ready: boolean;
  saveStatus: string;
  onSave: (song: SongRecord) => Promise<void>;
  onUse: (song: SongProgram) => void;
  show: ShowFile;
  activeId: string;
  onAdd: (name: string) => void;
  onSelect: (song: SongRecord, mode: "creator" | "timeline") => void;
  onRename: (id: string, name: string) => void;
  onMedia: (song: SongRecord, file: File) => Promise<void>;
  onAnalyzeTempo: (song: SongRecord) => Promise<void>;
  onApplyTempo: (song: SongRecord, bpm: number) => void;
  onOpenMediaLibrary: (song: SongRecord) => void;
  onExport: (song: SongRecord | SongProgram) => void;
  onImport: () => void;
};
export default function SongBank(p: Props) {
  const [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(""),
    [tempoBusy, setTempoBusy] = useState(""),
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
            its timeline. File imports are copied into managed desktop storage.
          </p>
        </div>
        <div><b>{songs.length} songs in this Show</b><p role="status">{p.saveStatus}</p><button type="button" onClick={p.onImport}>Import .lumarigsong</button></div>
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
          disabled={!p.ready || !name.trim() || songs.length >= 100}
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
            `${s.name} ${s.artist ?? ""} ${s.musicalKey ?? ""} ${s.arrangement?.join(' ') ?? ""} ${s.mediaName ?? ""}`
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
                    {song.bpm} BPM{song.musicalKey ? ` · ${song.musicalKey}` : ''}{song.artist ? ` · ${song.artist}` : ''} · {sections.length} sections · {cues.length}{" "}
                    cues
                  </small>
                  {song.arrangement?.length ? <span className="song-arrangement">{song.arrangement.join(' → ')}</span> : null}
                  <span>
                    {song.mediaName || "Drop audio or MP4 here, or link media"}
                  </span>
                  {song.tempoAnalysis ? <div className="song-tempo-analysis">
                    <span><b>{song.tempoAnalysis.bpm} BPM detected</b><small>{Math.round(song.tempoAnalysis.confidence*100)}% confidence · downbeat {(song.tempoAnalysis.downbeatMs/1000).toFixed(2)}s{song.tempoAnalysis.manualDownbeat ? ' · corrected' : ''}</small></span>
                    <div>
                      <button disabled={tempoBusy===song.id} onClick={()=>p.onApplyTempo(song,song.tempoAnalysis!.bpm)}>Use {song.tempoAnalysis.bpm}</button>
                      {song.tempoAnalysis.halfBpm && <button disabled={tempoBusy===song.id} onClick={()=>p.onApplyTempo(song,song.tempoAnalysis!.halfBpm!)}>½ · {song.tempoAnalysis.halfBpm}</button>}
                      {song.tempoAnalysis.doubleBpm && <button disabled={tempoBusy===song.id} onClick={()=>p.onApplyTempo(song,song.tempoAnalysis!.doubleBpm!)}>2× · {song.tempoAnalysis.doubleBpm}</button>}
                    </div>
                  </div> : null}
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
                  <button disabled={!song.mediaId || !!tempoBusy} onClick={()=>void (async()=>{
                    if(tempoBusy)return;setTempoBusy(song.id);setError('');
                    try{await p.onAnalyzeTempo(song)}catch(error){setError(error instanceof Error?error.message:String(error))}
                    finally{setTempoBusy('')}
                  })()}>{tempoBusy===song.id?'Analyzing…':song.tempoAnalysis?'Re-analyze Tempo':'Analyze Tempo'}</button>
                  <button onClick={() => p.onOpenMediaLibrary(song)}>Media Library</button>
                  <button onClick={() => p.onExport(song)}>Export Song</button>
                  <button disabled={!p.ready} onClick={() => void p.onSave(song)}>Save Song</button>
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
      <section className="reusable-song-library" aria-label="Song Library">
        <header><h3>Song Library</h3><p>Saved programming stays here when you create a new Show. Add an editable copy to any Show.</p></header>
        <div className="song-bank-list">
          {p.library.filter(item => item.show.name.toLowerCase().includes(query.toLowerCase())).map(item => (
            <article key={item.id}>
              <div><strong>{item.show.name}</strong><small>{item.show.songs?.[0]?.bpm} BPM{item.show.songs?.[0]?.musicalKey ? ` · ${item.show.songs[0].musicalKey}` : ''}{item.show.songs?.[0]?.artist ? ` · ${item.show.songs[0].artist}` : ''} · {item.show.creatorSections?.length ?? 0} sections · {item.show.cues.length} cues · R{item.revision}</small>{item.show.songs?.[0]?.arrangement?.length ? <span className="song-arrangement">{item.show.songs[0].arrangement!.join(' → ')}</span> : <span>{item.show.songs?.[0]?.mediaName ?? 'No linked media'}</span>}</div>
              <div className="song-bank-actions"><button onClick={() => p.onExport(item)}>Export Song</button><button disabled={!p.ready} onClick={() => p.onUse(item)}>Add to Show</button></div>
            </article>
          ))}
        </div>
        {p.ready && !p.library.length && <p>New songs and programming save here automatically.</p>}
      </section>
      {!songs.length && (
        <div className="song-bank-empty">
          <strong>Add your first song above.</strong>
          <p>
            Media stays linked when you switch songs or reopen LumaRig. Use Media Library to reference files in place, relink missing files, or build a portable backup.
          </p>
        </div>
      )}
    </div>
  );
}
