import { describe, it, expect } from 'vitest';
import { cueContext } from './show-selection';
import type { ShowFile } from './show';
const clip = (id:string, cueId:string, startBar:number) => ({id,cueId,startBar,lengthBars:4,lane:0,enabled:true});
const timeline = (clips:ReturnType<typeof clip>[]) => ({bpm:130,beatsPerBar:4,audioOffsetBars:0,clips});
const show = { cues:[{id:'chorus',trackName:'Song B'}], timeline:timeline([clip('global','chorus',24)]),
  timelineShows:[{id:'b',name:'Song B',timeline:timeline([clip('second','chorus',16),clip('first','chorus',4)])}] } as ShowFile;
describe('authoritative cue context',()=>{
  it('uses the current timeline and earliest cue instance',()=>expect(cueContext(show,'chorus','b')).toMatchObject({timelineId:'b',clipId:'first',bar:4}));
  it('preserves an explicitly selected repeated clip',()=>expect(cueContext(show,'chorus','', 'second')).toMatchObject({timelineId:'b',clipId:'second',bar:16}));
  it('uses the Song timeline when there is no current matching timeline',()=>expect(cueContext(show,'chorus','missing')).toMatchObject({timelineId:'b',bar:4}));
  it('clears stale clip and position for an unplaced cue',()=>expect(cueContext(show,'missing','b','second')).toMatchObject({timelineId:'',clipId:'',bar:0}));
});
