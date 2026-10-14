import { describe, expect, it } from 'vitest';
import { DEFAULT_QLC_URL, QlcWebSocketBridge, encodeQlcCommand, parseQlcEvent, validateQlcUrl } from './qlc-websocket';

describe('QLC+ bridge protocol', () => {
  it('encodes official API commands, not fabricated JSON', () => {
    expect(encodeQlcCommand({type:'function',id:7,running:true})).toBe('QLC+API|setFunctionStatus|7|1');
    expect(encodeQlcCommand({type:'function',id:7,running:false})).toBe('QLC+API|setFunctionStatus|7|0');
    expect(encodeQlcCommand({type:'widget',id:12,value:255})).toBe('12|255');
    expect(encodeQlcCommand({type:'cue-list',id:18,action:'NEXT'})).toBe('18|NEXT');
    expect(encodeQlcCommand({type:'grand-master',value:0})).toBe('GM_VALUE|0');
    expect(encodeQlcCommand({type:'query',target:'widgets'})).toBe('QLC+API|getWidgetsList');
  });
  it('rejects invalid IDs and out-of-range values instead of transmitting them', () => {
    expect(()=>encodeQlcCommand({type:'widget',id:-1,value:0})).toThrow();
    expect(()=>encodeQlcCommand({type:'widget',id:1,value:256})).toThrow();
    expect(()=>encodeQlcCommand({type:'widget',id:1,value:NaN})).toThrow();
    expect(()=>encodeQlcCommand({type:'function',id:1.2,running:true})).toThrow();
  });
  it('accepts local endpoints and rejects untrusted network targets', () => {
    expect(validateQlcUrl(DEFAULT_QLC_URL)).toBe(DEFAULT_QLC_URL);
    expect(()=>validateQlcUrl('ws://192.168.1.2:9999/qlcplusWS')).toThrow();
    expect(()=>validateQlcUrl('ws://evil.test:9999/qlcplusWS')).toThrow();
    expect(()=>validateQlcUrl('ws://127.0.0.1:9999/anything')).toThrow();
  });
  it('parses master and status feedback, ignoring malformed frames', () => {
    expect(parseQlcEvent('GM_VALUE|140|55%')).toEqual({type:'grand-master',value:140});
    expect(parseQlcEvent('QLC+API|getFunctionStatus|3|Running')).toEqual({type:'function-status',id:3,running:true});
    expect(parseQlcEvent('QLC+API|getFunctionStatus|3|Stopped')).toEqual({type:'function-status',id:3,running:false});
    expect(parseQlcEvent('QLC+API|getWidgetStatus|9|255')).toEqual({type:'widget-status',id:9,value:'255'});
    expect(parseQlcEvent('QLC+API|isProjectLoaded|true')).toEqual({type:'project-loaded',loaded:true});
    expect(parseQlcEvent('QLC+API|getFunctionsList|7|Worship|18|Altar|')).toEqual({
      type:'functions-list', functions:[{id:7,name:'Worship'},{id:18,name:'Altar'}],
    });
    expect(parseQlcEvent('GM_VALUE|NaN')).toBeNull();
    expect(parseQlcEvent('random')).toBeNull();
  });
  it('refuses to send while offline (no hidden software fallback)', () => {
    const bridge = new QlcWebSocketBridge();
    expect(bridge.status).toBe('disconnected');
    expect(()=>bridge.send({type:'grand-master',value:0})).toThrow('disconnected');
  });

  it('preserves fader levels and releases momentary holds on reconnect', () => {
    class FakeSocket {
      readyState = 0;
      sent: string[] = [];
      listeners = new Map<string, Array<() => void>>();
      addEventListener(event: string, cb: () => void) {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
      }
      send(message: string) { this.sent.push(message); }
      close() { this.readyState = 3; }
      emit(event: string) { for(const cb of this.listeners.get(event) ?? []) cb(); }
    }
    const a = new FakeSocket(), b = new FakeSocket();
    let next = 0;
    const bridge = new QlcWebSocketBridge(() => [a, b][next++] as unknown as WebSocket);
    const statuses: string[] = [];
    bridge.connect(status => statuses.push(status), () => {});
    a.readyState = 1; a.emit('open');
    bridge.send({type:'widget',id:2,value:200});
    bridge.send({type:'widget',id:3,value:255,momentary:true});
    a.readyState = 3; a.emit('close');
    bridge.connect(status=>statuses.push(status),()=>{});
    b.readyState = 1; b.emit('open');
    expect(b.sent).toContain('3|0');
    expect(b.sent).not.toContain('2|0');
    expect(statuses).toContain('disconnected');
    expect(bridge.status).toBe('connected');
    bridge.disconnect();
    expect(bridge.status).toBe('disconnected');
  });
});
