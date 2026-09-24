import {expect,it} from 'vitest';
import {hexToHsv,hsvToHex,wheelColor} from './color';
import {EMPTY_SHOW,isShowFile,sanitizeShow} from '../lib/show';
it.each(['#ff0000','#00ff00','#0000ff','#ffffff','#000000','#813af2','#808080'])('round trips %s',hex=>expect(hsvToHex(hexToHsv(hex))).toBe(hex));
it('maps wheel cardinal points and clamps outside drags',()=>{expect(wheelColor(0,-1)).toEqual({h:0,s:1});expect(wheelColor(1,0)).toEqual({h:90,s:1});expect(wheelColor(0,0).s).toBe(0);expect(wheelColor(5,0).s).toBe(1);});
it('persists named organized color palettes in show files',()=>{const show={...EMPTY_SHOW,colorPalettes:[{id:'one',name:'Warm',folder:'Worship',color:'#ff9900'}]};expect(isShowFile(show)).toBe(true);expect(sanitizeShow(JSON.parse(JSON.stringify(show))).colorPalettes).toEqual(show.colorPalettes);});
