export type Hsv = { h: number; s: number; v: number };
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export function hexToHsv(hex: string): Hsv {
  const rgb = /^#[\da-f]{6}$/i.test(hex) ? [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) : [0,0,0];
  const [r,g,b]=rgb, max=Math.max(...rgb), min=Math.min(...rgb), d=max-min;
  const h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:(h*60+360)%360,s:max===0?0:d/max,v:max};
}
export function hsvToHex({h,s,v}:Hsv):string {
  h=((h%360)+360)%360;s=clamp(s);v=clamp(v);
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
export function wheelColor(x:number,y:number):Pick<Hsv,'h'|'s'> {
  return {h:(Math.atan2(y,x)*180/Math.PI+90+360)%360,s:Math.min(1,Math.hypot(x,y))};
}
export type ColorPalette = { id:string; name:string; color:string; folder:string };
export function isColorPalette(value:unknown):value is ColorPalette {
  if (!value || typeof value!=='object') return false;
  const p=value as ColorPalette;
  return typeof p.id==='string' && !!p.id && typeof p.name==='string' && !!p.name.trim() && typeof p.folder==='string' && typeof p.color==='string' && /^#[\da-f]{6}$/i.test(p.color);
}
