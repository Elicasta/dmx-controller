import {it,expect} from 'vitest';
import {activeVideoClip} from './timeline-assets';
import {EMPTY_TIMELINE} from './show-design';
it('routes the active trimmed video clip and blacks out feed gaps deterministically',()=>{
 const clip={id:'one',mediaId:'media',name:'video.mp4',startBar:1,lengthBars:2,durationMs:10000,trimInMs:1000,trimOutMs:5000,enabled:true};
 const timeline={...EMPTY_TIMELINE,bpm:120,videoClips:[clip]};
 expect(activeVideoClip(timeline,1999)).toBeNull();expect(activeVideoClip(timeline,2500)?.position).toBe(1.5);
 expect(activeVideoClip(timeline,6000)).toBeNull();expect(activeVideoClip({...timeline,videoClips:[{...clip,enabled:false}]},3000)).toBeNull();
 const top={...clip,id:'two',startBar:2,trimInMs:0};expect(activeVideoClip({...timeline,videoClips:[clip,top]},4500)?.clip.id).toBe('two');
});
