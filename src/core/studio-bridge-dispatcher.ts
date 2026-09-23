import type { StudioBridgeResult, StudioSongIdentity } from './studio-bridge-protocol';
import { assertStudioBridgeCommand, STUDIO_BRIDGE_PROTOCOL } from './studio-bridge-protocol';
import { resolveStudioBinding, saveStudioBinding } from './studio-bindings';

export type StudioBridgeActions = {
  createShow: (identity: StudioSongIdentity) => Promise<string> | string;
  loadShow: (showId: string) => Promise<void> | void;
  goCue: (cueId?: string) => Promise<void> | void;
  fireScene: (sceneId: string) => Promise<void> | void;
  startEffect: (effectId: string) => Promise<void> | void;
  stopEffect: (effectId: string) => Promise<void> | void;
  startRecording: (songId: string, songTitle: string, bpm: number) => Promise<void> | void;
  stopRecording: () => Promise<void> | void;
  playRecording: (recordingId: string, offsetMs: number) => Promise<void> | void;
  stopRecordingPlayback: () => Promise<void> | void;
  setBlackout: (enabled: boolean) => Promise<void> | void;
  syncTransport: (playing: boolean, positionMs: number, bpm: number) => Promise<void> | void;
};

export class StudioBridgeDispatcher {
  constructor(private readonly actions: StudioBridgeActions) {}

  async dispatch(id: string, command: unknown): Promise<StudioBridgeResult> {
    try {
      assertStudioBridgeCommand(command);
      switch (command.type) {
        case 'hello':
          if (command.protocol !== STUDIO_BRIDGE_PROTOCOL) throw new Error(`Studio bridge protocol ${command.protocol} is not supported.`);
          return { id, ok: true, payload: { protocol: STUDIO_BRIDGE_PROTOCOL, app: 'LumaRig' } };
        case 'song.resolve': {
          const identity: StudioSongIdentity = command;
          const existing = resolveStudioBinding(identity);
          if (existing) {
            await this.actions.loadShow(existing.lumarigShowId);
            return { id, ok: true, payload: existing };
          }
          if (!command.createIfMissing) return { id, ok: true, payload: null };
          const lumarigShowId = await this.actions.createShow(identity);
          const binding = saveStudioBinding(identity, lumarigShowId);
          await this.actions.loadShow(lumarigShowId);
          return { id, ok: true, payload: binding };
        }
        case 'show.load': await this.actions.loadShow(command.lumarigShowId); break;
        case 'cue.go': await this.actions.goCue(command.cueId); break;
        case 'scene.fire': await this.actions.fireScene(command.sceneId); break;
        case 'fx.start': await this.actions.startEffect(command.effectId); break;
        case 'fx.stop': await this.actions.stopEffect(command.effectId); break;
        case 'record.start': await this.actions.startRecording(command.songId, command.songTitle, command.bpm); break;
        case 'record.stop': await this.actions.stopRecording(); break;
        case 'record.play': await this.actions.playRecording(command.recordingId, command.offsetMs ?? 0); break;
        case 'record.stopPlayback': await this.actions.stopRecordingPlayback(); break;
        case 'blackout': await this.actions.setBlackout(command.enabled); break;
        case 'transport': await this.actions.syncTransport(command.playing, command.positionMs, command.bpm); break;
      }
      return { id, ok: true };
    } catch (error) {
      return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
