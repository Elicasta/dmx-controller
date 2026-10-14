import { describe, expect, it } from 'vitest';
import { addSuperScene, insertSuperScene, isSuperScene, saveSuperScene } from './super-scenes';
import { EMPTY_TIMELINE } from './show-design';

const timeline = () => ({...EMPTY_TIMELINE, bpm:72, audioName:'song.mp3',
  clips:[{id:'clip1',cueId:'cue1',startBar:8,lengthBars:4,lane:0,enabled:true},
         {id:'clip2',cueId:'cue2',startBar:12,lengthBars:8,lane:2,enabled:true}]});
describe('reusable linked Super Scenes',()=>{
  it('saves relative clip positions without breaking cue links',()=>{
    const scene=saveSuperScene(' Intro Lift ',timeline(),['cue1','cue2'],new Date('2026-10-14T00:00:00Z'));
    expect(isSuperScene(scene)).toBe(true);
    expect(scene.name).toBe('Intro Lift');
    expect(scene.clips.map(c=>[c.cueId,c.startBar])).toEqual([['cue1',0],['cue2',4]]);
    expect(timeline().clips[0].startBar).toBe(8);
  });
  it('inserts copies with unique clip IDs, retaining linked cue IDs and audio',()=>{
    const source=timeline();
    const scene=saveSuperScene('Lift',source,['cue1','cue2']);
    const next=insertSuperScene(source,scene,['cue1','cue2'],32);
    expect(next.clips).toHaveLength(4);
    expect(next.clips.slice(2).map(c=>c.startBar)).toEqual([32,36]);
    expect(next.clips.slice(2).map(c=>c.cueId)).toEqual(['cue1','cue2']);
    expect(new Set(next.clips.map(c=>c.id)).size).toBe(4);
    expect(next.audioName).toBe('song.mp3');
    expect(next.bpm).toBe(72);
    expect(scene.clips[0].startBar).toBe(0);
  });
  it('replaces lighting timeline only, preserving media/timing',()=>{
    const source={...timeline(),videoClips:[{id:'v',mediaId:'media',name:'video',startBar:0,lengthBars:4,durationMs:1000,trimInMs:0,trimOutMs:1000,enabled:true}]};
    const scene=saveSuperScene('Lift',source,['cue1','cue2']);
    const next=insertSuperScene(source,scene,['cue1','cue2'],0,'replace');
    expect(next.clips).toHaveLength(2);
    expect(next.videoClips).toEqual(source.videoClips);
    expect(next.audioName).toBe(source.audioName);
  });
  it('blocks missing source cues and bad names, duplicates, and invalid timelines',()=>{
    expect(()=>saveSuperScene(' ',timeline(),['cue1','cue2'])).toThrow('Name');
    expect(()=>saveSuperScene('One',timeline(),['cue1'])).toThrow('missing');
    const scene=saveSuperScene('Lift',timeline(),['cue1','cue2']);
    expect(()=>insertSuperScene(timeline(),scene,['cue1'],16)).toThrow('missing');
    expect(()=>addSuperScene([scene],{...scene,id:'other'})).toThrow('already exists');
    expect(isSuperScene({...scene,clips:[{...scene.clips[0],lengthBars:-1}]})).toBe(false);
  });
});
