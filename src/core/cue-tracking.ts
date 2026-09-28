import { applyUniverseUpdates, makeUniverse, type DmxUpdate } from '../lib/dmx';

export type TrackedCue = {
  id: string;
  changes: ReadonlyArray<DmxUpdate>;
};

export function cueChanges(previous: readonly number[], next: readonly number[]): DmxUpdate[] {
  const changes: DmxUpdate[] = [];
  for (let index = 0; index < 512; index += 1) {
    const before = previous[index] ?? 0;
    const after = next[index] ?? 0;
    if (before !== after) changes.push([index + 1, after]);
  }
  return changes;
}

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
