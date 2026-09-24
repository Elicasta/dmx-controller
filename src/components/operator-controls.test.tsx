// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorDeck, VerticalFader } from './ConsoleComponents';
import { ColorPaletteLibrary } from './ColorPaletteLibrary';
let host: HTMLDivElement; let root: Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
describe('operator controls',()=>{
 it('wheel keyboard input drives a new actual color',()=>{const changed=vi.fn();act(()=>root.render(<ColorDeck title="Color" subtitle="Selected" color="#ff0000" presets={[]} onChange={changed}/>));act(()=>host.querySelector('[role=slider]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));expect(changed).toHaveBeenCalledWith('#ff2a00');});
 it('disabled wheel cannot emit colors',()=>{const changed=vi.fn();act(()=>root.render(<ColorDeck title="Color" subtitle="None" color="#ff0000" disabled presets={[]} onChange={changed}/>));act(()=>host.querySelector('[role=slider]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(changed).not.toHaveBeenCalled();expect((host.querySelector('input') as HTMLInputElement).disabled).toBe(true);});
 it('fader programmer value stays distinct from resolved output',()=>{act(()=>root.render(<VerticalFader id="one" name="Key" subtitle="PAR" color="#ffffff" value={80} outputValue={0} selected onChange={()=>{}} onSelect={()=>{}} onFx={()=>{}}/>));expect((host.querySelector('input') as HTMLInputElement).value).toBe('80');expect(host.querySelector('[role=meter]')?.getAttribute('aria-valuenow')).toBe('0');expect(host.textContent).toContain('OUT 0%');});
 it('recalls, updates and reorders saved palettes through real callbacks',()=>{const changed=vi.fn(),recall=vi.fn();const palettes=[{id:'a',name:'Blue',color:'#0000ff',folder:''},{id:'b',name:'Red',color:'#ff0000',folder:''}];act(()=>root.render(<ColorPaletteLibrary palettes={palettes} color="#ffffff" disabled={false} onChange={changed} onRecall={recall}/>));act(()=> (host.querySelector('[aria-label="Recall Blue"]') as HTMLButtonElement).click());expect(recall).toHaveBeenCalledWith('#0000ff');act(()=>(host.querySelector('[aria-label="Move Blue down"]') as HTMLButtonElement).click());expect(changed).toHaveBeenCalledWith([palettes[1],palettes[0]]);const update=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Update color')!;act(()=>update.click());expect(changed.mock.lastCall?.[0][0].color).toBe('#ffffff');});
});
