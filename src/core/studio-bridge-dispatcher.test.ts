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
    expect(target.syncTransport).toHaveBeenCalledWith(true, 12500, 72);
  });

  it('rejects incompatible bridge protocol', async () => {
    const dispatcher = new StudioBridgeDispatcher(actions());
    const result = await dispatcher.dispatch('d', { type: 'hello', protocol: 99, clientName: 'Future' });
    expect(result.ok).toBe(false);
  });
});


describe('untrusted Studio commands', () => {
  it.each([null, [], {}, { type: 'future.command' }, { type: 'blackout', enabled: 'false' }, { type: 'transport', playing: true, positionMs: -1, bpm: 120 }, { type: 'transport', playing: true, positionMs: 0, bpm: NaN }, { type: 'record.play', recordingId: '' }, { type: 'song.resolve', songId: 'partial' }])('rejects malformed input without changing output: %j', async (command) => {
    const target = actions();
    expect((await new StudioBridgeDispatcher(target).dispatch('bad', command)).ok).toBe(false);
    for (const action of Object.values(target)) expect(action).not.toHaveBeenCalled();
  });
});
