import { describe, expect, it } from 'vitest';
import { controlCommand } from './control-command';
import { ShowRuntime } from './show-runtime';
import { DEFAULT_PATCH, migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import { fixtureGeometryState } from './fixture-geometry';
import { angularDistanceDegrees, normalize, subtract } from './geometry';
import { arrangeTargetPoints } from './targets';

const mover: PatchedFixture = migratePatchedFixture({
  id: 'mover-1',
  name: 'Mover 1',
  profileId: 'generic-moving-head',
  modeId: '14ch-common',
  universe: 1,
  address: 101,
  group: 'Movers',
  selected: true,
  collapsed: false
}, 0, 1);

describe('ShowRuntime', () => {
  it('owns and revisions the authoritative frame', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    const result = runtime.dispatch(controlCommand('ui', {
      type: 'frame.update',
      universe: 1,
      updates: [[1, 42], [5, 255]]
    }, 100));
    expect(result.revision).toBe(1);
    expect(runtime.frame[0]).toBe(42);
    expect(runtime.sourceFor(1, 5)).toMatchObject({ source: 'ui', commandType: 'frame.update' });
  });

  it('resolves fixture attributes through the profile instead of raw channel knowledge', () => {
    const runtime = new ShowRuntime({ patch: [mover] });
    const result = runtime.dispatch(controlCommand('midi', {
      type: 'fixture.attribute',
      fixtureIds: [mover.id],
      parameter: 'pan',
      value: 192
    }));
    expect(result.frame[100]).toBe(192);
    expect(runtime.sourceFor(1, 101)?.source).toBe('midi');
  });

  it('keeps selection state in the runtime command pipeline', () => {
    const runtime = new ShowRuntime({ patch: [mover, { ...DEFAULT_PATCH[0], selected: false }] });
    const result = runtime.dispatch(controlCommand('surface', {
      type: 'fixture.select',
      fixtureIds: [DEFAULT_PATCH[0].id],
      mode: 'replace'
    }));
    expect(result.patchChanged).toBe(true);
    expect(runtime.snapshot.patch.find((fixture) => fixture.id === mover.id)?.selected).toBe(false);
    expect(runtime.snapshot.patch.find((fixture) => fixture.id === DEFAULT_PATCH[0].id)?.selected).toBe(true);
  });

  it('resolves spatial targets through fixture geometry into coarse/fine movement channels', () => {
    const positionedMover = { ...mover, transform: {
      position: { x: 0, y: 5, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 }
    } };
    const runtime = new ShowRuntime({ patch: [positionedMover] });
    const result = runtime.dispatch(controlCommand('ui', {
      type: 'fixture.target',
      fixtureIds: [positionedMover.id],
      target: { x: 2, y: 1, z: -3 }
    }));
    expect(result.warnings).toEqual([]);
    expect(result.changedChannels).toEqual(expect.arrayContaining([101, 103, 104]));
    expect(runtime.sourceFor(1, 101)?.commandType).toBe('fixture.target');
  });

  it('fans a selected mover group around one semantic target', () => {
    const fixtures = [
      { ...mover, id: 'left-mover', address: 101, transform: { position: { x: -2, y: 5, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } } },
      { ...mover, id: 'right-mover', address: 121, transform: { position: { x: 2, y: 5, z: 0 }, rotation: { yaw: 0, pitch: 0, roll: 0 } } }
    ];
    const target = { x: 0, y: 1, z: -4 };
    const expectedTargets = arrangeTargetPoints(target, fixtures.length, 'fan-horizontal', 4);
    const runtime = new ShowRuntime({ patch: fixtures });
    const result = runtime.dispatch(controlCommand('ui', {
      type: 'fixture.target',
      fixtureIds: fixtures.map((fixture) => fixture.id),
      target,
      arrangement: 'fan-horizontal',
      spreadMeters: 4
    }));
    expect(result.warnings).toEqual([]);
    fixtures.forEach((fixture, index) => {
      const state = fixtureGeometryState(result.frame, fixture, index, fixtures.length);
      const direction = normalize(subtract(expectedTargets[index], state.beam.origin));
      expect(angularDistanceDegrees(state.beam.direction, direction)).toBeLessThan(.02);
    });
  });

  it('restores absolute normalized Pan/Tilt through profile-aware coarse/fine channels', () => {
    const runtime = new ShowRuntime({ patch: [mover] });
    const result = runtime.dispatch(controlCommand('ui', {
      type: 'fixture.position',
      positions: [{ fixtureId: mover.id, panNormalized: .25, tiltNormalized: .75 }]
    }));
    expect(result.warnings).toEqual([]);
    expect(result.changedChannels).toEqual(expect.arrayContaining([101, 103, 104]));
    const resolved = fixtureGeometryState(result.frame, mover, 0, 1);
    expect(resolved.movement.panNormalized).toBeCloseTo(.25, 4);
    expect(resolved.movement.tiltNormalized).toBeCloseTo(.75, 4);
  });

  it('scales group intensity non-destructively and restores the base value', () => {
    const second = { ...DEFAULT_PATCH[0], id: 'fixture-2', name: 'Fixture 2', address: 11, group: 'Other' };
    const runtime = new ShowRuntime({ patch: [DEFAULT_PATCH[0], second] });
    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update', universe: 1, updates: [[5, 200], [15, 100]]
    }));
    const reduced = runtime.dispatch(controlCommand('ui', {
      type: 'group.master.set', groupName: 'Front Wash', value: .5
    }));
    expect(reduced.baseFrame[4]).toBe(200);
    expect(reduced.frame[4]).toBe(100);
    expect(reduced.frame[14]).toBe(100);
    const restored = runtime.dispatch(controlCommand('ui', {
      type: 'group.master.set', groupName: 'Front Wash', value: 1
    }));
    expect(restored.frame[4]).toBe(200);
  });

  it('flashes fixture intensity without changing its programmer base value', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update', universe: 1, updates: [[5, 160]]
    }));
    runtime.dispatch(controlCommand('ui', { type: 'master.set', value: .5 }));
    runtime.dispatch(controlCommand('ui', { type: 'group.master.set', groupName: 'Front Wash', value: .5 }));

    expect(runtime.baseFrame[4]).toBe(160);
    expect(runtime.frame[4]).toBe(40);

    const flashed = runtime.dispatch(controlCommand('surface', {
      type: 'fixture.flash.set', fixtureIds: [DEFAULT_PATCH[0].id], active: true
    }));
    expect(flashed.baseFrame[4]).toBe(160);
    expect(flashed.frame[4]).toBe(64);

    const released = runtime.dispatch(controlCommand('surface', {
      type: 'fixture.flash.set', fixtureIds: [DEFAULT_PATCH[0].id], active: false
    }));
    expect(released.baseFrame[4]).toBe(160);
    expect(released.frame[4]).toBe(40);
  });

  it('keeps edits under a group master as base values', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('ui', { type: 'group.master.set', groupName: 'Front Wash', value: .5 }));
    const edited = runtime.dispatch(controlCommand('ui', {
      type: 'fixture.attribute', fixtureIds: [DEFAULT_PATCH[0].id], parameter: 'dimmer', value: 80
    }));
    expect(edited.baseFrame[4]).toBe(80);
    expect(edited.frame[4]).toBe(40);
    const restored = runtime.dispatch(controlCommand('ui', { type: 'group.master.set', groupName: 'Front Wash', value: 1 }));
    expect(restored.frame[4]).toBe(80);
  });

  it('applies group color semantically and can bypass masters for exact recorder output', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    const colored = runtime.dispatch(controlCommand('ui', {
      type: 'group.color', groupName: 'Front Wash', color: { red: 10, green: 20, blue: 30 }
    }));
    expect(colored.frame.slice(0, 3)).toEqual([10, 20, 30]);
    runtime.dispatch(controlCommand('ui', { type: 'group.master.set', groupName: 'Front Wash', value: .25 }));
    const exact = runtime.dispatch(controlCommand('recorder', {
      type: 'frame.output.replace', universe: 1, values: colored.frame
    }));
    expect(exact.frame).toEqual(colored.frame);
  });

  it('restores programmed output when a stale Timeline blackout layer is cleared', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update', universe: 1, updates: [[5, 190]]
    }));
    const masked = runtime.dispatch(controlCommand('cue', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'timeline',
      priority: 35,
      mode: 'ltp',
      updates: [[5, 0]]
    }));
    expect(masked.baseFrame[4]).toBe(190);
    expect(masked.frame[4]).toBe(0);

    const restored = runtime.dispatch(controlCommand('cue', {
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'timeline'
    }));
    expect(restored.baseFrame[4]).toBe(190);
    expect(restored.frame[4]).toBe(190);
  });

  it('layers FX over the programmer without rewriting the base frame', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update', universe: 1, updates: [[5, 80]]
    }));
    const layered = runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'fx',
      priority: 30,
      mode: 'ltp',
      updates: [[5, 210]]
    }));
    expect(layered.baseFrame[4]).toBe(80);
    expect(layered.frame[4]).toBe(210);

    const cleared = runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.clear', universe: 1, layerId: 'fx'
    }));
    expect(cleared.baseFrame[4]).toBe(80);
    expect(cleared.frame[4]).toBe(80);
  });

  it('applies group and grand masters after playback layers', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'fx',
      priority: 30,
      mode: 'ltp',
      updates: [[5, 200]]
    }));
    runtime.dispatch(controlCommand('ui', {
      type: 'group.master.set', groupName: 'Front Wash', value: .5
    }));
    const mastered = runtime.dispatch(controlCommand('ui', {
      type: 'master.set', value: .5
    }));
    expect(mastered.baseFrame[4]).toBe(0);
    expect(mastered.frame[4]).toBe(50);
  });

  it('resolves the live stack as base < FX < BUSK < hit and restores each layer cleanly', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });

    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update',
      universe: 1,
      updates: [[1, 10], [5, 40]]
    }));

    runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'fx',
      priority: 30,
      mode: 'ltp',
      updates: [[1, 60], [5, 80]]
    }));

    const busked = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'busk',
      priority: 50,
      mode: 'ltp',
      updates: [[1, 140], [5, 160]]
    }));
    expect(busked.frame[0]).toBe(140);
    expect(busked.frame[4]).toBe(160);

    const hit = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'hit',
      priority: 80,
      mode: 'ltp',
      updates: [[1, 255], [5, 255]]
    }));
    expect(hit.frame[0]).toBe(255);
    expect(hit.frame[4]).toBe(255);

    const afterHit = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'hit'
    }));
    expect(afterHit.frame[0]).toBe(140);
    expect(afterHit.frame[4]).toBe(160);

    const afterBusk = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'busk'
    }));
    expect(afterBusk.frame[0]).toBe(60);
    expect(afterBusk.frame[4]).toBe(80);

    const afterFx = runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'fx'
    }));
    expect(afterFx.frame[0]).toBe(10);
    expect(afterFx.frame[4]).toBe(40);
  });

  it('keeps the main FX layer running underneath an independent hit layer', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });

    runtime.dispatch(controlCommand('fx', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'fx',
      priority: 30,
      mode: 'ltp',
      updates: [[1, 20], [5, 120]]
    }));

    const hit = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'hit',
      priority: 80,
      mode: 'ltp',
      updates: [[1, 255], [5, 255]]
    }));

    expect(hit.frame[0]).toBe(255);
    expect(hit.frame[4]).toBe(255);

    const released = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.clear',
      universe: 1,
      layerId: 'hit'
    }));

    expect(released.frame[0]).toBe(20);
    expect(released.frame[4]).toBe(120);
    expect(released.baseFrame[0]).toBe(0);
    expect(released.baseFrame[4]).toBe(0);
  });

  it('supports HTP hit layers without letting a lower hit pull intensity down', () => {
    const runtime = new ShowRuntime({ patch: DEFAULT_PATCH });
    runtime.dispatch(controlCommand('ui', {
      type: 'frame.update', universe: 1, updates: [[5, 180]]
    }));
    const hit = runtime.dispatch(controlCommand('surface', {
      type: 'playback.layer.set',
      universe: 1,
      layerId: 'hit',
      priority: 80,
      mode: 'htp',
      updates: [[5, 100]]
    }));
    expect(hit.frame[4]).toBe(180);
  });

  it('changes one fixture intensity without moving another fixture fader', () => {
    const second = { ...DEFAULT_PATCH[0], id: 'fixture-2', address: 11, selected: false };
    const runtime = new ShowRuntime({ patch: [DEFAULT_PATCH[0], second] });
    runtime.dispatch(controlCommand('ui', {
      type: 'fixture.attribute', fixtureIds: [DEFAULT_PATCH[0].id], parameter: 'dimmer', value: 173
    }));
    expect(runtime.baseFrame[4]).toBe(173);
    expect(runtime.baseFrame[14]).toBe(0);
  });

  it('colors only explicitly targeted compatible fixtures', () => {
    const second = { ...DEFAULT_PATCH[0], id: 'fixture-2', address: 11, selected: false };
    const runtime = new ShowRuntime({ patch: [DEFAULT_PATCH[0], second] });
    const result = runtime.dispatch(controlCommand('ui', {
      type: 'fixture.color', fixtureIds: [second.id], color: { red: 12, green: 34, blue: 56 }
    }));
    expect(result.baseFrame.slice(0, 3)).toEqual([0, 0, 0]);
    expect(result.baseFrame.slice(10, 13)).toEqual([12, 34, 56]);
  });
});
