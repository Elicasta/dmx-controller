import { describe, expect, it, vi } from 'vitest';
import { StudioBridgeDispatcher, type StudioBridgeActions } from './studio-bridge-dispatcher';

function actions(): StudioBridgeActions {
  return {
    createShow: vi.fn(() => 'show-new'),
    loadShow: vi.fn(),
    goCue: vi.fn(),
    fireScene: vi.fn(),
    startEffect: vi.fn(),
    stopEffect: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    playRecording: vi.fn(),
    stopRecordingPlayback: vi.fn(),
    setBlackout: vi.fn(),
    syncTransport: vi.fn()
  };
}

describe('StudioBridgeDispatcher', () => {
  it('handshakes protocol 1', async () => {
    const dispatcher = new StudioBridgeDispatcher(actions());
    expect(await dispatcher.dispatch('a', { type: 'hello', protocol: 1, clientName: 'Studio' })).toMatchObject({ id: 'a', ok: true });
  });

  it('routes blackout without exposing DMX', async () => {
    const target = actions();
    const dispatcher = new StudioBridgeDispatcher(target);
    expect((await dispatcher.dispatch('b', { type: 'blackout', enabled: true })).ok).toBe(true);
    expect(target.setBlackout).toHaveBeenCalledWith(true);
  });

  it('routes Studio transport into external synchronization', async () => {
    const target = actions();
    const dispatcher = new StudioBridgeDispatcher(target);
    await dispatcher.dispatch('c', { type: 'transport', playing: true, positionMs: 12500, bpm: 72 });
    expect(target.syncTransport).toHaveBeenCalledWith(true, 12500, 72, undefined);
  });

  it('passes route identity and rejects invalid transport without dispatching', async () => {
    const target = actions();
    const dispatcher = new StudioBridgeDispatcher(target);
    await dispatcher.dispatch('route', {type:'transport',playing:true,positionMs:500,bpm:130,source:'ableton'});
    expect(target.syncTransport).toHaveBeenCalledWith(true,500,130,'ableton');
    const result = await dispatcher.dispatch('invalid',{type:'transport',playing:true,positionMs:-1,bpm:130});
    expect(result.ok).toBe(false);
    expect(target.syncTransport).toHaveBeenCalledTimes(1);
  });

  it('rejects incompatible bridge protocol', async () => {
    const dispatcher = new StudioBridgeDispatcher(actions());
    const result = await dispatcher.dispatch('d', { type: 'hello', protocol: 99, clientName: 'Future' });
    expect(result.ok).toBe(false);
  });
});
