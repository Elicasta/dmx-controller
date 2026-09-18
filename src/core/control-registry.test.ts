import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH } from '../lib/fixtures';
import { buildControlRegistry } from './control-registry';

describe('Control Registry', () => {
  it('exposes the same logical actions to MIDI and future surfaces', () => {
    const registry = buildControlRegistry(DEFAULT_PATCH);
    expect(registry.find((control) => control.id === 'go')).toMatchObject({ commandPath: 'cue.go' });
    expect(registry.find((control) => control.id === 'effect:blinder')).toMatchObject({
      commandPath: 'effect.press-release',
      supportsPressRelease: true
    });
    expect(registry.find((control) => control.id === `fixture:${DEFAULT_PATCH[0].id}:dimmer`)).toMatchObject({ commandPath: 'fixture.attribute' });
  });
});
