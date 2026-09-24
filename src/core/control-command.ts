import type { EffectId } from '../lib/effects';
import type { DmxUpdate } from '../lib/dmx';
import type { FixtureParameter } from '../lib/fixtures';
import type { Vec3 } from './geometry';
import type { TargetArrangement } from './targets';

export type ControlSource =
  | 'ui'
  | 'midi'
  | 'fx'
  | 'cue'
  | 'recorder'
  | 'sync'
  | 'audio'
  | 'surface'
  | 'remote'
  | 'system';

export type ControlCommand =
  | { type: 'frame.batch.replace'; frames: Array<{ universe: number; values: readonly number[] }> }
  | { type: 'frame.batch.output.replace'; frames: Array<{ universe: number; values: readonly number[] }> }
  | { type: 'frame.replace'; universe: number; values: readonly number[] }
  | { type: 'frame.output.replace'; universe: number; values: readonly number[] }
  | { type: 'frame.update'; universe: number; updates: ReadonlyArray<DmxUpdate> }
  | { type: 'fixture.select'; fixtureIds: string[]; mode: 'replace' | 'add' | 'remove' | 'toggle' }
  | { type: 'fixture.attribute'; fixtureIds: string[]; parameter: FixtureParameter; value: number }
  | { type: 'fixture.color'; fixtureIds: string[]; color: { red: number; green: number; blue: number } }
  | { type: 'fixture.flash.set'; fixtureIds: string[]; active: boolean }
  | { type: 'fixture.position'; positions: Array<{ fixtureId: string; panNormalized: number; tiltNormalized: number }> }
  | { type: 'fixture.target'; fixtureIds: string[]; target: Vec3; arrangement?: TargetArrangement; spreadMeters?: number }
  | { type: 'group.color'; groupName: string; color: { red: number; green: number; blue: number } }
  | { type: 'group.master.set'; groupName: string; value: number }
  | { type: 'group.level.adjust'; groupName: string; previous: number; value: number }
  | { type: 'effect.start'; effectId: EffectId }
  | { type: 'effect.press'; effectId: EffectId }
  | { type: 'effect.release'; effectId: EffectId }
  | { type: 'effect.stop'; effectId?: EffectId }
  | { type: 'cue.go'; cueId?: string }
  | { type: 'cue.previous' }
  | { type: 'blackout.set'; active: boolean }
  | { type: 'master.set'; value: number };

export type ControlCommandEnvelope = {
  id: string;
  source: ControlSource;
  timestamp: number;
  command: ControlCommand;
};

let commandSequence = 0;

export function controlCommand(
  source: ControlSource,
  command: ControlCommand,
  timestamp = Date.now()
): ControlCommandEnvelope {
  commandSequence += 1;
  return {
    id: `command-${timestamp.toString(36)}-${commandSequence.toString(36)}`,
    source,
    timestamp,
    command
  };
}
