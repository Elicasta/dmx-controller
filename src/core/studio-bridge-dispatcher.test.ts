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
    syncTransport: vi.fn(),
    syncAbletonSnapshot: vi.fn(),
    syncAbletonTransport: vi.fn()
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

  it('routes Ableton locator snapshots and beat transport without raw DMX', async () => {
    const target = actions();
    const dispatcher = new StudioBridgeDispatcher(target);
    const snapshot = {
      setId: 'live-set',
      setName: 'Sunday',
      bpm: 84,
      beatsPerBar: 4,
      currentBeat: 32,
      playing: true,
      locators: [{ id: 'chorus', name: 'Chorus', beat: 32 }],
    };
    await dispatcher.dispatch('ableton-a', { type: 'ableton.snapshot', snapshot });
    await dispatcher.dispatch('ableton-b', { type: 'ableton.transport', playing: true, currentBeat: 36, bpm: 84, beatsPerBar: 4 });
    expect(target.syncAbletonSnapshot).toHaveBeenCalledWith(snapshot);
    expect(target.syncAbletonTransport).toHaveBeenCalledWith(true, 36, 84, 4);
  });

  it('rejects incompatible bridge protocol', async () => {
    const dispatcher = new StudioBridgeDispatcher(actions());
    const result = await dispatcher.dispatch('d', { type: 'hello', protocol: 99, clientName: 'Future' });
    expect(result.ok).toBe(false);
  });
});
