import { describe, expect, it } from 'vitest';
import { describeFx, filterFxCatalog, fxFamily, FX_FAMILIES } from './fx-catalog';
import { FX_RECIPES } from './show-design';

describe('FX catalog', () => {
  it('keeps all original FX IDs without modifying the source list', () => {
    const before = FX_RECIPES.map(r => r.id);
    const all = filterFxCatalog(FX_RECIPES);
    expect(all.map(r => r.id)).toEqual(before);
    expect(FX_RECIPES.map(r => r.id)).toEqual(before);
  });

  it('classifies dimmer, color, movement, and chase effects', () => {
    expect(fxFamily(FX_RECIPES.find(r => r.id === 'breathe')!)).toBe('Dimmer');
    expect(fxFamily(FX_RECIPES.find(r => r.id === 'ocean')!)).toBe('Color');
    expect(fxFamily(FX_RECIPES.find(r => r.id === 'circle')!)).toBe('Movement');
    expect(fxFamily(FX_RECIPES.find(r => r.id === 'row-chase')!)).toBe('Chase');
    expect(FX_FAMILIES).toContain('Custom');
  });

  it('searches names, descriptions, and effect parameters case-insensitively', () => {
    expect(filterFxCatalog(FX_RECIPES, {query:'sunSET'}).some(r => r.id === 'sunset')).toBe(true);
    expect(filterFxCatalog(FX_RECIPES, {query:'smooth light rolling'}).some(r => r.id === 'wave')).toBe(true);
    expect(filterFxCatalog(FX_RECIPES, {query:'position'}).some(r => r.id === 'circle')).toBe(true);
    expect(filterFxCatalog(FX_RECIPES, {query:'not-a-real-fx'})).toHaveLength(0);
  });

  it('filters saved effects independently of category selection', () => {
    const saved = {...FX_RECIPES[0], id:'custom:my-effect', name:'My Fade', category:'Custom' as const};
    expect(filterFxCatalog([...FX_RECIPES,saved], {savedOnly:true}).map(r => r.id)).toEqual([saved.id]);
    expect(filterFxCatalog([...FX_RECIPES,saved], {family:'Custom', savedOnly:true, query:'fade'}))
      .toEqual([saved]);
    expect(filterFxCatalog(FX_RECIPES, {family:'Movement'}).every(r=>fxFamily(r)==='Movement')).toBe(true);
  });

  it('uses readable generator metadata and never invents timing', () => {
    expect(describeFx(FX_RECIPES.find(r=>r.id==='circle')!)).toContain('circle');
    expect(describeFx(FX_RECIPES.find(r=>r.id==='circle')!)).toContain('8 beats');
    const untimed={...FX_RECIPES[0], effect:{...FX_RECIPES[0].effect, cycleBeats:NaN}};
    expect(describeFx(untimed)).not.toContain('NaN');
  });
});
