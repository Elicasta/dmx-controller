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

/** Network input is untrusted even when TypeScript callers use the command union. */
export function assertStudioBridgeCommand(value: unknown): asserts value is StudioBridgeCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Studio command.');
  const command = value as Record<string, unknown>;
  const text = (key: string) => { if (typeof command[key] !== 'string' || !(command[key] as string).trim() || (command[key] as string).length > 1024) throw new Error(`Invalid ${key}.`); };
  const number = (key: string, minimum: number, exclusive = false) => { if (typeof command[key] !== 'number' || !Number.isFinite(command[key]) || (exclusive ? command[key] as number <= minimum : command[key] as number < minimum)) throw new Error(`Invalid ${key}.`); };
  const boolean = (key: string) => { if (typeof command[key] !== 'boolean') throw new Error(`Invalid ${key}.`); };
  switch (command.type) {
    case 'hello': number('protocol', 1); text('clientName'); break;
    case 'song.resolve': text('studioShowId'); text('studioShowName'); text('songId'); text('songTitle'); number('bpm', 0, true); boolean('createIfMissing'); break;
    case 'show.load': text('lumarigShowId'); break;
    case 'cue.go': if (command.cueId !== undefined) text('cueId'); break;
    case 'scene.fire': text('sceneId'); break;
    case 'fx.start': case 'fx.stop': text('effectId'); break;
    case 'record.start': text('songId'); text('songTitle'); number('bpm', 0, true); break;
    case 'record.play': text('recordingId'); if (command.offsetMs !== undefined) number('offsetMs', 0); break;
    case 'record.stop': case 'record.stopPlayback': break;
    case 'blackout': boolean('enabled'); break;
    case 'transport': boolean('playing'); number('positionMs', 0); number('bpm', 0, true); break;
    default: throw new Error('Unsupported Studio command.');
  }
}
