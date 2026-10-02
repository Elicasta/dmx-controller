import type { PatchedFixture } from './fixtures';
import { describe, it, expect } from 'vitest';
import { cueContext, cueTargetIds } from './show-selection';
import type { ShowFile, ShowCue } from './show';
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

const fixtures=[{id:'a',profileId:'adj-mega-par-profile-plus',modeId:'ch05',address:1}, {id:'b',profileId:'adj-mega-par-profile-plus',modeId:'ch05',address:7}] as PatchedFixture[];
describe('cue target authority',()=>{
  it('focuses the fixture addressed by sparse tracked instructions',()=>expect(cueTargetIds(show,{changes:[[7,255]]} as unknown as ShowCue,fixtures,[])).toEqual(['b']));
  it('includes every enabled FX layer but ignores stale and disabled targets',()=>expect(cueTargetIds(show,{effectStack:[{targetIds:['gone','b']},{targetIds:['a'],enabled:false}]} as ShowCue,fixtures,[])).toEqual(['b']));
  it('includes static targets alongside independently targeted FX',()=>expect(cueTargetIds(show,{changes:[[7,255]],effectStack:[{targetIds:['a']}]} as unknown as ShowCue,fixtures,[])).toEqual(['a','b']));
  it('selects the patch for a full legacy frame',()=>expect(cueTargetIds(show,{universe:Array(512).fill(0)} as ShowCue,fixtures,[])).toEqual(['a','b']));
  it('keeps primary fixture focus stable when FX layer order changes',()=>expect(cueTargetIds(show,{effectStack:[{targetIds:['b']},{targetIds:['a']}]} as unknown as ShowCue,fixtures,[])).toEqual(['a','b']));
  it('clears target selection for a cue with no fixture instructions',()=>expect(cueTargetIds(show,{changes:[]} as unknown as ShowCue,fixtures,[])).toEqual([]));
});
