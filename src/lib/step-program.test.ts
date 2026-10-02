import {describe,expect,it} from 'vitest';
import {createStepProgram,stepCount,stepValue,setStepValue,resizeStepProgram,clearStepProgram,copyStep,pasteStep} from './step-program';
import {renderCustomEffect} from './effects';
import {DEFAULT_PATCH,parameterChannel} from './fixtures';
import {isEffectRecipe} from './show-design';
describe('musical step programming',()=>{
  it('produces independent beat hits, color and fixture parameter steps',()=>{
    let effect=createStepProgram(120,'#ff0000');
    effect=setStepValue(effect,'dimmer',0,100);
    effect=setStepValue(effect,'dimmer',1,25);
    effect.colorPalette![1]='#0000ff';
    const fixture={...DEFAULT_PATCH[0],selected:true};
    const first=new Map(renderCustomEffect(effect,[fixture],0));
    const second=new Map(renderCustomEffect(effect,[fixture],250));
    expect(first.get(parameterChannel(fixture,'dimmer')!)).toBe(255);
    expect(second.get(parameterChannel(fixture,'dimmer')!)).toBeCloseTo(64,0);
    expect(first.get(parameterChannel(fixture,'red')!)).toBe(255);
    expect(second.get(parameterChannel(fixture,'red')!)).toBe(0);
    expect(isEffectRecipe(effect)).toBe(true);
  });
  it('aligns subdivisions to the same beat and extends without inserting new hits',()=>{
    let effect=setStepValue(createStepProgram(120,'#ffffff'),'dimmer',2,100);
    effect=resizeStepProgram(effect,8,4);
    expect(stepCount(effect)).toBe(32);
    expect(stepValue(effect,'dimmer',4)).toBe(100);
    expect(stepValue(effect,'dimmer',16)).toBe(0);
    expect(()=>resizeStepProgram(effect,32,16)).toThrow('64 steps');
  });
  it('copies all enabled parameters and color without aliasing the source',()=>{
    const source=setStepValue(setStepValue(createStepProgram(120,'#ff0000'),'dimmer',0,100),'strobe',0,40);
    const pasted=pasteStep(source,3,copyStep(source,0));
    expect(stepValue(pasted,'dimmer',3)).toBe(100);
    expect(stepValue(pasted,'strobe',3)).toBe(40);
    expect(stepValue(source,'dimmer',3)).toBe(0);
    expect(clearStepProgram(pasted).lanes!.every(l=>l.steps!.every(s=>s.value===0))).toBe(true);
  });
  it('overlays an embedded FX trigger only on its assigned step',()=>{
    const trigger={
      id:'step-hit',name:'Step Hit',parameter:'dimmer' as const,waveform:'square' as const,
      bpm:120,depth:0,offset:100,phaseSpread:0,cycleBeats:1,mode:'absolute' as const
    };
    const effect={...createStepProgram(120,'#ffffff'),stepTriggers:[{step:0,name:'Step Hit',effect:trigger}]};
    const fixture={...DEFAULT_PATCH[0],selected:true};
    const dimmer=parameterChannel(fixture,'dimmer')!;
    const first=new Map(renderCustomEffect(effect,[fixture],0));
    const second=new Map(renderCustomEffect(effect,[fixture],260));
    expect(first.get(dimmer)).toBe(255);
    expect(second.get(dimmer)).toBe(0);
    expect(isEffectRecipe(effect)).toBe(true);
  });
  it('keeps triplets and sixteenth steps in the persisted effect model',()=>{
    for(const subdivision of [3,16]){
      const effect=resizeStepProgram(createStepProgram(130,'#ff0000'),4,subdivision);
      expect(stepCount(effect)).toBe(4*subdivision);
      expect(isEffectRecipe(effect)).toBe(true);
    }
  });
});
