import { describe, expect, it } from 'vitest';
import { analyzeTempo, correctedDownbeat } from './tempo-analysis';
import type { Waveform } from './media-waveform';

function pulseWave(bpm:number,bars=16,accentEvery=4):Waveform{
  const beatMs=60000/bpm;
  const durationMs=bars*4*beatMs;
  const sampleMs=10;
  const count=Math.ceil(durationMs/sampleMs);
  const peaks=Array.from({length:count},()=>0.03);
  for(let beat=0;beat<bars*4;beat++){
    const index=Math.round(beat*beatMs/sampleMs);
    const strength=beat%accentEvery===0?1:.65;
    if(index<peaks.length){
      peaks[index]=strength;
      if(index+1<peaks.length)peaks[index+1]=strength*.45;
    }
  }
  return {version:1,durationMs,peaks};
}

describe('tempo analysis',()=>{
  it('detects a steady musical tempo with confidence',()=>{
    const result=analyzeTempo(pulseWave(120));
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
    expect(result.confidence).toBeGreaterThan(.25);
    expect(result.halfBpm).toBeCloseTo(result.bpm/2,1);
    expect(result.doubleBpm).toBeCloseTo(result.bpm*2,1);
  });

  it('returns a downbeat phase close to the accented bar start',()=>{
    const result=analyzeTempo(pulseWave(100));
    const barMs=60000/100*4;
    expect(result.downbeatMs%barMs).toBeLessThan(120);
  });

  it('preserves analysis while manually correcting the downbeat',()=>{
    const original=analyzeTempo(pulseWave(90));
    const corrected=correctedDownbeat(original,1234);
    expect(corrected.bpm).toBe(original.bpm);
    expect(corrected.downbeatMs).toBe(1234);
    expect(corrected.manualDownbeat).toBe(true);
  });
});
