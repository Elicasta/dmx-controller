import {it,expect} from 'vitest';
import {recordingSongVersion} from './recording-version';
import {EMPTY_SHOW,isShowFile} from './show';
import {EMPTY_TIMELINE,renderShowTimeline,isShowTimeline} from './show-design';
import {extractSongProgram,isSongProgram} from './song-library';
import {makeUniverse} from './dmx';
it('imports an independent editable Song version while preserving the original recording and media',()=>{
  const song={id:'song',libraryId:'original',name:'Worship',bpm:120,mediaId:'media',mediaName:'song.mp3'};
  const take={id:'take',name:'Take 2',trackName:'song.mp3',durationMs:4000,createdAt:'2026-10-02',frames:[{timeMs:0,updates:[[1,10],[2,25]] as [number,number][]},{timeMs:1000,updates:[[1,200]] as [number,number][]}]};
  const show={...EMPTY_SHOW,name:'Test',songs:[song],cues:[],recordings:[take],timelineShows:[{id:'song',name:'Worship',timeline:{...EMPTY_TIMELINE,bpm:120}}]};
  const result=recordingSongVersion(show,song,take);
  expect(isShowFile(result.show)).toBe(true);expect(result.song.versionOf).toBe('original');expect(result.song.mediaId).toBe('media');expect(result.song.libraryId).not.toBe(song.libraryId);
  const timeline=result.show.timelineShows!.find(t=>t.name===result.song.name)!.timeline;
  expect(new Map(renderShowTimeline(timeline,[],[],1500,makeUniverse())).get(1)).toBe(200);
  timeline.takeClips![0].frames[1].updates[0]=[1,99];
  expect(take.frames[1].updates[0][1]).toBe(200);expect(show.timelineShows).toHaveLength(1);
  expect(isSongProgram({id:result.song.libraryId,savedAt:'today',revision:1,show:extractSongProgram(result.show,result.song)})).toBe(true);
  expect(renderShowTimeline(timeline,[],[],4000,makeUniverse()).every(([,v])=>v===0)).toBe(true);
});
it('rejects corrupt imported take frames and invalid media trim ranges',()=>{
  const t={...EMPTY_TIMELINE,videoClips:[{id:'v',mediaId:'m',name:'v.mp4',startBar:0,lengthBars:1,durationMs:1000,trimInMs:0,trimOutMs:1000,enabled:true}]};
  expect(isShowTimeline(t)).toBe(true);expect(isShowTimeline({...t,videoClips:[{...t.videoClips[0],trimOutMs:2000}]})).toBe(false);
  const takeClips=[{...t.videoClips[0],recordingId:'r',frames:[{timeMs:0,updates:[[513,100]]}]}];expect(isShowTimeline({...t,takeClips})).toBe(false);
});
