import { applyUniverseUpdates, makeUniverse, type DmxUpdate } from '../lib/dmx';
export { cueChanges } from './cue-engine';

export type TrackedCue = {
  id: string;
  changes: ReadonlyArray<DmxUpdate>;
};

export function resolveTrackedCueFrame(
  cues: readonly TrackedCue[],
  targetIndex: number,
  initialFrame: readonly number[] = makeUniverse()
): number[] {
  const lastIndex = Math.min(Math.max(-1, Math.floor(targetIndex)), cues.length - 1);
  let frame = [...initialFrame];
  for (let index = 0; index <= lastIndex; index += 1) {
    frame = applyUniverseUpdates(frame, cues[index].changes);
  }
  return frame;
}

export function blockTrackedChannels(
  inherited: readonly number[],
  changes: ReadonlyArray<DmxUpdate>,
  blockedChannels: ReadonlySet<number>
): number[] {
  return applyUniverseUpdates(
    inherited,
    changes.filter(([channel]) => !blockedChannels.has(channel))
  );
}
