import {describe,it,expect} from 'vitest';
import {ManualOverdub,timelineCaptureClip,appendTimelineCapture} from './timeline-capture';
import {EMPTY_TIMELINE,renderShowTimeline,activeTimelineCueId,isShowTimeline} from './show-design';
import {makeUniverse,applyUniverseUpdates} from './dmx';
import type {ShowCue} from './show';
describe('direct Timeline capture and overdub',()=>{
  it('records an explicit unchanged value and leaves untouched automation running',()=>{
    const manual=new ManualOverdub(),base=makeUniverse();
    manual.observe({type:'frame.update',universe:1,updates:[[1,0]]},base,base,base,[]);
    expect(manual.changes(base,base)).toEqual([[1,0]]);
    const automated=applyUniverseUpdates(base,[[1,255],[2,123]]);
    expect(manual.mix(automated).slice(0,2)).toEqual([0,123]);
    expect(manual.changes(base,manual.mix(automated))).toEqual([]);
  });
  it('captures FX channels without freezing unrelated base channels',()=>{
    const manual=new ManualOverdub(),base=makeUniverse();
    manual.observe({type:'playback.layer.set',universe:1,layerId:'fx',priority:30,mode:'ltp',updates:[[7,200]]},base,base,applyUniverseUpdates(base,[[7,200]]),[]);
    expect(manual.changes(base,applyUniverseUpdates(base,[[7,200],[8,88]]))).toEqual([[7,200]]);
    expect(manual.mix(applyUniverseUpdates(base,[[7,25]]))[6]).toBe(25);
  });
  it('writes a new independently editable clip at the starting playhead',()=>{
    const recording={id:'r',name:'Manual',trackName:'',createdAt:'now',durationMs:2000,frames:[{timeMs:0,updates:[[1,150] as [number,number]]}]};
    const clip=timelineCaptureClip(recording,4,120,4),timeline=appendTimelineCapture(EMPTY_TIMELINE,clip);
    expect(clip).toMatchObject({startBar:4,lengthBars:1,mode:'override'});
    clip.frames[0].updates[0][1]=25;expect(recording.frames[0].updates[0][1]).toBe(150);
    expect(isShowTimeline(timeline)).toBe(true);expect(EMPTY_TIMELINE.takeClips).toBeUndefined();
  });
  it('overrides only captured channels after cues and returns to automation outside its span',()=>{
    const cue={id:'c',name:'Base',number:1,fadeMs:0,values:{red:0,green:0,blue:0,uv:0,dimmer:255},changes:[[1,100],[2,200]]} as ShowCue;
    const clip=timelineCaptureClip({id:'r',name:'Overdub',trackName:'',createdAt:'now',durationMs:1000,frames:[{timeMs:0,updates:[[1,55]]}]},0,120,4);
    const t={...EMPTY_TIMELINE,bpm:120,clips:[{id:'c1',cueId:'c',startBar:0,lengthBars:2,lane:0,enabled:true}],takeClips:[clip]};
    expect(new Map(renderShowTimeline(t,[cue],[],500,makeUniverse())).get(1)).toBe(55);
    expect(new Map(renderShowTimeline(t,[cue],[],500,makeUniverse())).get(2)).toBe(200);
    expect(new Map(renderShowTimeline(t,[cue],[],1500,makeUniverse())).get(1)).toBe(100);
  });
  it('muted lanes contribute neither output nor cue authority but keep their clips',()=>{
    const cue={id:'c',name:'Base',number:1,fadeMs:0,values:{red:0,green:0,blue:0,uv:0,dimmer:255},changes:[[1,100]]} as ShowCue;
    const t={...EMPTY_TIMELINE,mutedLanes:[1],clips:[{id:'c1',cueId:'c',startBar:0,lengthBars:2,lane:1,enabled:true}]};
    expect(new Map(renderShowTimeline(t,[cue],[],0,makeUniverse())).get(1)).toBe(0);
    expect(activeTimelineCueId(t,[cue],0)).toBeNull();expect(t.clips).toHaveLength(1);
    expect(isShowTimeline({...t,mutedLanes:[-1]})).toBe(false);
  });
});
