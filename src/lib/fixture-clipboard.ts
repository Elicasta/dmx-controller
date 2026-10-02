import {fixtureEndAddress,type PatchedFixture} from './fixtures';
/** Allocate the entire paste first; never overlap addresses or partially paste. */
export function pasteFixtures(existing:readonly PatchedFixture[],copied:readonly PatchedFixture[]):PatchedFixture[]{
  const next=structuredClone([...existing]);
  for(const source of copied){
    const copy={...structuredClone(source),id:crypto.randomUUID(),name:source.name+' copy',selected:true};
    const size=fixtureEndAddress(source)-source.address+1;
    let address=1;
    for(;address+size-1<=512;address++)if(!next.some(f=>(f.universe??1)===(copy.universe??1)&&address<=fixtureEndAddress(f)&&address+size-1>=f.address))break;
    if(address+size-1>512)throw Error('Not enough free DMX addresses to paste these fixtures. The patch is unchanged.');
    next.push({...copy,address});
  }
  return next;
}
