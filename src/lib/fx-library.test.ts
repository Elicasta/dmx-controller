import {it,expect} from 'vitest';
import {fxLibrary} from './fx-library';
import {EFFECT_PRESETS} from './effects';
import {FX_RECIPES,createSection,sectionStack,isShowSection} from './show-design';
import {DEFAULT_PATCH} from './fixtures';
it('shares every factory and saved FX, with independent saved snapshots',()=>{
  const saved={...FX_RECIPES[0].effect,id:'mine',name:'My worship wave'};
  const library=fxLibrary([saved]);
  for(const factory of EFFECT_PRESETS)expect(library.some(r=>r.id==='factory:'+factory.id)).toBe(true);
  for(const recipe of FX_RECIPES)expect(library.some(r=>r.id===recipe.id)).toBe(true);
  const custom=library.find(r=>r.id==='custom:mine')!;
  custom.effect.name='Edited';expect(saved.name).toBe('My worship wave');
});
it('primary saved FX survives removal from the global bank and show roundtrip',()=>{
  const custom={...FX_RECIPES[0].effect,id:'mine',name:'My saved primary'};
  const section={...createSection(),recipeId:'custom:mine',primaryEffect:custom};
  expect(isShowSection(JSON.parse(JSON.stringify(section)))).toBe(true);
  expect(sectionStack(section,DEFAULT_PATCH,[])[0].name).toBe(custom.name);
  expect(isShowSection({...section,primaryEffect:{...custom,bpm:NaN}})).toBe(false);
});
