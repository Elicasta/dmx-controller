import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import type { ShowCue } from "../lib/show";
import { beatSnapStep, estimateTempoFromSamples, type TempoEstimate } from "../core/audio-tempo";
import {
  FX_RECIPES,
  barMs,
  snapBar,
  type ShowTimeline,
  type TimelineClip,
} from "../lib/show-design";
type Props = {
  onAddFx?: (recipeId:string,startBar:number,lane:number)=>void;
  fxTargetName?: string;
  initialBar?: number;
  songFilter?: string;
  timeline: ShowTimeline;
  cues: ShowCue[];
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string;
  audioName: string;
  audioDurationMs: number;
  onLoadAudio: (file: File) => void;
  onChange: (timeline: ShowTimeline) => void;
  onFrame: (elapsedMs: number) => void;
  onStop: () => void;
  onCreator: () => void;
};
type Drag = {
  kind: "move" | "resize" | "audio";
  id: string;
  x: number;
  start: number;
  length: number;
  lane: number;
  nextLane: number;
  before: ShowTimeline;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
export default function ShowTimelineEditor(props: Props) {
  const {
    timeline,
    cues,
    audioRef,
    audioUrl,
    audioName,
    audioDurationMs,
    onChange,
    onLoadAudio,
    onCreator,
  } = props;
  const audioStarting = useRef(false);
  const [libraryMode,setLibraryMode]=useState<"cues"|"fx">("cues");
  const [selectedId, setSelectedId] = useState("");
  const [cursor, setCursor] = useState(props.initialBar ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(36);
  const [snapMode, setSnapMode] = useState<"bar"|"beat"|"half-beat"|"quarter-beat"|"free">("bar");
  const [lanes, setLanes] = useState(3);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [tempoEstimate, setTempoEstimate] = useState<TempoEstimate | null>(null);
  const [audioError, setAudioError] = useState("");
  const undo = useRef<ShowTimeline[]>([]),
    redo = useRef<ShowTimeline[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const latest = useRef(props);
  latest.current = props;
  const cursorRef = useRef(props.initialBar ?? 0),
    playingRef = useRef(false),
    raf = useRef<number | null>(null),
    drag = useRef<Drag | null>(null);
  const msPerBar = barMs(timeline);
  const snap = beatSnapStep(timeline.beatsPerBar, snapMode);
  const beatWidth = zoom / Math.max(1, timeline.beatsPerBar);
  const cursorBar = Math.floor(Math.max(0, cursor));
  const cursorBeat = Math.min(timeline.beatsPerBar, Math.floor((Math.max(0, cursor) - cursorBar) * timeline.beatsPerBar) + 1);
  const clipEnd = Math.max(
    0,
    ...timeline.clips.map((c) => c.startBar + c.lengthBars),
  );
  const audioEnd = timeline.audioOffsetBars + audioDurationMs / msPerBar;
  const endBar = Math.max(16, clipEnd, audioEnd);
  const totalBars = Math.max(32, Math.ceil(endBar + 8));
  const laneCount = Math.max(lanes, ...timeline.clips.map((c) => c.lane + 1));
  const selected = timeline.clips.find((c) => c.id === selectedId);
  function checkpoint(before = latest.current.timeline) {
    undo.current = [...undo.current, structuredClone(before)].slice(-40);
    redo.current = [];
    setHistoryVersion((v) => v + 1);
  }
  function edit(next: ShowTimeline) {
    checkpoint();
    onChange(next);
  }
  function changeClip(
    id: string,
    changes: Partial<TimelineClip>,
    record = true,
  ) {
    const current = latest.current.timeline;
    const next = {
      ...current,
      clips: current.clips.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    };
    if (record) edit(next);
    else onChange(next);
  }
  function history(direction: "undo" | "redo") {
    const from = direction === "undo" ? undo : redo,
      to = direction === "undo" ? redo : undo;
    const value = from.current.pop();
    if (!value) return;
    to.current.push(structuredClone(latest.current.timeline));
    onChange(value);
    setHistoryVersion((v) => v + 1);
  }
  function addClip(cueId: string, startBar = clipEnd, lane = 0) {
    if (timeline.clips.length >= 1000) return;
    const clip = {
      id: crypto.randomUUID(),
      cueId,
      startBar: snapBar(startBar, snap),
      lengthBars: 8,
      lane,
      enabled: true,
    };
    edit({ ...timeline, clips: [...timeline.clips, clip] });
    setSelectedId(clip.id);
  }
  function syncAudio(positionMs: number, force = false) {
    const p = latest.current,
      audio = p.audioRef.current;
    if (!audio || !p.audioUrl) return;
    const local = positionMs - p.timeline.audioOffsetBars * barMs(p.timeline);
    if (local < 0 || local >= audio.duration * 1000) {
      audio.pause();
      if (local < 0 && audio.currentTime !== 0) audio.currentTime = 0;
      return;
    }
    if (force)
      audio.currentTime = Math.max(0, local / 1000);
    if (playingRef.current && audio.paused && !audioStarting.current) {
      audioStarting.current = true;
      void audio.play().then(()=>{if(!playingRef.current)audio.pause();}).catch(() => {
        setAudioError(
          "Audio could not play. Relink the track or press Play again.",
        );
        pause();
      }).finally(() => { audioStarting.current = false; });
    }
  }
  function pause() {
    playingRef.current = false;
    setPlaying(false);
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioRef.current?.pause();
  }
  function stop() {
    pause();
    cursorRef.current = 0;
    setCursor(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
    latest.current.onStop();
  }
  function seek(bar: number) {
    const next = Math.max(0, bar);
    cursorRef.current = next;
    setCursor(next);
    latest.current.onFrame(next * barMs(latest.current.timeline));
    syncAudio(next * barMs(latest.current.timeline), true);
  }
  function play() {
    if (playingRef.current) {
      pause();
      return;
    }
    setAudioError("");
    playingRef.current = true;
    setPlaying(true);
    let previous = performance.now(),
      lastPaint = previous - 40;
    syncAudio(cursorRef.current * barMs(latest.current.timeline), true);
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const p = latest.current;
      const audio = p.audioRef.current;
      const offset = p.timeline.audioOffsetBars;
      // Media owns the clock during audio playback, including buffering.
      // Repeated currentTime corrections cause audible seek artifacts.
      if (p.audioUrl && audio && cursorRef.current >= offset && !audio.ended &&
          (!Number.isFinite(audio.duration) || audio.currentTime < audio.duration)) {
        syncAudio(cursorRef.current * barMs(p.timeline));
        cursorRef.current = offset + audio.currentTime * 1000 / barMs(p.timeline);
      } else {
        cursorRef.current += (now - previous) / barMs(p.timeline);
      }
      previous = now;
      if (now - lastPaint >= 25) {
        setCursor(cursorRef.current);
        p.onFrame(cursorRef.current * barMs(p.timeline));
        syncAudio(cursorRef.current * barMs(p.timeline));
        lastPaint = now;
      }
      const end = Math.max(
        1,
        ...p.timeline.clips.map((c) => c.startBar + c.lengthBars),
        p.timeline.audioOffsetBars + p.audioDurationMs / barMs(p.timeline),
      );
      if (cursorRef.current >= end) {
        pause();
        p.onStop();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }
  useEffect(() => {
    const stopTransport=()=>{playingRef.current=false;setPlaying(false);if(raf.current!==null)cancelAnimationFrame(raf.current);raf.current=null;latest.current.audioRef.current?.pause();latest.current.onStop();};
    window.addEventListener('lumarig-stop-timeline',stopTransport);
    return ()=>window.removeEventListener('lumarig-stop-timeline',stopTransport);
  },[]);
  useEffect(
    () => () => {
      playingRef.current = false;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      latest.current.audioRef.current?.pause();
      latest.current.onStop();
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    setPeaks([]);
    setTempoEstimate(null);
    if (!audioUrl) return;
    const context = new AudioContext();
    void fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((b) => context.decodeAudioData(b))
      .then((buffer) => {
        if (cancelled) return;
        const samples = buffer.getChannelData(0),
          stride = Math.max(1, Math.floor(samples.length / 320));
        const next = Array.from({ length: 320 }, (_, i) => {
          let peak = 0;
          for (
            let j = i * stride;
            j < Math.min(samples.length, (i + 1) * stride);
            j += Math.max(1, Math.floor(stride / 80))
          )
            peak = Math.max(peak, Math.abs(samples[j]));
          return peak;
        });
        setPeaks(next);
        setTempoEstimate(estimateTempoFromSamples(samples, buffer.sampleRate));
      })
      .catch(() => {
        if (!cancelled)
          setAudioError(
            "Waveform unavailable. The track can still play if your system supports it.",
          );
      })
      .finally(() => void context.close());
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);
  function begin(
    e: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    kind: "move" | "resize",
  ) {
    e.preventDefault();
    e.stopPropagation();
    pause();
    setSelectedId(clip.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      id: clip.id,
      x: e.clientX,
      start: clip.startBar,
      length: clip.lengthBars,
      lane: clip.lane,
      nextLane: clip.lane,
      before: structuredClone(timeline),
    };
  }
  function movePointer(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.x) / zoom;
    if (d.kind === "audio") {
      onChange({
        ...latest.current.timeline,
        audioOffsetBars: snapBar(d.start + delta, snap),
      });
      return;
    }
    if (d.kind === "resize")
      changeClip(
        d.id,
        { lengthBars: clamp(snapBar(d.length + delta, snap), 0.25, 100000) },
        false,
      );
    else {
      changeClip(
        d.id,
        { startBar: clamp(snapBar(d.start + delta, snap), 0, 100000) },
        false,
      );
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-lane]");
      if (target) d.nextLane = Number(target.dataset.lane);
    }
  }
  function endPointer(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.kind === "move" && d.nextLane !== d.lane)
      changeClip(d.id, { lane: d.nextLane }, false);
    checkpoint(d.before);
  }
  function dropCue(e: import("react").DragEvent<HTMLElement>, lane: number) {
    e.preventDefault();
    const recipeId=e.dataTransfer.getData("application/lumarig-fx");
    if(FX_RECIPES.some(r=>r.id===recipeId)){
      checkpoint();
      props.onAddFx?.(recipeId,snapBar((e.clientX-e.currentTarget.getBoundingClientRect().left)/zoom,snap),lane);return;
    }
    const cueId = e.dataTransfer.getData("application/lumarig-cue");
    if (!cues.some((c) => c.id === cueId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    addClip(cueId, (e.clientX - rect.left) / zoom, lane);
  }
  const wavePath = peaks
    .map((p, i) => `M ${i} ${24 - p * 22} L ${i} ${24 + p * 22}`)
    .join(" ");

  function applyTempoEstimate(alignBeatGrid: boolean) {
    if (!tempoEstimate) return;
    const nextBpm = tempoEstimate.bpm;
    const nextBarMs = (60000 / nextBpm) * timeline.beatsPerBar;
    let audioOffsetBars = timeline.audioOffsetBars;
    if (alignBeatGrid && audioUrl) {
      const beatMs = 60000 / nextBpm;
      const currentStartMs = timeline.audioOffsetBars * nextBarMs;
      const absoluteDetectedBeat = currentStartMs + tempoEstimate.firstBeatMs;
      const alignedBeatMs = Math.max(0, Math.round(absoluteDetectedBeat / beatMs) * beatMs);
      let nextStartMs = alignedBeatMs - tempoEstimate.firstBeatMs;
      while (nextStartMs < 0) nextStartMs += beatMs;
      audioOffsetBars = nextStartMs / nextBarMs;
    }
    edit({ ...timeline, bpm: nextBpm, audioOffsetBars });
  }
  return (
    <div className="show-bar-timeline" data-history={historyVersion}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.preventDefault();
        if (file.type.startsWith("audio/") || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac)$/i.test(file.name)) {
          pause(); onLoadAudio(file);
        } else setAudioError("Choose an audio file: WAV, MP3, M4A, AIFF, OGG or FLAC.");
      }}>
      <header className="creator-command">
        <div>
          <span>BAR TIMELINE</span>
          <h2>Arrange your show.</h2>
          <p>
            Drag cues into lanes. Stack lanes for color, motion and rhythm.
            Resize the right edge.
          </p>
        </div>
        <div className="creator-actions">
          <button onClick={onCreator}>Show Creator ↗</button>
          <button
            aria-label="Undo timeline edit"
            disabled={!undo.current.length || playing}
            onClick={() => history("undo")}
          >
            Undo
          </button>
          <button
            aria-label="Redo timeline edit"
            disabled={!redo.current.length || playing}
            onClick={() => history("redo")}
          >
            Redo
          </button>
        </div>
      </header>
      <div className="timeline-toolbar">
        <button
          className="console-primary"
          disabled={!timeline.clips.length && !audioUrl}
          onClick={play}
        >
          {playing ? "Pause" : "Play Show"}
        </button>
        <button onClick={stop}>Stop / Rewind</button>
        <output>BAR {cursorBar + 1} · BEAT {cursorBeat}</output>
        <label>
          BPM
          <input
            aria-label="Timeline BPM"
            type="number"
            min={20}
            max={300}
            value={timeline.bpm}
            disabled={playing}
            onChange={(e) =>
              edit({ ...timeline, bpm: clamp(Number(e.target.value), 20, 300) })
            }
          />
        </label>
        <label>
          Beats / bar
          <input
            aria-label="Beats per bar"
            type="number"
            min={1}
            max={12}
            value={timeline.beatsPerBar}
            disabled={playing}
            onChange={(e) =>
              edit({
                ...timeline,
                beatsPerBar: Math.round(clamp(Number(e.target.value), 1, 12)),
              })
            }
          />
        </label>
        <label>
          Snap
          <select
            value={snapMode}
            onChange={(e) => setSnapMode(e.target.value as "bar"|"beat"|"half-beat"|"quarter-beat"|"free")}
          >
            <option value="bar">1 Bar</option>
            <option value="beat">1 Beat</option>
            <option value="half-beat">1/2 Beat</option>
            <option value="quarter-beat">1/4 Beat</option>
            <option value="free">Fine</option>
          </select>
        </label>
        <label>
          Zoom
          <input
            aria-label="Timeline zoom"
            type="range"
            min={18}
            max={100}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="file-button">
          {audioUrl ? "Relink Audio" : "Load Audio"}
          <input
            aria-label="Load timeline audio"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                pause();
                onLoadAudio(f);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {tempoEstimate && <section className="timeline-tempo-analysis">
        <div>
          <span>AUDIO ANALYSIS</span>
          <strong>≈ {tempoEstimate.bpm} BPM</strong>
          <small>{Math.round(tempoEstimate.confidence * 100)}% confidence · detected beat phase {Math.round(tempoEstimate.firstBeatMs)} ms</small>
        </div>
        <div>
          <button disabled={playing} onClick={() => applyTempoEstimate(false)}>Use BPM</button>
          <button className="console-primary" disabled={playing} onClick={() => applyTempoEstimate(true)}>Use BPM + Align Beats</button>
        </div>
      </section>}
      <div className="timeline-edit-layout">
        <aside className="timeline-cue-library">
          <div className="timeline-library-tabs"><button aria-label="Cue library" aria-pressed={libraryMode==="cues"} onClick={()=>setLibraryMode("cues")}>Cues</button><button aria-pressed={libraryMode==="fx"} onClick={()=>setLibraryMode("fx")}>FX recipes</button></div>
          <header>
            SHOW CUES <small>{cues.length}</small>
          </header>
          <p>Drag to a lane or click to append.</p>
          {libraryMode==="fx" ? <><p>Target: {props.fxTargetName??"current group"}. Drag a recipe to a lane.</p>{FX_RECIPES.map(recipe=><button className="timeline-fx-recipe" key={recipe.id} draggable onDragStart={e=>{e.dataTransfer.setData("application/lumarig-fx",recipe.id);e.dataTransfer.effectAllowed="copy";}} onClick={()=>{checkpoint();props.onAddFx?.(recipe.id,clipEnd,0);}}><span>{recipe.name}<small>{recipe.category}</small></span></button>)}</> : cues.length ? (
            cues.filter(c=>!props.songFilter||(c.trackName?.trim()||"Unfiled cues")===props.songFilter).map((c) => (
              <button
                key={c.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/lumarig-cue", c.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addClip(c.id)}
                style={
                  {
                    "--section-color": c.color ?? "#55e98d",
                  } as import("react").CSSProperties
                }
              >
                <b>{c.number}</b>
                <span>
                  {c.name}
                  <small>{c.effectStack?.length ?? 0} FX layers</small>
                </span>
              </button>
            ))
          ) : (
            <button onClick={onCreator}>Build your first song ↗</button>
          )}
        </aside>
        <main className="timeline-arranger">
          <div className="timeline-scroll">
            <div
              className="timeline-sheet"
              style={{ width: totalBars * zoom + 100 }}
            >
              <div className="timeline-ruler-row">
                <div className="lane-label">BARS · {timeline.beatsPerBar}/4</div>
                <div
                  className="bar-ruler"
                  style={{
                    width: totalBars * zoom,
                    "--bar-width": `${zoom}px`,
                    "--beat-width": `${beatWidth}px`,
                  } as import("react").CSSProperties}
                  onClick={(e) => {
                    pause();
                    seek(
                      snapBar(
                        (e.clientX -
                          e.currentTarget.getBoundingClientRect().left) /
                          zoom,
                        snap,
                      ),
                    );
                  }}
                >
                  {Array.from({ length: totalBars }, (_, i) => (
                    <span key={i} style={{ left: i * zoom, width: zoom }}>
                      {zoom >= 30 || i % 4 === 0 ? i + 1 : ""}
                    </span>
                  ))}
                </div>
              </div>
              <div className="timeline-lane-row audio-row">
                <div className="lane-label">AUDIO</div>
                <div
                  className="timeline-lane"
                  style={
                    {
                      width: totalBars * zoom,
                      "--bar-width": `${zoom}px`,
                      "--beat-width": `${beatWidth}px`,
                    } as import("react").CSSProperties
                  }
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("Files"))
                      e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type.startsWith("audio/") || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac)$/i.test(file.name))) {
                      e.preventDefault();
                      e.stopPropagation();
                      pause();
                      onLoadAudio(file);
                    }
                  }}
                >
                  {audioUrl || timeline.audioName ? (
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label="Audio start bar"
                      aria-valuemin={1}
                      aria-valuenow={timeline.audioOffsetBars + 1}
                      className={`timeline-audio-block ${audioUrl ? "" : "missing"}`}
                      style={{
                        left: timeline.audioOffsetBars * zoom,
                        width: Math.max(
                          180,
                          (audioDurationMs / msPerBar) * zoom,
                        ),
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          e.preventDefault();
                          edit({
                            ...timeline,
                            audioOffsetBars: snapBar(
                              timeline.audioOffsetBars +
                                (e.key === "ArrowRight" ? snap : -snap),
                              snap,
                            ),
                          });
                        }
                      }}
                      onPointerDown={(e) => {
                        pause();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        drag.current = {
                          kind: "audio",
                          id: "audio",
                          x: e.clientX,
                          start: timeline.audioOffsetBars,
                          length: 0,
                          lane: 0,
                          nextLane: 0,
                          before: structuredClone(timeline),
                        };
                      }}
                      onPointerMove={movePointer}
                      onPointerUp={endPointer}
                      onPointerCancel={endPointer}
                    >
                      <strong>
                        {audioName || timeline.audioName}{" "}
                        {!audioUrl && "· relink audio"}
                      </strong>
                      <svg viewBox="0 0 320 48" preserveAspectRatio="none">
                        <path d={wavePath} />
                      </svg>
                    </div>
                  ) : (
                    <p>
                      Load or drop an audio file. Drag its waveform to align the
                      first beat.
                    </p>
                  )}
                </div>
              </div>
              {Array.from({ length: laneCount }, (_, lane) => (
                <div key={lane} className="timeline-lane-row">
                  <div className="lane-label">FX {lane + 1}</div>
                  <div
                    data-lane={lane}
                    className="timeline-lane"
                    style={
                      {
                        width: totalBars * zoom,
                        "--bar-width": `${zoom}px`,
                      "--beat-width": `${beatWidth}px`,
                      } as import("react").CSSProperties
                    }
                    onDragOver={(e) => {
                      if (
                        (e.dataTransfer.types.includes("application/lumarig-cue") || e.dataTransfer.types.includes("application/lumarig-fx"))
                      ) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDrop={(e) => dropCue(e, lane)}
                  >
                    {timeline.clips
                      .filter((c) => c.lane === lane)
                      .map((c) => {
                        const cue = cues.find((q) => q.id === c.cueId);
                        return (
                          <div
                            key={c.id}
                            tabIndex={0}
                            role="button"
                            aria-label={`Timeline clip ${cue?.name ?? "Missing cue"}`}
                            className={`timeline-clip ${selectedId === c.id ? "selected" : ""} ${c.enabled ? "" : "muted"}`}
                            style={
                              {
                                left: c.startBar * zoom,
                                width: c.lengthBars * zoom,
                                "--section-color": cue?.color ?? "#55e98d",
                              } as import("react").CSSProperties
                            }
                            onPointerDown={(e) => begin(e, c, "move")}
                            onPointerMove={movePointer}
                            onPointerUp={endPointer}
                            onPointerCancel={endPointer}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setSelectedId(c.id);
                              if (
                                e.key === "ArrowLeft" ||
                                e.key === "ArrowRight"
                              ) {
                                e.preventDefault();
                                changeClip(c.id, {
                                  startBar: snapBar(
                                    c.startBar +
                                      (e.key === "ArrowRight" ? snap : -snap),
                                    snap,
                                  ),
                                });
                              }
                            }}
                          >
                            <strong>{cue?.name ?? "Missing cue"}</strong>
                            <small>
                              {c.lengthBars} bars ·{" "}
                              {cue?.effectStack?.length ?? 0} FX
                            </small>
                            <span
                              aria-label="Resize clip"
                              className="clip-resize"
                              onPointerDown={(e) => begin(e, c, "resize")}
                              onPointerMove={movePointer}
                              onPointerUp={endPointer}
                              onPointerCancel={endPointer}
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
              <div
                className="timeline-playhead"
                style={{ left: 100 + cursor * zoom }}
              />
              <button
                className="add-timeline-lane"
                disabled={laneCount >= 8}
                onClick={() => setLanes(laneCount + 1)}
              >
                ＋ FX lane
              </button>
            </div>
          </div>
          <div className="timeline-inspector">
            <label>
              Audio starts at bar
              <input
                aria-label="Audio starts at bar"
                type="number"
                min={1}
                step={0.25}
                value={timeline.audioOffsetBars + 1}
                disabled={playing}
                onChange={(e) =>
                  edit({
                    ...timeline,
                    audioOffsetBars: clamp(
                      Number(e.target.value) - 1,
                      0,
                      100000,
                    ),
                  })
                }
              />
            </label>
            {selected && (
              <>
                <label>
                  Clip starts at bar
                  <input
                    aria-label="Clip starts at bar"
                    type="number"
                    min={1}
                    step={0.25}
                    value={selected.startBar + 1}
                    disabled={playing}
                    onChange={(e) =>
                      changeClip(selected.id, {
                        startBar: clamp(Number(e.target.value) - 1, 0, 100000),
                      })
                    }
                  />
                </label>
                <label>
                  Clip length in bars
                  <input
                    aria-label="Clip length in bars"
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={selected.lengthBars}
                    disabled={playing}
                    onChange={(e) =>
                      changeClip(selected.id, {
                        lengthBars: clamp(Number(e.target.value), 0.25, 100000),
                      })
                    }
                  />
                </label>
                <label>
                  Lane
                  <select
                    aria-label="Clip lane"
                    value={selected.lane}
                    disabled={playing}
                    onChange={(e) =>
                      changeClip(selected.id, { lane: Number(e.target.value) })
                    }
                  >
                    {Array.from({ length: laneCount }, (_, i) => (
                      <option key={i} value={i}>
                        FX {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) =>
                      changeClip(selected.id, { enabled: e.target.checked })
                    }
                  />
                  Enabled
                </label>
                <button
                  disabled={playing || timeline.clips.length >= 1000}
                  onClick={() => {
                    const copy = {
                      ...selected,
                      id: crypto.randomUUID(),
                      startBar: selected.startBar + selected.lengthBars,
                    };
                    edit({ ...timeline, clips: [...timeline.clips, copy] });
                    setSelectedId(copy.id);
                  }}
                >
                  Duplicate
                </button>
                <button
                  disabled={playing}
                  onClick={() => {
                    edit({
                      ...timeline,
                      clips: timeline.clips.filter((c) => c.id !== selected.id),
                    });
                    setSelectedId("");
                  }}
                >
                  Delete Clip
                </button>
              </>
            )}
          </div>
          <p className="creator-hint">
            FX lanes mix from top to bottom. Lower lanes win when two clips
            write the same channel. Audio is relinked when reopening a show.{" "}
            {audioError}
          </p>
        </main>
      </div>
    </div>
  );
}
