import type { ShowTimeline, TimelineClip } from './show-design';

/** Portable within one show. Linked cues retain their IDs when inserted. */
export type SuperScene = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clips: TimelineClip[];
};

const LIMIT = 100;

export function isSuperScene(value: unknown): value is SuperScene {
  if (!value || typeof value !== 'object') return false;
  const scene = value as Partial<SuperScene>;
  return typeof scene.id === 'string' && scene.id.length > 0 && scene.id.length <= 100 &&
    typeof scene.name === 'string' && scene.name.trim().length > 0 && scene.name.length <= 100 &&
    typeof scene.createdAt === 'string' && !Number.isNaN(Date.parse(scene.createdAt)) &&
    typeof scene.updatedAt === 'string' && !Number.isNaN(Date.parse(scene.updatedAt)) &&
    Array.isArray(scene.clips) && scene.clips.length > 0 && scene.clips.length <= 1000 &&
    scene.clips.every(clip=>Boolean(clip) && typeof clip.id==='string' &&
      typeof clip.cueId==='string' && clip.cueId.length>0 &&
      Number.isFinite(clip.startBar) && clip.startBar>=0 &&
      Number.isFinite(clip.lengthBars) && clip.lengthBars>0 &&
      Number.isSafeInteger(clip.lane) && clip.lane>=0 && clip.lane<8 &&
      typeof clip.enabled==='boolean');
}

export function saveSuperScene(name: string, timeline: ShowTimeline, cueIds: readonly string[], now = new Date()): SuperScene {
  const title = name.trim().slice(0,100);
  if (!title) throw new Error('Name the Super Scene before saving.');
  if (!timeline.clips.length) throw new Error('Add a cue or FX clip to the timeline first.');
  if (timeline.clips.length > 1000) throw new Error('Super Scene exceeds the 1,000 clip limit.');
  const valid = new Set(cueIds);
  if (timeline.clips.some(c=>!valid.has(c.cueId))) throw new Error('A timeline clip references a missing cue. Repair it before saving.');
  if (timeline.clips.some(c=>c.lane<0 || c.lane>=8)) throw new Error('A Super Scene supports up to eight FX lanes.');
  const clips = structuredClone(timeline.clips);
  const earliest = Math.min(...clips.map(c=>c.startBar));
  return {id:crypto.randomUUID(),name:title,createdAt:now.toISOString(),updatedAt:now.toISOString(),
    clips:clips.map(c=>({...c,startBar:c.startBar-earliest}))};
}

export function insertSuperScene(
  timeline: ShowTimeline,
  scene: SuperScene,
  cueIds: readonly string[],
  atBar: number,
  mode: 'append' | 'replace' = 'append',
): ShowTimeline {
  if (!isSuperScene(scene)) throw new Error('Invalid saved Super Scene.');
  const valid = new Set(cueIds);
  const missing = [...new Set(scene.clips.filter(c=>!valid.has(c.cueId)).map(c=>c.cueId))];
  if (missing.length) throw new Error(`Cannot insert Super Scene: ${missing.length} source cue(s) are missing from this show.`);
  if (!Number.isFinite(atBar) || atBar<0) throw new Error('Invalid insertion bar.');
  const anchor = Math.min(...scene.clips.map(c=>c.startBar));
  const clips = scene.clips.map(c=>({...structuredClone(c),id:crypto.randomUUID(),
    startBar:Math.max(0,atBar)+c.startBar-anchor}));
  const existing = mode==='replace' ? [] : timeline.clips;
  if (existing.length+clips.length>1000) throw new Error('Timeline would exceed the 1,000 clip limit.');
  return {...timeline,clips:[...existing,...clips]};
}

export function addSuperScene(library: readonly SuperScene[], scene: SuperScene): SuperScene[] {
  if (library.length>=LIMIT) throw new Error('A show can contain at most 100 Super Scenes.');
  if (library.some(item=>item.name.toLocaleLowerCase()===scene.name.toLocaleLowerCase()))
    throw new Error('A Super Scene with that name already exists. Choose another name.');
  return [...library,scene];
}
