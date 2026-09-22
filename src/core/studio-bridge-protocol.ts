export const STUDIO_BRIDGE_PROTOCOL = 1;

export type StudioSongIdentity = {
  studioShowId: string;
  studioShowName: string;
  songId: string;
  songTitle: string;
  bpm: number;
};

export type StudioBridgeCommand =
  | { type: 'hello'; protocol: number; clientName: string }
  | ({ type: 'song.resolve'; createIfMissing: boolean } & StudioSongIdentity)
  | { type: 'show.load'; lumarigShowId: string }
  | { type: 'cue.go'; cueId?: string }
  | { type: 'scene.fire'; sceneId: string }
  | { type: 'fx.start'; effectId: string }
  | { type: 'fx.stop'; effectId: string }
  | { type: 'record.start'; songId: string; songTitle: string; bpm: number }
  | { type: 'record.stop' }
  | { type: 'record.play'; recordingId: string; offsetMs?: number }
  | { type: 'record.stopPlayback' }
  | { type: 'blackout'; enabled: boolean }
  | { type: 'transport'; playing: boolean; positionMs: number; bpm: number };

export type StudioBridgeResult = {
  id: string;
  ok: boolean;
  error?: string;
  payload?: unknown;
};

export type StudioShowBinding = StudioSongIdentity & {
  lumarigShowId: string;
  updatedAt: string;
};

export function studioBindingKey(binding: Pick<StudioSongIdentity, 'studioShowId' | 'songId'>) {
  return `${binding.studioShowId}:${binding.songId}`;
}

export function reusableSongKey(songId: string) {
  return `song:${songId}`;
}
