import { openMediaOutput } from "./MediaOutput";
import { waveformForBlob, displayPeaks, type Waveform } from '../lib/media-waveform';
import { mediaWindow, mediaPosition, steppedBar } from '../lib/timeline-media';
import ResizableWorkspace from './ResizableWorkspace';
import TempoInput from './TempoInput';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import type { ShowCue } from "../lib/show";
import type { TempoAnalysis } from '../lib/tempo-analysis';
import {
  FX_RECIPES,
  barMs,
  snapBar,
  type ShowTimeline,
  type TimelineClip,
  type FxRecipe,
  type TimelineMediaClip,
  type TimelineTakeClip,
} from "../lib/show-design";
type Props = {
  onRecord?: (bar:number,overdub:boolean)=>void;
  keepMediaOnRelease?: ()=>boolean;
  onImportVideoClip?: (file:File,startBar:number)=>void;
  onPlayingChange?: (playing:boolean)=>void;
  onExportVideo?: (clip?:TimelineMediaClip)=>void;
  fxRecipes?: FxRecipe[];
  screens?: Array<{id:string;label:string}>;
  onDisplayChange?: (screenId:string)=>void;
  displayId?: string;
  selectedClipId?: string;
  positionBar?: number;
  onSelectClip?: (id: string, bar: number) => void;
  onRelease?: () => void;
  onReset?: () => void;
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
  tempoLocked: boolean;
  onTempoLockChange: (locked: boolean) => void;
  masterBpm: number;
  onMasterBpmChange: (bpm: number) => void;
  tempoAnalysis?: TempoAnalysis;
  onDownbeatChange?: (downbeatMs:number)=>void;
};
type Drag = {
  kind: "move" | "resize" | "audio" | "trim-in" | "trim-out" | "playhead" | "video-move" | "video-resize" | "take-move" | "take-resize";
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
const runtimeBarMs = (props: Pick<Props, "timeline" | "masterBpm">) =>
  barMs({ ...props.timeline, bpm: clamp(props.masterBpm, 20, 300) });
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
    masterBpm,
    onMasterBpmChange,
  tempoLocked, onTempoLockChange,
  } = props;
  const [selectedLane,setSelectedLane]=useState(0);
  const recipes=props.fxRecipes ?? FX_RECIPES;
  const clipClipboard=useRef<Array<{kind:'cue'|'video'|'take';clip:TimelineClip|TimelineMediaClip|TimelineTakeClip}>>([]);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const selectedRef=useRef('');
  const audioStarting = useRef(false);
  const playAttempt = useRef(0);
  const [libraryMode,setLibraryMode]=useState<"cues"|"fx"|"myfx">("cues");
  const [localSelectedId, setLocalSelectedId] = useState("");
  const selectedId = props.selectedClipId ?? localSelectedId;
  useEffect(()=>{if(props.selectedClipId==='')setSelectedIds(new Set());},[props.selectedClipId]);
  function setSelectedId(id: string) {
    setSelectedIds(new Set([id]));
    setLocalSelectedId(id);
    const clip = [...latest.current.timeline.clips,...latest.current.timeline.videoClips??[],...latest.current.timeline.takeClips??[]].find(item => item.id === id);
    latest.current.onSelectClip?.(id, clip?.startBar ?? cursorRef.current);
  }
  const [cursor, setCursor] = useState(props.positionBar ?? props.initialBar ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(36);
  const zoomRef = useRef(36);
  const [trackHeight,setTrackHeight]=useState(()=>{
    const saved=Number(window.localStorage.getItem('lumarig.timeline-track-height.v1') || 80);
    return clamp(saved,44,140);
  });
  useEffect(()=>{window.localStorage.setItem('lumarig.timeline-track-height.v1',String(trackHeight));},[trackHeight]);
  const [snap, setSnap] = useState(1);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const followPlayheadRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [lanes, setLanes] = useState(3);
  const [waveform, setWaveform] = useState<Waveform | null>(null);
  const [audioError, setAudioError] = useState("");
  const undo = useRef<ShowTimeline[]>([]),
    redo = useRef<ShowTimeline[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const latest = useRef(props);
  const cursorRef = useRef(props.positionBar ?? props.initialBar ?? 0),
    playingRef = useRef(false),
    raf = useRef<number | null>(null),
    drag = useRef<Drag | null>(null);
  latest.current = props;
  zoomRef.current = zoom;
  followPlayheadRef.current = followPlayhead;
  const msPerBar = runtimeBarMs(props);
  const clipEnd = Math.max(
    0,
    ...timeline.clips.map((c) => c.startBar + c.lengthBars),
    ...(timeline.videoClips??[]).map(c=>c.startBar+c.lengthBars),
    ...(timeline.takeClips??[]).map(c=>c.startBar+c.lengthBars),
  );
  const bounds = mediaWindow(timeline, audioDurationMs);
  const audioEnd = timeline.audioOffsetBars + bounds.durationMs / msPerBar;
  const waveformWidth = Math.max(1, bounds.durationMs / msPerBar * zoom);
  const peaks = waveform ? displayPeaks(waveform, bounds.startMs, bounds.endMs, waveformWidth) : [];
  const endBar = Math.max(16, clipEnd, audioEnd);
  const totalBars = Math.max(32, Math.ceil(endBar + 8));
  const laneCount = Math.max(lanes, ...timeline.clips.map((c) => c.lane + 1));
  const selectedVideo=timeline.videoClips?.find(c=>c.id===selectedId);
  const selectedTake=timeline.takeClips?.find(c=>c.id===selectedId);
  const [takeChannel,setTakeChannel]=useState(1),[takeValue,setTakeValue]=useState(255);
  const selected = timeline.clips.find((c) => c.id === selectedId);
  selectedRef.current=selectedId;
  const shortcutRef=useRef<(event:KeyboardEvent)=>void>(()=>{});
  shortcutRef.current=(event)=>{
    const target=event.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable="true"]') || !(event.ctrlKey||event.metaKey))return;
    const key=event.key.toLowerCase();
    if(key==='z'||key==='y'){event.preventDefault();pause();history(key==='y'||event.shiftKey?'redo':'undo');}
    else if(key==='a'){event.preventDefault();const t=latest.current.timeline;setSelectedIds(new Set([...t.clips,...t.videoClips??[],...t.takeClips??[]].map(c=>c.id)));}
    else if(key==='c'){
      const t=latest.current.timeline,ids=selectedIds.size?selectedIds:new Set([selectedRef.current]);
      const clips=[...t.clips,...t.videoClips??[],...t.takeClips??[]].filter(c=>ids.has(c.id));
      if(clips.length){event.preventDefault();clipClipboard.current=clips.map(clip=>({kind:'cueId' in clip?'cue':'mediaId' in clip?'video':'take',clip:structuredClone(clip)}));}
    }
    else if(key==='v' && clipClipboard.current.length){event.preventDefault();pause();const copied=clipClipboard.current,t=latest.current.timeline;
      const anchor=Math.min(...copied.map(c=>c.clip.startBar)),laneAnchor=Math.min(...copied.filter(c=>c.kind==='cue').map(c=>(c.clip as TimelineClip).lane));
      const cues:TimelineClip[]=[],videos:TimelineMediaClip[]=[],takes:TimelineTakeClip[]=[];
      for(const {kind,clip:source} of copied){const clip={...structuredClone(source),id:crypto.randomUUID(),startBar:Math.max(0,snapBar(cursorRef.current,snap)+source.startBar-anchor)};
        if(kind==='cue')cues.push({...clip as TimelineClip,lane:Math.min(15,selectedLane+(source as TimelineClip).lane-laneAnchor)});
        else if(kind==='video')videos.push(clip as TimelineMediaClip);else takes.push(clip as TimelineTakeClip);
      }
      if(t.clips.length+cues.length>1000||(t.videoClips?.length??0)+videos.length>100||(t.takeClips?.length??0)+takes.length>24){setAudioError('Paste exceeds the Timeline clip limit.');return;}
      edit({...t,clips:[...t.clips,...cues],videoClips:[...t.videoClips??[],...videos],takeClips:[...t.takeClips??[],...takes]});
      const pasted=[...cues,...videos,...takes];if(pasted[0])setSelectedId(pasted[0].id);setSelectedIds(new Set(pasted.map(c=>c.id)));
    }
  };
  useEffect(()=>{const keydown=(event:KeyboardEvent)=>shortcutRef.current(event);window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[]);
  useEffect(() => {
    if (props.positionBar === undefined || Math.abs(props.positionBar-cursorRef.current)<0.00001) return;
    cursorRef.current=props.positionBar; setCursor(props.positionBar);
  }, [props.positionBar]);
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
    const bounds = mediaWindow(p.timeline, p.audioDurationMs);
    const source = mediaPosition(positionMs, p.timeline.audioOffsetBars * runtimeBarMs(p), bounds);
    if (source === null) {
      audio.pause();
      const boundary = positionMs < p.timeline.audioOffsetBars * runtimeBarMs(p) ? bounds.startMs : bounds.endMs;
      if (Number.isFinite(boundary) && audio.readyState >= 1 && Math.abs(audio.currentTime * 1000 - boundary) > 5)
        audio.currentTime = boundary / 1000;
      return;
    }
    if ((force || (audio.paused && Math.abs(audio.currentTime * 1000 - source) > 100)) && audio.readyState >= 1)
      audio.currentTime = source / 1000;
    if (playingRef.current && audio.paused && !audioStarting.current) {
      audioStarting.current = true;
      const attempt = ++playAttempt.current;
      void audio.play().then(()=>{if(attempt===playAttempt.current&&!playingRef.current)audio.pause();}).catch(() => {
        if(attempt!==playAttempt.current)return;
        setAudioError(
          "Audio could not play. Relink the track or press Play again.",
        );
        pause();
      }).finally(() => { if(attempt===playAttempt.current)audioStarting.current = false; });
    }
  }
  function pause() {
    ++playAttempt.current; audioStarting.current = false;
    playingRef.current = false;
    setPlaying(false);
    latest.current.onPlayingChange?.(false);
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioRef.current?.pause();
  }
  function stop() {
    if(latest.current.keepMediaOnRelease?.())return;
    pause();
    cursorRef.current = 0;
    setCursor(0);
    if (audioRef.current) audioRef.current.currentTime = mediaWindow(latest.current.timeline, latest.current.audioDurationMs).startMs / 1000;
    latest.current.onStop();
    latest.current.onReset?.();
  }
  function seek(bar: number) {
    if(latest.current.keepMediaOnRelease?.())return;
    const next = clamp(bar, 0, 100000);
    cursorRef.current = next;
    setCursor(next);
    latest.current.onFrame(next * runtimeBarMs(latest.current));
    syncAudio(next * runtimeBarMs(latest.current), true);
  }
  function play() {
    if(latest.current.keepMediaOnRelease?.())return;
    if (playingRef.current) {
      pause();
      return;
    }
    setAudioError("");
    playingRef.current = true;
    setPlaying(true);
    latest.current.onPlayingChange?.(true);
    let previous = performance.now(),
      lastPaint = previous - 40;
    syncAudio(cursorRef.current * runtimeBarMs(latest.current), true);
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const p = latest.current;
      const audio = p.audioRef.current;
      const offset = p.timeline.audioOffsetBars;
      // Media owns the clock during audio playback, including buffering.
      // Repeated currentTime corrections cause audible seek artifacts.
      const bounds = mediaWindow(p.timeline, p.audioDurationMs);
      const mediaEnd = offset + bounds.durationMs / runtimeBarMs(p);
      if (p.audioUrl && audio && bounds.durationMs > 0 && cursorRef.current >= offset && cursorRef.current < mediaEnd) {
        syncAudio(cursorRef.current * runtimeBarMs(p));
        if (audio.readyState >= 1) {
          cursorRef.current = offset + clamp(audio.currentTime * 1000 - bounds.startMs, 0, bounds.durationMs) / runtimeBarMs(p);
          // At trim-out, hand timing back to the internal clock for any remaining lighting clips.
          if (audio.currentTime * 1000 >= bounds.endMs - 2 || audio.ended) {
            cursorRef.current = mediaEnd;
            audio.pause();
          }
        }
      } else {
        cursorRef.current += (now - previous) / runtimeBarMs(p);
      }
      previous = now;
      if (now - lastPaint >= 25) {
        setCursor(cursorRef.current);
        p.onFrame(cursorRef.current * runtimeBarMs(p));
        syncAudio(cursorRef.current * runtimeBarMs(p));
        if (followPlayheadRef.current && scrollRef.current) {
          const scroller = scrollRef.current;
          const x = 100 + cursorRef.current * zoomRef.current;
          const left = scroller.scrollLeft;
          const right = left + scroller.clientWidth;
          if (x > right - scroller.clientWidth * .2 || x < left + 110) scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * .35);
        }
        lastPaint = now;
      }
      const end = Math.max(
        1,
        ...p.timeline.clips.map((c) => c.startBar + c.lengthBars),
        ...(p.timeline.videoClips??[]).map(c=>c.startBar+c.lengthBars),
        ...(p.timeline.takeClips??[]).map(c=>c.startBar+c.lengthBars),
        p.timeline.audioOffsetBars + mediaWindow(p.timeline, p.audioDurationMs).durationMs / runtimeBarMs(p),
      );
      if (cursorRef.current >= end) {
        cursorRef.current = end; setCursor(end); p.onFrame(end * runtimeBarMs(p));
        pause();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }
  useEffect(() => {
    const stopTransport=()=>{if(latest.current.keepMediaOnRelease?.())return;++playAttempt.current;audioStarting.current=false;playingRef.current=false;setPlaying(false);latest.current.onPlayingChange?.(false);if(raf.current!==null)cancelAnimationFrame(raf.current);raf.current=null;latest.current.audioRef.current?.pause();latest.current.onStop();};
    window.addEventListener('lumarig-stop-timeline',stopTransport);
    return ()=>window.removeEventListener('lumarig-stop-timeline',stopTransport);
  },[]);
  useEffect(
    () => () => {
      ++playAttempt.current;
      playingRef.current = false;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if(latest.current.keepMediaOnRelease?.())return;
      latest.current.onPlayingChange?.(false);
      latest.current.audioRef.current?.pause();
      (latest.current.onRelease ?? latest.current.onStop)();
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setWaveform(null);
    setAudioError('');
    if (!audioUrl) return;
    void fetch(audioUrl, { signal: controller.signal })
      .then(r => { if (!r.ok) throw Error('Media unavailable'); return r.blob(); })
      .then(waveformForBlob)
      .then(wave => { if (!cancelled) setWaveform(wave); })
      .catch(() => { if (!cancelled) setAudioError('Waveform unavailable for this codec. Media playback remains available.'); });
    return () => { cancelled = true; controller.abort(); };
  }, [audioUrl]);
  const muteKey=(timeline.mutedLanes??[]).join(',');
  useEffect(()=>{if(!playingRef.current)latest.current.onFrame(cursorRef.current*runtimeBarMs(latest.current));},[muteKey]);
  function seekPointer(e: PointerEvent<HTMLElement>) {
    if (drag.current || e.button !== 0) return;
    const lane = e.currentTarget.closest<HTMLElement>('.timeline-lane, .bar-ruler');
    if (!lane) return;
    if(lane.dataset.lane!==undefined)setSelectedLane(Number(lane.dataset.lane));
    seek((e.clientX - lane.getBoundingClientRect().left) / zoomRef.current);
  }
  function beginTrim(e: PointerEvent<HTMLElement>, kind: 'trim-in' | 'trim-out') {
    e.preventDefault(); e.stopPropagation(); pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    const bounds = mediaWindow(timeline, audioDurationMs);
    drag.current = { kind, id: 'audio', x: e.clientX, start: bounds.startMs, length: bounds.endMs, lane: 0, nextLane: 0, before: structuredClone(timeline) };
  }
  function cancelPointer(e: PointerEvent<HTMLElement>) {
    const before = drag.current?.before;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (before) onChange(before);
  }
  function transportKey(e: import('react').KeyboardEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('input,select,textarea,button,[role="button"],[role="slider"]')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      seek(steppedBar(cursorRef.current, e.key === 'ArrowRight' ? 1 : -1, timeline.beatsPerBar, e.shiftKey));
    } else if (e.key === 'Home') { e.preventDefault(); seek(0); }
    else if (e.code === 'Space') { e.preventDefault(); play(); }
  }
  function begin(
    e: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    kind: "move" | "resize",
  ) {
    e.preventDefault();
    e.stopPropagation();
    pause();
    setSelectedLane(clip.lane);
    if(selectedId!==clip.id)setSelectedId(clip.id);
    if(kind==="move")seek(clip.startBar);
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
  function assetChange(kind:'video'|'take',id:string,changes:Partial<TimelineMediaClip & TimelineTakeClip>,record=true) {
    const current=latest.current.timeline;
    const next=kind==='video'?{...current,videoClips:current.videoClips?.map(c=>c.id===id?{...c,...changes}:c)}:{...current,takeClips:current.takeClips?.map(c=>c.id===id?{...c,...changes}:c)};
    if(record)edit(next);else onChange(next);
  }
  function beginAsset(e:PointerEvent<HTMLElement>,clip:TimelineMediaClip|TimelineTakeClip,kind:'video'|'take',resize=false){
    e.preventDefault();e.stopPropagation();pause();setSelectedId(clip.id);seek(clip.startBar);e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={kind:kind==='video'?(resize?'video-resize':'video-move'):(resize?'take-resize':'take-move'),id:clip.id,x:e.clientX,start:clip.startBar,length:clip.lengthBars,lane:0,nextLane:0,before:structuredClone(timeline)};
  }
  function movePointer(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.x) / zoomRef.current;
    if(d.kind.startsWith('video-') || d.kind.startsWith('take-')){
      const kind=d.kind.startsWith('video-')?'video':'take';
      const clip=(kind==='video'?latest.current.timeline.videoClips:latest.current.timeline.takeClips)?.find(c=>c.id===d.id);
      if(!clip)return;
      if(d.kind.endsWith('resize'))assetChange(kind,d.id,{lengthBars:clamp(snapBar(d.length+delta,snap),.0001,(clip.trimOutMs-clip.trimInMs)/runtimeBarMs(latest.current))},false);
      else assetChange(kind,d.id,{startBar:clamp(snapBar(d.start+delta,snap),0,100000)},false);
      return;
    }
    if (d.kind === 'playhead') { seek(d.start + delta); return; }
    if (d.kind === 'trim-in' || d.kind === 'trim-out') {
      const ms = delta * runtimeBarMs(latest.current);
      const minimum = Math.min(10, audioDurationMs);
      onChange({ ...latest.current.timeline,
        audioTrimInMs: d.kind === 'trim-in' ? clamp(d.start + ms, 0, d.length - minimum) : d.start,
        audioTrimOutMs: d.kind === 'trim-out' ? clamp(d.length + ms, d.start + minimum, audioDurationMs) : d.length,
      });
      return;
    }
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
    if (d.kind !== 'playhead' && JSON.stringify(d.before) !== JSON.stringify(latest.current.timeline)) checkpoint(d.before);
  }
  function dropCue(e: import("react").DragEvent<HTMLElement>, lane: number) {
    e.preventDefault();
    const recipeId=e.dataTransfer.getData("application/lumarig-fx");
    if(recipes.some(r=>r.id===recipeId)){
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
  return (
    <div className="show-bar-timeline" data-history={historyVersion} data-track-compact={trackHeight < 64 ? 'true' : 'false'} style={{'--timeline-track-height':`${trackHeight}px`} as import('react').CSSProperties}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.preventDefault();
        if (file.type.startsWith("audio/") || file.type === "video/mp4" || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac|mp4)$/i.test(file.name)) {
          pause(); onLoadAudio(file);
        } else setAudioError("Choose audio or an MP4 with audio: WAV, MP3, M4A, AIFF, OGG, FLAC or MP4.");
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
        <button className="record-button" disabled={Boolean(props.keepMediaOnRelease?.())} onClick={()=>{pause();props.onRecord?.(cursorRef.current,false);}}>● Record</button>
        <button disabled={Boolean(props.keepMediaOnRelease?.())} onClick={()=>{pause();props.onRecord?.(cursorRef.current,true);}}>● Overdub</button>
        <button
          className="console-primary"
          disabled={!timeline.clips.length && !timeline.videoClips?.length && !timeline.takeClips?.length && !audioUrl}
          onClick={play}
        >
          {playing ? "Pause" : "Play Show"}
        </button>
        <button onClick={stop}>Stop / Rewind</button>
        {(timeline.videoClips?.length || /\.mp4$/i.test(audioName)) ? <button onClick={()=>void openMediaOutput().catch(error=>setAudioError(String(error)))}>Pop Out Video</button> : null}
        <label>Import video clip<input aria-label="Import Timeline video clip" type="file" accept="video/mp4,.mp4" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file){pause();props.onImportVideoClip?.(file,cursorRef.current);}}}/></label>
        {(selectedVideo || /\.mp4$/i.test(audioName)) && <button onClick={()=>props.onExportVideo?.(selectedVideo)}>Export trimmed MP4</button>}
        <label>Display from Timeline<select aria-label="Display from Timeline" value={props.displayId??""} onChange={e=>props.onDisplayChange?.(e.target.value)}><option value="">No screen</option>{props.screens?.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <button aria-label="Rewind timeline" onClick={() => seek(0)}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3h2v10H2zM13 3v10L5 8z" /></svg></button>
        <button aria-label="Previous beat" onClick={() => seek(steppedBar(cursorRef.current, -1, timeline.beatsPerBar))}>‹ Beat</button>
        <button aria-label="Next beat" onClick={() => seek(steppedBar(cursorRef.current, 1, timeline.beatsPerBar))}>Beat ›</button>
        <label>Jump to cue<select aria-label="Jump to cue" value="" onChange={e => {
          const clip = timeline.clips.find(c => c.id === e.target.value); if (clip) seek(clip.startBar);
        }}><option value="">Choose cue</option>{[...timeline.clips].sort((a,b) => a.startBar - b.startBar).map(c => <option key={c.id} value={c.id}>{cues.find(q => q.id === c.cueId)?.name ?? 'Missing cue'} · Bar {c.startBar + 1}</option>)}</select></label>
        <output aria-label="Timeline position">BAR {Math.floor(cursor) + 1} · BEAT {Math.floor((cursor % 1) * timeline.beatsPerBar) + 1}</output>
        <label>
          Master BPM
          <TempoInput label="Master BPM" value={masterBpm} disabled={playing} onChange={next => {
            edit({ ...timeline, bpm: next }); onMasterBpmChange(next);
          }} />
        </label>
        <button className="tempo-lock" aria-pressed={tempoLocked} onClick={() => onTempoLockChange(!tempoLocked)}>{tempoLocked ? "Tempo Locked" : "Lock Tempo"}</button>
        {props.tempoAnalysis && <span className="timeline-tempo-analysis" title={`Analyzed ${new Date(props.tempoAnalysis.analyzedAt).toLocaleString()}`}>
          <b>{props.tempoAnalysis.bpm} detected</b>
          <small>{Math.round(props.tempoAnalysis.confidence*100)}% · downbeat {(props.tempoAnalysis.downbeatMs/1000).toFixed(2)}s{props.tempoAnalysis.manualDownbeat?' corrected':''}</small>
        </span>}
        <button disabled={!audioUrl || !props.onDownbeatChange} onClick={()=>{
          const downbeatMs=Math.max(0,Math.round((audioRef.current?.currentTime ?? 0)*1000));
          props.onDownbeatChange?.(downbeatMs);
        }}>Set Downbeat Here</button>
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
            value={snap}
            onChange={(e) => setSnap(Number(e.target.value))}
          >
            <option value={1}>Bar</option>
            <option value={1 / timeline.beatsPerBar}>Beat</option>
            <option value={1 / (timeline.beatsPerBar * 2)}>½ Beat</option>
            <option value={1 / (timeline.beatsPerBar * 4)}>¼ Beat</option>
            <option value={1 / (timeline.beatsPerBar * 3)}>Triplet</option>
          </select>
        </label>
        <label>
          Zoom
          <input
            aria-label="Timeline zoom"
            type="range"
            min={4}
            max={400}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          Track height · {Math.round(trackHeight)} px
          <input
            aria-label="Timeline track height"
            type="range"
            min={44}
            max={140}
            step={2}
            value={trackHeight}
            onChange={(e)=>setTrackHeight(clamp(Number(e.target.value),44,140))}
          />
        </label>
        <div className="track-height-presets" role="group" aria-label="Timeline track height presets">
          <button aria-pressed={trackHeight===48} onClick={()=>setTrackHeight(48)}>Compact</button>
          <button aria-pressed={trackHeight===80} onClick={()=>setTrackHeight(80)}>Normal</button>
          <button aria-pressed={trackHeight===120} onClick={()=>setTrackHeight(120)}>Tall</button>
        </div>
        <button onClick={() => { const width = Math.max(320, (scrollRef.current?.clientWidth ?? 900) - 120); setZoom(clamp(width / Math.max(1, totalBars), 4, 400)); }}>Fit</button>
        <button className={followPlayhead ? "active" : ""} aria-pressed={followPlayhead} onClick={() => setFollowPlayhead((value) => !value)}>Follow {followPlayhead ? "On" : "Off"}</button>
        <label className="file-button">
          {audioUrl ? "Relink Audio" : "Load Audio"}
          <input
            aria-label="Load timeline audio"
            type="file"
            accept="audio/*,video/mp4,.mp4"
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
      <ResizableWorkspace className="timeline-edit-layout" storageKey="lumarig.timeline-columns.v1" compactMode="stack" leftLabel="Cue / FX Library" rightEnabled={false} leftDefault={220} centerMinimum={480}>
        <aside className="timeline-cue-library">
          <div className="timeline-library-tabs"><button aria-label="Cue library" aria-pressed={libraryMode==="cues"} onClick={()=>setLibraryMode("cues")}>Cues</button><button aria-pressed={libraryMode==="fx"} onClick={()=>setLibraryMode("fx")}>FX recipes</button><button aria-pressed={libraryMode==="myfx"} onClick={()=>setLibraryMode("myfx")}>My FX</button></div>
          <header>
            SHOW CUES <small>{cues.length}</small>
          </header>
          <p>Drag to a lane or click to append.</p>
          {libraryMode!=="cues" ? <><p>Target: {props.fxTargetName??"current group"} · FX {selectedLane+1}. Click to insert at the playhead or drag to a lane.</p>{recipes.filter(r=>libraryMode!=="myfx" || r.id.startsWith("custom:")).map(recipe=><button className="timeline-fx-recipe" key={recipe.id} draggable onDragStart={e=>{e.dataTransfer.setData("application/lumarig-fx",recipe.id);e.dataTransfer.effectAllowed="copy";}} onClick={()=>{checkpoint();props.onAddFx?.(recipe.id,cursorRef.current,selectedLane);}}><span>{recipe.name}<small>{recipe.category}</small></span></button>)}</> : cues.length ? (
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
          <div className="timeline-scroll" ref={scrollRef} tabIndex={0} aria-label="Timeline editing area" onKeyDown={transportKey}>
            <div
              className="timeline-sheet"
              style={{ width: totalBars * zoom + 100 }}
            >
              <div className="timeline-ruler-row">
                <div className="lane-label">BARS</div>
                <div
                  className="bar-ruler"
                  style={{ width: totalBars * zoom }}
                  onPointerDown={seekPointer}
                >
                  {Array.from({ length: totalBars }, (_, i) => (
                    <span key={i} style={{ left: i * zoom, width: zoom }}>
                      {zoom >= 30 || i % Math.ceil(40 / zoom) === 0 ? i + 1 : ""}
                    </span>
                  ))}
                </div>
              </div>
              <div className="timeline-lane-row audio-row">
                <div className="lane-label">AUDIO</div>
                <div
                  className="timeline-lane"
                  onPointerDown={seekPointer}
                  style={
                    {
                      width: totalBars * zoom,
                      "--bar-width": `${zoom}px`,
                        "--beat-width": `${zoom / timeline.beatsPerBar}px`,
                        "--subdivision-width": `${zoom / (timeline.beatsPerBar * 4)}px`,
                    } as import("react").CSSProperties
                  }
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("Files"))
                      e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type.startsWith("audio/") || file.type === "video/mp4" || /\.(wav|mp3|m4a|aac|aif|aiff|ogg|flac|mp4)$/i.test(file.name))) {
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
                        width: Math.max(1, waveformWidth),
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
                        if (!e.altKey) { e.stopPropagation(); seek(timeline.audioOffsetBars + (e.clientX - e.currentTarget.getBoundingClientRect().left) / zoom); return; }
                        e.preventDefault(); e.stopPropagation(); pause();
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
                      onPointerCancel={cancelPointer}
                    >
                      <strong>
                        {audioName || timeline.audioName}{" "}
                        {!audioUrl && "· relink audio"}
                      </strong>
                      <span className="audio-trim-handle trim-in" role="slider" tabIndex={0} aria-label="Media trim in" aria-valuemin={0} aria-valuemax={bounds.endMs / 1000} aria-valuenow={bounds.startMs / 1000}
                        onPointerDown={e => beginTrim(e, 'trim-in')} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelPointer}
                        onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); edit({ ...timeline, audioTrimInMs: clamp(bounds.startMs + (e.key === 'ArrowRight' ? 10 : -10), 0, bounds.endMs - 10) }); } }} />
                      <span className="audio-trim-handle trim-out" role="slider" tabIndex={0} aria-label="Media trim out" aria-valuemin={bounds.startMs / 1000} aria-valuemax={audioDurationMs / 1000} aria-valuenow={bounds.endMs / 1000}
                        onPointerDown={e => beginTrim(e, 'trim-out')} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelPointer}
                        onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); edit({ ...timeline, audioTrimOutMs: clamp(bounds.endMs + (e.key === 'ArrowRight' ? 10 : -10), bounds.startMs + 10, audioDurationMs) }); } }} />
                      <svg viewBox={`0 0 ${Math.max(1, peaks.length)} 48`} preserveAspectRatio="none">
                        <path d={wavePath} />
                      </svg>
                    </div>
                  ) : (
                    <p>
                      Load or drop audio or MP4. Click to seek; Alt-drag the waveform to align it. Drag its edges to trim.
                    </p>
                  )}
                </div>
              </div>
              {(['video','take'] as const).map(kind=><div className="timeline-lane-row" key={kind}><div className="lane-label">{kind==='video'?'VIDEO':'TAKE'}</div><div className="timeline-lane asset-lane" style={{width:totalBars*zoom,'--bar-width':`${zoom}px`,'--beat-width':`${zoom/timeline.beatsPerBar}px`} as import('react').CSSProperties} onPointerDown={seekPointer} onDragOver={e=>{if(kind==='video' && e.dataTransfer.types.includes('Files')){e.preventDefault();e.stopPropagation();}}} onDrop={e=>{if(kind!=='video')return;const file=e.dataTransfer.files[0];if(file){e.preventDefault();e.stopPropagation();pause();props.onImportVideoClip?.(file,clamp((e.clientX-e.currentTarget.getBoundingClientRect().left)/zoom,0,100000));}}}>
                {(kind==='video'?timeline.videoClips??[]:timeline.takeClips??[]).map(clip=><div key={clip.id} role="button" tabIndex={0} aria-label={`${kind==='video'?'Video':'Recorded take'} clip ${clip.name}`} className={`timeline-clip asset-clip ${(selectedId===clip.id || selectedIds.has(clip.id))?'selected':''} ${clip.enabled?'':'muted'}`} style={{left:clip.startBar*zoom,width:clip.lengthBars*zoom,'--section-color':kind==='video'?'#64baff':'#d3a1ff'} as import('react').CSSProperties} onPointerDown={e=>beginAsset(e,clip,kind)} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelPointer} onKeyDown={e=>{if(e.key==='Enter'){pause();setSelectedId(clip.id);seek(clip.startBar);}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();assetChange(kind,clip.id,{startBar:Math.max(0,clip.startBar+(e.key==='ArrowRight'?snap:-snap))});}}}><strong>{clip.name}</strong><small>{((clip.trimOutMs-clip.trimInMs)/1000).toFixed(2)} s</small><span className="clip-resize" aria-label={`Resize ${kind} clip`} onPointerDown={e=>beginAsset(e,clip,kind,true)} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelPointer}/></div>)}
              </div></div>)}
              {Array.from({ length: laneCount }, (_, lane) => (
                <div key={lane} className="timeline-lane-row">
                  <div className={`lane-label fx-lane-label ${selectedLane===lane?'selected':''}`}><button aria-label={`Select FX lane ${lane+1}`} aria-pressed={selectedLane===lane} onClick={()=>setSelectedLane(lane)}>FX {lane + 1}</button><button aria-label={`Mute FX lane ${lane+1}`} aria-pressed={(timeline.mutedLanes??[]).includes(lane)} onClick={()=>{const muted=timeline.mutedLanes??[];edit({...timeline,mutedLanes:muted.includes(lane)?muted.filter(l=>l!==lane):[...muted,lane]});}}>{(timeline.mutedLanes??[]).includes(lane)?'Muted':'On'}</button></div>
                  <div
                    data-lane={lane}
                    onPointerDown={seekPointer}
                    className={`timeline-lane ${(timeline.mutedLanes??[]).includes(lane)?'lane-muted':''} ${selectedLane===lane?'lane-selected':''}`}
                    style={
                      {
                        width: totalBars * zoom,
                        "--bar-width": `${zoom}px`,
                        "--beat-width": `${zoom / timeline.beatsPerBar}px`,
                        "--subdivision-width": `${zoom / (timeline.beatsPerBar * 4)}px`,
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
                            className={`timeline-clip ${(selectedId === c.id || selectedIds.has(c.id)) ? "selected" : ""} ${c.enabled ? "" : "muted"}`}
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
                            onPointerCancel={cancelPointer}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { setSelectedId(c.id); seek(c.startBar); }
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
                              onPointerCancel={cancelPointer}
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
              <div
                className="timeline-playhead"
                role="slider" tabIndex={0} aria-label="Timeline playhead" aria-valuemin={1} aria-valuemax={totalBars} aria-valuenow={cursor + 1}
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { kind:'playhead', id:'playhead', x:e.clientX, start:cursorRef.current, length:0, lane:0, nextLane:0, before:timeline }; }}
                onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={e => { drag.current=null; if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId); }}
                onKeyDown={e => { if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(steppedBar(cursorRef.current,e.key==='ArrowRight'?1:-1,timeline.beatsPerBar,e.shiftKey));} }}
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
            {(selectedVideo || selectedTake) && (()=>{
              const clip=(selectedVideo??selectedTake)!,kind=selectedVideo?'video':'take';
              return <><strong>{clip.name}</strong><label>Start bar<input aria-label="Asset clip start bar" type="number" min={1} step={.25} value={clip.startBar+1} onChange={e=>assetChange(kind,clip.id,{startBar:Math.max(0,Number(e.target.value)-1)})}/></label>
              <label>Trim in seconds<input aria-label="Asset clip trim in" type="number" min={0} max={(clip.trimOutMs-1)/1000} step={.01} value={Number((clip.trimInMs/1000).toFixed(3))} onChange={e=>{const trimInMs=clamp(Number(e.target.value)*1000,0,clip.trimOutMs-1);assetChange(kind,clip.id,{trimInMs,lengthBars:(clip.trimOutMs-trimInMs)/msPerBar});}}/></label>
              <label>Trim out seconds<input aria-label="Asset clip trim out" type="number" min={(clip.trimInMs+1)/1000} max={clip.durationMs/1000} step={.01} value={Number((clip.trimOutMs/1000).toFixed(3))} onChange={e=>{const trimOutMs=clamp(Number(e.target.value)*1000,clip.trimInMs+1,clip.durationMs);assetChange(kind,clip.id,{trimOutMs,lengthBars:(trimOutMs-clip.trimInMs)/msPerBar});}}/></label>
              <button onClick={()=>assetChange(kind,clip.id,{trimInMs:0,trimOutMs:clip.durationMs,lengthBars:clip.durationMs/msPerBar})}>Reset clip trim</button><button aria-pressed={clip.enabled} onClick={()=>assetChange(kind,clip.id,{enabled:!clip.enabled})}>{clip.enabled?'Mute clip':'Enable clip'}</button>
              <button onClick={()=>edit(kind==='video'?{...timeline,videoClips:timeline.videoClips?.filter(c=>c.id!==clip.id)}:{...timeline,takeClips:timeline.takeClips?.filter(c=>c.id!==clip.id)})}>Delete asset clip</button></>;
            })()}
            {selectedTake && <section className="take-frame-editor"><strong>Fine tune recorded lighting at playhead</strong><label>DMX channel<input aria-label="Take frame channel" type="number" min={1} max={512} value={takeChannel} onChange={e=>setTakeChannel(Math.round(clamp(Number(e.target.value),1,512)))}/></label><label>Value<input aria-label="Take frame value" type="number" min={0} max={255} value={takeValue} onChange={e=>setTakeValue(Math.round(clamp(Number(e.target.value),0,255)))}/></label><button onClick={()=>{
              const timeMs=Math.round(clamp((cursorRef.current-selectedTake.startBar)*msPerBar+selectedTake.trimInMs,0,selectedTake.durationMs));
              const frames=structuredClone(selectedTake.frames);let frame=frames.find(f=>f.timeMs===timeMs);
              if(!frame){frame={timeMs,updates:[]};frames.push(frame);frames.sort((a,b)=>a.timeMs-b.timeMs);}
              frame.updates=frame.updates.filter(([c])=>c!==takeChannel);frame.updates.push([takeChannel,takeValue]);assetChange('take',selectedTake.id,{frames});
            }}>Set channel at playhead</button><small>The source take is preserved. FX clips can overlay this version.</small></section>}

            {audioUrl && audioDurationMs > 0 && <>
              <label>Trim in (seconds)<input aria-label="Trim in seconds" type="number" min={0} max={Math.max(0, (bounds.endMs - 10) / 1000)} step={0.01} value={bounds.startMs / 1000} disabled={playing}
                onChange={e => edit({ ...timeline, audioTrimInMs: clamp(Number(e.target.value) * 1000, 0, bounds.endMs - 10) })} /></label>
              <label>Trim out (seconds)<input aria-label="Trim out seconds" type="number" min={(bounds.startMs + 10) / 1000} max={audioDurationMs / 1000} step={0.01} value={bounds.endMs / 1000} disabled={playing}
                onChange={e => edit({ ...timeline, audioTrimOutMs: clamp(Number(e.target.value) * 1000, bounds.startMs + 10, audioDurationMs) })} /></label>
              <button disabled={playing || (!timeline.audioTrimInMs && timeline.audioTrimOutMs === undefined)} onClick={() => edit({ ...timeline, audioTrimInMs: undefined, audioTrimOutMs: undefined })}>Reset Trim</button>
            </>}
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
            write the same channel. Linked song media and non-destructive trims restore automatically on this computer. Click empty lanes or the waveform to seek. Alt-drag media to move it. Arrow keys step beats; Shift steps bars.{" "}
            {audioError}
          </p>
        </main>
      </ResizableWorkspace>
    </div>
  );
}
