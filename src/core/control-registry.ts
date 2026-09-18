import { buildMidiControls, type MidiAssignableControl } from '../lib/midi';
import type { PatchedFixture } from '../lib/fixtures';

export type ControlRegistryEntry = MidiAssignableControl & {
  commandPath: string;
  supportsPressRelease: boolean;
};

const MOMENTARY_EFFECTS = new Set(['effect:blinder', 'effect:bump']);

function commandPath(controlId: string): string {
  if (controlId === 'go') return 'cue.go';
  if (controlId === 'previous') return 'cue.previous';
  if (controlId === 'blackout') return 'blackout.set';
  if (controlId === 'master') return 'master.set';
  if (controlId === 'tempo') return 'fx.bpm';
  if (controlId === 'effect-depth') return 'fx.depth';
  if (controlId === 'stop-effect') return 'effect.stop';
  if (controlId.startsWith('effect:')) return MOMENTARY_EFFECTS.has(controlId) ? 'effect.press-release' : 'effect.start';
  if (controlId.startsWith('fixture-select:')) return 'fixture.select';
  if (controlId.startsWith('fixture:')) return 'fixture.attribute';
  if (controlId.startsWith('color:') || controlId.startsWith('global-')) return 'fixture.color';
  return controlId;
}

export function buildControlRegistry(patch: readonly PatchedFixture[]): ControlRegistryEntry[] {
  return buildMidiControls(patch).map((control) => ({
    ...control,
    commandPath: commandPath(control.id),
    supportsPressRelease: MOMENTARY_EFFECTS.has(control.id)
  }));
}
