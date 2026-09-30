import { describe,it,expect } from 'vitest';
import { isShowFile,sanitizeShow,moveSongCues,moveRundownItemCues,resolveShowCueFrame,type ShowCue,type ShowFile } from './show';
const cue=(id:string,song:string,value:number):ShowCue=>({id,number:Number(id),name:id,trackName:song,fadeMs:0,values:{red:0,green:0,blue:0,uv:0,dimmer:value},changes:[[1,value]]});
describe('song organization',()=>{
 it('moves whole songs while preserving resolved cue output',()=>{
  const original=[cue('1','A',40),cue('2','A',70),cue('3','B',90)];
  const moved=moveSongCues(original,'B',-1);
  expect(moved.map(c=>c.id)).toEqual(['3','1','2']);
  expect(moved.map((_,i)=>resolveShowCueFrame(moved,i)[0])).toEqual([90,40,70]);
  expect(moved.map(c=>c.number)).toEqual([1,2,3]);
 });
 it('preserves imported timeline tempo, audio alignment and cue references',()=>{
  const show:ShowFile={version:4,name:'Service',cues:[cue('1','Imported',80)],timelineShows:[{id:'song',name:'Imported',timeline:{bpm:140,beatsPerBar:3,audioOffsetBars:2,audioName:'song.wav',clips:[{id:'clip',cueId:'1',startBar:3,lengthBars:8,lane:0,enabled:true}]}}]};
  expect(isShowFile(show)).toBe(true);
  const saved=sanitizeShow(JSON.parse(JSON.stringify(show)));
  expect(saved.timelineShows).toEqual(show.timelineShows);
 });
  it('keeps section-aware song ordering isolated and persists song/media metadata',()=>{
  const original=[
   {...cue('1','Shared',20),rundownSectionId:'s1',trackKind:'song' as const},
   {...cue('2','Other',40),rundownSectionId:'s1',trackKind:'song' as const},
   {...cue('3','Shared',60),rundownSectionId:'s2',trackKind:'media' as const},
  ];
  const moved=moveRundownItemCues(original,'s1','Other',-1);
  expect(moved.map(c=>c.id)).toEqual(['2','1','3']);
  const show:ShowFile={version:4,name:'Rundown',rundownSections:[{id:'s1',name:'Worship'},{id:'s2',name:'Message'}],cues:moved};
  expect(isShowFile(show)).toBe(true);
  const saved=sanitizeShow(show);
  expect(saved.rundownSections).toEqual(show.rundownSections);
  expect(saved.cues[2].trackKind).toBe('media');
  expect(saved.cues[2].rundownSectionId).toBe('s2');
 });
 it('rejects malformed imported timelines',()=>{
  expect(isShowFile({version:4,name:'Bad',cues:[],timelineShows:[{id:'x',name:'Bad',timeline:{bpm:0}}]})).toBe(false);
 });
});
