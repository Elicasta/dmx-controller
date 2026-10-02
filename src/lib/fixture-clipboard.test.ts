import {it,expect} from 'vitest';
import {pasteFixtures} from './fixture-clipboard';
import {fixtureEndAddress,type PatchedFixture} from './fixtures';
const f:PatchedFixture={id:'f',name:'Wash',profileId:'adj-mega-par-profile-plus',modeId:'ch05',address:1,group:'Wash',selected:true,collapsed:false};
it('pastes fixtures with independent identities into free DMX ranges',()=>{
  const result=pasteFixtures([f],[f,f]);expect(result).toHaveLength(3);expect(result[1].address).toBe(fixtureEndAddress(f)+1);expect(result[2].address).toBe(fixtureEndAddress(result[1])+1);expect(result[1].id).not.toBe(f.id);expect(f.address).toBe(1);
});
it('preserves the original patch if the entire paste will not fit',()=>{
  const all=Array.from({length:Math.floor(512/5)},(_,i)=>({...f,id:String(i),address:1+i*5}));expect(()=>pasteFixtures(all,[f])).toThrow(/unchanged/);expect(all).toHaveLength(102);
});
