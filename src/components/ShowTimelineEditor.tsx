import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import type { ShowCue } from "../lib/show";
import BpmField from "./BpmField";
import { timelineMediaRange, waveformPeaks, tempoSamples } from "../core/timeline-media";
import { mediaKindForFile } from "../lib/media-library";
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
  kind: "move" | "resize" | "audio" | "trim-in" | "trim-out";
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
  const [fxSearch,setFxSearch]=useState("");
  const [selectedId, setSelectedId] = useState("");
  const [cursor, setCursor] = useState(props.initialBar ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(36);
  const [snapMode, setSnapMode] = useState<"bar"|"beat"|"half-beat"|"quarter-beat"|"free">("bar");
  const [lanes, setLanes] = useState(3);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [tempoEstimate, setTempoEstimate] = useState<TempoEstimate | null>(null);
  const [analysisRevision, setAnalysisRevision] = useState(0);
  const tapTempoRef = useRef<number[]>([]);
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
  const trimInMs = clamp(timeline.trimInMs ?? 0, 0, Math.max(0, audioDurationMs));
  const trimOutMs = clamp(timeline.trimOutMs ?? audioDurationMs, trimInMs, Math.max(trimInMs, audioDurationMs));
  const trimmedDurationMs = Math.max(0, trimOutMs - trimInMs);
  const audioEnd = timeline.audioOffsetBars + trimmedDurationMs / msPerBar;
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
    const { trimInMs: sourceTrimIn, trimOutMs: sourceTrimOut } = timelineMediaRange(p.timeline, audio.duration * 1000);
    const local = positionMs - p.timeline.audioOffsetBars * barMs(p.timeline);
    const sourceMs = sourceTrimIn + local;
    if (local < 0 || sourceMs >= sourceTrimOut) {
      audio.pause();
      if (local < 0 && Math.abs(audio.currentTime * 1000 - sourceTrimIn) > 10) audio.currentTime = sourceTrimIn / 1000;
      return;
    }
    if (force)
      audio.currentTime = Math.max(0, sourceMs / 1000);
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
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, (latest.current.timeline.trimInMs ?? 0) / 1000);
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
      const range = timelineMediaRange(p.timeline, audio ? audio.duration * 1000 : p.audioDurationMs);
      // Media owns the clock during audio playback, including buffering.
      // Repeated currentTime corrections cause audible seek artifacts.
      if (p.audioUrl && audio && cursorRef.current >= offset && cursorRef.current * barMs(p.timeline) < range.endMs && !audio.ended &&
          (!Number.isFinite(audio.duration) || audio.currentTime < audio.duration)) {
        syncAudio(cursorRef.current * barMs(p.timeline));
        const { trimInMs: sourceTrimIn, trimOutMs: sourceTrimOut } = range;
        if (audio.currentTime * 1000 >= sourceTrimOut) {
          audio.pause();
          cursorRef.current = offset + Math.max(0, sourceTrimOut - sourceTrimIn) / barMs(p.timeline);
        } else {
          cursorRef.current = offset + Math.max(0, audio.currentTime * 1000 - sourceTrimIn) / barMs(p.timeline);
        }
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
        p.timeline.audioOffsetBars + Math.max(0, (p.timeline.trimOutMs ?? p.audioDurationMs) - (p.timeline.trimInMs ?? 0)) / barMs(p.timeline),
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
    setAudioError("");
    if (!audioUrl) return;
    const context = new AudioContext();
    void fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((b) => context.decodeAudioData(b))
      .then((buffer) => {
        if (cancelled) return;
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
        setPeaks(waveformPeaks(channels));
        setTempoEstimate(estimateTempoFromSamples(tempoSamples(channels), buffer.sampleRate));
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
  }, [audioUrl, analysisRevision]);
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
    if (d.kind === "trim-in") {
      const deltaMs = delta * msPerBar;
      onChange({
        ...latest.current.timeline,
        trimInMs: clamp(d.start + deltaMs, 0, Math.max(0, d.length - 100)),
        trimOutMs: d.length,
      });
      return;
    }
    if (d.kind === "trim-out") {
      const deltaMs = delta * msPerBar;
      onChange({
        ...latest.current.timeline,
        trimInMs: d.start,
        trimOutMs: clamp(d.length + deltaMs, d.start + 100, Math.max(d.start + 100, audioDurationMs)),
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
    if (d.kind === "audio" && Math.abs(e.clientX - d.x) < 3) {
      const rect = e.currentTarget.parentElement!.getBoundingClientRect();
      seek(snapBar((e.clientX - rect.left) / zoom, snap));
      return;
    }
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
  const wavePath = useMemo(() => peaks
    .map((p, i) => `M ${i} ${24 - p * 22} L ${i} ${24 + p * 22}`)
    .join(" "), [peaks]);
  const waveformStart = audioDurationMs > 0 ? trimInMs / audioDurationMs * peaks.length : 0;
  const waveformWidth = audioDurationMs > 0 ? trimmedDurationMs / audioDurationMs * peaks.length : peaks.length;

  const transportKeys = useRef({ play, stop });
  transportKeys.current = { play, stop };
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,button,summary,[contenteditable="true"],[role="dialog"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        const p = latest.current;
        if (playingRef.current || p.timeline.clips.length || p.audioUrl) transportKeys.current.play();
      } else if (event.key === 'Home') {
        event.preventDefault();
        transportKeys.current.stop();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function seekFromLane(e: import("react").MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('.timeline-clip,.timeline-audio-block,button,input,select')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pause();
    seek(snapBar((e.clientX - rect.left) / zoom, snap));
  }

  function applyTempoEstimate(alignBeatGrid: boolean) {
    if (!tempoEstimate) return;
    const nextBpm = tempoEstimate.bpm;
    const nextBarMs = (60000 / nextBpm) * timeline.beatsPerBar;
    let audioOffsetBars = timeline.audioOffsetBars;
    if (alignBeatGrid && audioUrl) {
      const beatMs = 60000 / nextBpm;
      const currentStartMs = timeline.audioOffsetBars * nextBarMs;
      const phaseFromTrim = tempoEstimate.firstBeatMs - trimInMs;
      const absoluteDetectedBeat = currentStartMs + phaseFromTrim;
      const alignedBeatMs = Math.max(0, Math.round(absoluteDetectedBeat / beatMs) * beatMs);
      let nextStartMs = alignedBeatMs - phaseFromTrim;
      while (nextStartMs < 0) nextStartMs += beatMs;
      audioOffsetBars = nextStartMs / nextBarMs;
    }
    edit({ ...timeline, bpm: nextBpm, audioOffsetBars });
  }

  function alignCurrentAudioToBar() {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    pause();
    const audioBars = Math.max(0, audio.currentTime * 1000 - trimInMs) / msPerBar;
    const targetBar = Math.max(Math.ceil(audioBars), Math.round(timeline.audioOffsetBars + audioBars));
    edit({
      ...timeline,
      audioOffsetBars: Math.max(0, targetBar - audioBars),
    });
  }

  function tapTempo() {
    const now = performance.now();
    tapTempoRef.current = [...tapTempoRef.current.filter((time) => now - time < 4000), now].slice(-8);
    if (tapTempoRef.current.length < 2) return;
    const intervals = tapTempoRef.current.slice(1).map((time, index) => time - tapTempoRef.current[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const bpm = clamp(60000 / average, 20, 300);
    edit({ ...timeline, bpm: Math.round(bpm * 10) / 10, tempoLocked: true });
  }

  function scaleTempo(multiplier: number) {
    edit({ ...timeline, bpm: Math.round(clamp(timeline.bpm * multiplier, 20, 300) * 10) / 10, tempoLocked: true });
  }
  return (
    <div className="show-bar-timeline" data-history={historyVersion}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.preventDefault();
        if (["audio", "video"].includes(mediaKindForFile(file) ?? "")) {
          pause(); onLoadAudio(file);
        } else setAudioError("Choose an audio or video file: WAV, MP3, M4A, MP4, MOV or WebM.");
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
          title="Space to play or pause"
          onClick={play}
        >
          {playing ? "Pause" : "Play Show"}
        </button>
        <button title="Home to rewind" onClick={stop}>Stop / Rewind</button>
        <output>BAR {cursorBar + 1} · BEAT {cursorBeat}</output>
        <label>
          BPM
          <BpmField
            value={timeline.bpm}
            disabled={playing}
            ariaLabel="Timeline BPM"
            onCommit={(value) => edit({ ...timeline, bpm: value, tempoLocked: true })}
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
          {audioUrl ? "Relink Media" : "Load Audio / MP4"}
          <input
            aria-label="Load timeline audio"
            type="file"
            accept="audio/*,video/mp4,video/*"
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
        <div className="tempo-analysis-actions">
          <button disabled={playing || timeline.tempoLocked} onClick={() => applyTempoEstimate(false)}>Use Detected</button>
          <button className="console-primary" disabled={playing || timeline.tempoLocked} onClick={() => applyTempoEstimate(true)}>Use + Align</button>
          <button disabled={playing || !audioUrl} onClick={alignCurrentAudioToBar}>Set Downbeat Here</button>
          <button disabled={playing} onClick={() => scaleTempo(.5)}>½ BPM</button>
          <button disabled={playing} onClick={() => scaleTempo(2)}>2× BPM</button>
          <button disabled={playing} onClick={tapTempo}>Tap</button>
          <button disabled={playing || !audioUrl} onClick={() => setAnalysisRevision((value)=>value+1)}>Re-analyze</button>
          <button className={timeline.tempoLocked?'active':''} disabled={playing} onClick={() => edit({...timeline,tempoLocked:!timeline.tempoLocked})}>{timeline.tempoLocked?'Tempo Locked':'Lock Tempo'}</button>
        </div>
      </section>}
      <div className="timeline-edit-layout">
        <aside className="timeline-cue-library">
          <div className="timeline-library-tabs"><button aria-label="Cue library" aria-pressed={libraryMode==="cues"} onClick={()=>setLibraryMode("cues")}>Cues</button><button aria-pressed={libraryMode==="fx"} onClick={()=>setLibraryMode("fx")}>FX recipes</button></div>
          <header>
            SHOW CUES <small>{cues.length}</small>
          </header>
          <p>Drag to a lane or click to append.</p>
          {libraryMode==="fx" ? <><p>Target: {props.fxTargetName??"current group"}. Drag a recipe to a lane.</p><input className="timeline-fx-search" aria-label="Search timeline FX" placeholder="Search FX…" value={fxSearch} onChange={(event)=>setFxSearch(event.target.value)}/><div className="timeline-fx-browser">{FX_RECIPES.filter((recipe)=>!fxSearch.trim()||(`${recipe.name} ${recipe.category} ${recipe.description}`).toLowerCase().includes(fxSearch.trim().toLowerCase())).map(recipe=><button className="timeline-fx-recipe" key={recipe.id} draggable onDragStart={e=>{e.dataTransfer.setData("application/lumarig-fx",recipe.id);e.dataTransfer.effectAllowed="copy";}} onClick={()=>{checkpoint();props.onAddFx?.(recipe.id,clipEnd,0);}}><span>{recipe.name}<small>{recipe.category}</small></span></button>)}</div></> : cues.length ? (
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
                    if (file && (file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac|mp4|m4v|mov|webm)$/i.test(file.name))) {
                      e.preventDefault();
                      e.stopPropagation();
                      pause();
                      onLoadAudio(file);
                    }
                  }}
                  onClick={seekFromLane}
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
                          2,
                          (trimmedDurationMs / msPerBar) * zoom,
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
                        e.stopPropagation();
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
                      <svg viewBox={`${waveformStart} 0 ${Math.max(.001,waveformWidth)} 48`} preserveAspectRatio="none" aria-label="Audio waveform">
                        <path d={wavePath} />
                      </svg>
                      <span className="audio-trim-handle trim-in" aria-label="Trim media in" onPointerDown={(e)=>{e.stopPropagation();pause();e.currentTarget.setPointerCapture(e.pointerId);drag.current={kind:"trim-in",id:"audio",x:e.clientX,start:trimInMs,length:trimOutMs,lane:0,nextLane:0,before:structuredClone(timeline)};}} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}/>
                      <span className="audio-trim-handle trim-out" aria-label="Trim media out" onPointerDown={(e)=>{e.stopPropagation();pause();e.currentTarget.setPointerCapture(e.pointerId);drag.current={kind:"trim-out",id:"audio",x:e.clientX,start:trimInMs,length:trimOutMs,lane:0,nextLane:0,before:structuredClone(timeline)};}} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}/>
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
                    onClick={seekFromLane}
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
            {audioUrl && <>
              <label>Trim in<input aria-label="Timeline trim in" type="number" min="0" max={Math.max(0,audioDurationMs)} step="10" value={Math.round(trimInMs)} disabled={playing} onChange={(e)=>edit({...timeline,trimInMs:clamp(Number(e.target.value),0,Math.max(0,trimOutMs-100))})}/></label>
              <label>Trim out<input aria-label="Timeline trim out" type="number" min={trimInMs+100} max={Math.max(trimInMs+100,audioDurationMs)} step="10" value={Math.round(trimOutMs)} disabled={playing} onChange={(e)=>edit({...timeline,trimOutMs:clamp(Number(e.target.value),trimInMs+100,Math.max(trimInMs+100,audioDurationMs))})}/></label>
              <button disabled={playing} onClick={()=>edit({...timeline,trimInMs:0,trimOutMs:audioDurationMs})}>Reset Trim</button>
            </>}
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
                <section className="timeline-step-editor">
                  <label className="inline-check"><input type="checkbox" aria-label="Enable step pattern" checked={Boolean(selected.stepPattern?.length)} disabled={playing} onChange={(e)=>changeClip(selected.id,e.target.checked?{stepDivision:selected.stepDivision??8,stepPattern:Array.from({length:selected.stepDivision??8},()=>true)}:{stepDivision:undefined,stepPattern:undefined})}/>Step pattern</label>
                  <header><span>STEP EDIT</span><strong>{selected.stepDivision ?? 8} steps / bar</strong></header>
                  <label>Grid<select aria-label="Step edit division" disabled={playing} value={selected.stepDivision ?? 8} onChange={(e)=>{
                    const division=Number(e.target.value) as 4|8|16;
                    const existing=selected.stepPattern??[];
                    changeClip(selected.id,{stepDivision:division,stepPattern:Array.from({length:division},(_,index)=>existing[index]??(index%2===0))});
                  }}><option value={4}>Quarter</option><option value={8}>Eighth</option><option value={16}>Sixteenth</option></select></label>
                  <div className="step-editor-grid" style={{gridTemplateColumns:`repeat(${selected.stepDivision??8},minmax(24px,1fr))`}}>
                    {Array.from({length:selected.stepDivision??8},(_,index)=>{
                      const pattern=selected.stepPattern??Array.from({length:selected.stepDivision??8},(_,step)=>step%2===0);
                      const active=pattern[index]??false;
                      return <button key={index} className={selected.stepPattern?.length&&active?'active':''} aria-label={`Step ${index+1}`} aria-pressed={Boolean(selected.stepPattern?.length) && active} disabled={playing} onClick={()=>{
                        const next=[...pattern];next[index]=!active;changeClip(selected.id,{stepDivision:selected.stepDivision??8,stepPattern:next});
                      }}><small>{index+1}</small><b>{active?'●':'·'}</b></button>;
                    })}
                  </div>
                  <div className="step-editor-actions"><button onClick={()=>changeClip(selected.id,{stepDivision:selected.stepDivision??8,stepPattern:Array.from({length:selected.stepDivision??8},()=>true)})}>All</button><button onClick={()=>changeClip(selected.id,{stepDivision:selected.stepDivision??8,stepPattern:Array.from({length:selected.stepDivision??8},(_,index)=>index%2===0)})}>Alternate</button><button onClick={()=>changeClip(selected.id,{stepDivision:undefined,stepPattern:undefined})}>Continuous</button></div>
                  <small>Use this for drum hits, strobes, blinders or tight rhythmic cue/effect clips. The pattern repeats each bar.</small>
                </section>
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
            write the same channel. Media is stored in the LumaRig library when imported.{" "}
            {audioError}
          </p>
        </main>
      </div>
    </div>
  );
}
