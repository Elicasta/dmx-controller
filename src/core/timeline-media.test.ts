import { describe, expect, it } from 'vitest';
import { EMPTY_TIMELINE } from '../lib/show-design';
import { timelineMediaRange, waveformPeaks, tempoSamples } from './timeline-media';

describe('timeline media timebase', () => {
  it('maps a trimmed source onto its timeline offset', () => {
    expect(timelineMediaRange({...EMPTY_TIMELINE,bpm:120,audioOffsetBars:2,trimInMs:1000,trimOutMs:3000},5000))
      .toEqual({trimInMs:1000,trimOutMs:3000,startMs:4000,endMs:6000});
  });
  it('bounds trims to a shorter replacement media file', () => {
    expect(timelineMediaRange({...EMPTY_TIMELINE,trimInMs:4000,trimOutMs:9000},2000))
      .toMatchObject({trimInMs:2000,trimOutMs:2000,endMs:0});
  });
  it('retains transients between sample strides and in the final sample', () => {
    const left=new Float32Array(1001),right=new Float32Array(1001);
    left[333]=.75;right[1000]=-1;
    expect(waveformPeaks([left,right],2)).toEqual([.75,1]);
  });
  it('analyzes stereo beats without cancelling opposite phases', () => {
    expect(Array.from(tempoSamples([new Float32Array([.5,0]),new Float32Array([-.5,1])]))).toEqual([.5,1]);
  });
});
