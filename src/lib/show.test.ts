import { describe, expect, it } from 'vitest';
import { applyLightingOffset, cueChanges, cueChangesByUniverse, diffUniverse, isShowFile, midiSongPositionToMs, moveCue, removeCuePreservingTracking, renumberCues, resolveShowCueFrame, resolveShowCueFrames, sanitizeShow, type ShowCue } from './show';

function cue(id: string, number: number): ShowCue {
  return {
    id,
    number,
    name: `Cue ${id}`,
    fadeMs: 1000,
    values: { red: 0, green: 0, blue: 0, uv: 0, dimmer: 0 }
  };
}

describe('show helpers', () => {
  it('renumbers cues in playback order', () => {
    expect(renumberCues([cue('a', 8), cue('b', 9)]).map((item) => item.number)).toEqual([1, 2]);
  });

  it('moves a cue without crossing stack boundaries', () => {
    const cues = [cue('a', 1), cue('b', 2), cue('c', 3)];
    expect(moveCue(cues, 'b', -1).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(moveCue(cues, 'a', -1).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('validates and sanitizes persisted show data', () => {
    const show = { version: 1 as const, name: ' Show ', cues: [cue('a', 8)] };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show)).toMatchObject({ name: 'Show', cues: [{ number: 1 }] });
    expect(isShowFile({ version: 1, name: 'Broken', cues: [{}] })).toBe(false);
  });

  it('migrates legacy cue snapshots into v4 Universe 1 state', () => {
    const show = {
      version: 1 as const,
      name: 'Patched show',
      cues: [{ ...cue('a', 1), universe: Array(512).fill(300) }]
    };
    expect(isShowFile(show)).toBe(true);
    const sanitized = sanitizeShow(show);
    expect(sanitized.version).toBe(4);
    expect(sanitized.cues[0].universe?.[0]).toBe(255);
    expect(sanitized.cues[0].universes).toEqual([
      { universe: 1, values: Array(512).fill(255) }
    ]);
  });

  it('preserves independent cue snapshots for identical addresses on different universes', () => {
    const show = {
      version: 4 as const,
      name: 'Multi',
      cues: [{
        ...cue('a', 1),
        universes: [
          { universe: 1, values: [10, ...Array(511).fill(0)] },
          { universe: 2, values: [220, ...Array(511).fill(0)] }
        ]
      }]
    };
    expect(isShowFile(show)).toBe(true);
    const snapshots = sanitizeShow(show).cues[0].universes!;
    expect(snapshots.find((item) => item.universe === 1)?.values[0]).toBe(10);
    expect(snapshots.find((item) => item.universe === 2)?.values[0]).toBe(220);
  });

  it('preserves show notes and limits oversized note fields', () => {
    const show = { version: 1 as const, name: 'Notes', notes: 'x'.repeat(5000), cues: [] };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).notes).toHaveLength(4000);
  });

  it('round trips every channel in multi-universe cue snapshots through saved JSON', () => {
    const show = sanitizeShow({ version: 4, name: 'Round trip', cues: [{ ...cue('a', 1), universes: [
      { universe: 1, values: Array.from({ length: 512 }, (_, index) => index % 256) },
      { universe: 7, values: Array.from({ length: 512 }, (_, index) => 255 - index % 256) }
    ] }] });
    const reopened: unknown = JSON.parse(JSON.stringify(show));
    expect(isShowFile(reopened)).toBe(true);
    if (!isShowFile(reopened)) throw new Error('Saved show failed validation');
    expect(sanitizeShow(reopened).cues[0].universes).toEqual(show.cues[0].universes);
  });

  it('rejects conflicting snapshots for the same universe instead of silently losing one', () => {
    expect(isShowFile({ version: 4, name: 'Ambiguous', cues: [{ ...cue('a', 1), universes: [
      { universe: 1, values: Array(512).fill(0) },
      { universe: 1, values: Array(512).fill(255) }
    ] }] })).toBe(false);
  });

  it('stores compact show-recording changes and sanitizes recorded values', () => {
    const before = Array(512).fill(0);
    const after = [...before];
    after[0] = 255;
    after[4] = 999;
    expect(diffUniverse(before, after)).toEqual([[1, 255], [5, 255]]);

    const show = {
      version: 1 as const,
      name: 'Recorded show',
      cues: [],
      recordings: [{
        id: 'take-1',
        name: ' Take One ',
        trackName: 'song.wav',
        durationMs: 4000,
        createdAt: new Date(0).toISOString(),
        frames: [{ timeMs: 0, updates: [[1, 999] as const] }]
      }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).recordings?.[0]).toMatchObject({
      name: 'Take One',
      frames: [{
        updates: [[1, 255]],
        universeUpdates: [{ universe: 1, updates: [[1, 255]] }]
      }]
    });
  });

  it('preserves multi-universe recording updates in v4', () => {
    const show = {
      version: 4 as const,
      name: 'Multi take',
      cues: [],
      recordings: [{
        id: 'take-multi',
        name: 'Multi',
        trackName: '',
        durationMs: 1000,
        createdAt: new Date(0).toISOString(),
        frames: [{
          timeMs: 0,
          updates: [[1, 10] as const],
          universeUpdates: [
            { universe: 1, updates: [[1, 10] as const] },
            { universe: 2, updates: [[1, 240] as const] }
          ]
        }]
      }]
    };
    expect(isShowFile(show)).toBe(true);
    const frame = sanitizeShow(show).recordings?.[0].frames[0];
    expect(frame?.universeUpdates).toEqual([
      { universe: 1, updates: [[1, 10]] },
      { universe: 2, updates: [[1, 240]] }
    ]);
  });

  it('stores an external DAW song assignment and converts MIDI song position', () => {
    const show = {
      version: 1 as const,
      name: 'Synced show',
      cues: [],
      externalTrack: { songName: ' Finale ', recordingId: 'take-1', bpm: 128, lightingOffsetMs: 175, armed: true }
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).externalTrack).toEqual({ songName: 'Finale', recordingId: 'take-1', bpm: 128, lightingOffsetMs: 175, armed: true });
    expect(midiSongPositionToMs(16, 120)).toBe(2000);
    expect(applyLightingOffset(2000, 175)).toBe(2175);
    expect(applyLightingOffset(100, -250)).toBe(0);
  });

  it('migrates v1 shows and preserves spatial and absolute position palettes in v3', () => {
    const legacy = { version: 1 as const, name: 'Legacy', cues: [] };
    expect(sanitizeShow(legacy)).toMatchObject({ version: 4, groups: [], positionPalettes: [] });
    const show = {
      version: 2 as const,
      name: 'Positions',
      cues: [],
      positionPalettes: [{
        id: 'center', name: 'Center', kind: 'spatial' as const,
        targetId: 'target-center-stage', targetName: 'Center Stage', fallbackTarget: { x: 0, y: 1.2, z: 3 },
        arrangement: 'fan-horizontal' as const, spreadMeters: 4
      }, {
        id: 'air', name: 'Air', kind: 'absolute' as const,
        positions: [{ fixtureId: 'mover-1', fixtureName: 'Mover 1', panNormalized: .25, tiltNormalized: .75 }]
      }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).positionPalettes).toEqual(show.positionPalettes);
  });

  it('persists real group definitions and sanitizes group defaults', () => {
    const show = {
      version: 3 as const,
      name: 'Groups',
      cues: [],
      groups: [{
        id: 'front', name: ' Front Wash ', labelColor: '#55e98d', masterDefault: 140,
        fxEnabled: true, notes: 'Main wash', fixtureOrder: ['wash-2', 'wash-1', 'wash-1']
      }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).groups?.[0]).toEqual({
      id: 'front', name: 'Front Wash', labelColor: '#55e98d', masterDefault: 100,
      fxEnabled: true, notes: 'Main wash', fixtureOrder: ['wash-2', 'wash-1']
    });
  });

  it('preserves resolved looks when tracked cues are reordered', () => {
    const black = Array(512).fill(0);
    const blue = [...black]; blue[2] = 255;
    const brightBlue = [...blue]; brightBlue[4] = 200;
    const cues: ShowCue[] = [
      { ...cue('blue', 1), changes: cueChanges(black, blue), universe: blue },
      { ...cue('bright', 2), changes: cueChanges(blue, brightBlue), universe: brightBlue }
    ];
    const moved = moveCue(cues, 'bright', -1);
    expect(moved.map((item) => item.id)).toEqual(['bright', 'blue']);
    expect(resolveShowCueFrame(moved, 0)).toEqual(brightBlue);
    expect(resolveShowCueFrame(moved, 1)).toEqual(blue);
  });

  it('preserves later resolved looks when a tracked cue is deleted', () => {
    const black = Array(512).fill(0);
    const red = [...black]; red[0] = 255;
    const redBright = [...red]; redBright[4] = 220;
    const whiteBright = [...redBright]; whiteBright[1] = 255; whiteBright[2] = 255;
    const cues: ShowCue[] = [
      { ...cue('red', 1), changes: cueChanges(black, red), universe: red },
      { ...cue('bright', 2), changes: cueChanges(red, redBright), universe: redBright },
      { ...cue('white', 3), changes: cueChanges(redBright, whiteBright), universe: whiteBright }
    ];
    const next = removeCuePreservingTracking(cues, 'bright');
    expect(next.map((item) => item.id)).toEqual(['red', 'white']);
    expect(resolveShowCueFrame(next, 1)).toEqual(whiteBright);
  });

  it('tracks sparse changes independently across multiple universes', () => {
    const black = Array(512).fill(0);
    const u1a = [...black]; u1a[0] = 100;
    const u2a = [...black]; u2a[4] = 150;
    const u1b = [...u1a]; u1b[0] = 200;
    const u2b = [...u2a]; u2b[5] = 75;
    const first = new Map([[1, u1a], [2, u2a]]);
    const second = new Map([[1, u1b], [2, u2b]]);
    const cues: ShowCue[] = [
      { ...cue('a', 1), universeChanges: cueChangesByUniverse(new Map(), first), universes: [{ universe: 1, values: u1a }, { universe: 2, values: u2a }] },
      { ...cue('b', 2), universeChanges: cueChangesByUniverse(first, second), universes: [{ universe: 1, values: u1b }, { universe: 2, values: u2b }] }
    ];
    const resolved = resolveShowCueFrames(cues, 1);
    expect(resolved.get(1)?.[0]).toBe(200);
    expect(resolved.get(2)?.[4]).toBe(150);
    expect(resolved.get(2)?.[5]).toBe(75);

    const moved = moveCue(cues, 'b', -1);
    const firstMoved = resolveShowCueFrames(moved, 0);
    const secondMoved = resolveShowCueFrames(moved, 1);
    expect(firstMoved.get(1)?.[0]).toBe(200);
    expect(firstMoved.get(2)?.[5]).toBe(75);
    expect(secondMoved.get(1)?.[0]).toBe(100);
    expect(secondMoved.get(2)?.[4]).toBe(150);
  });

  it('sanitizes family timing overrides in v4 shows', () => {
    const show = {
      version: 4 as const,
      name: 'Timing',
      cues: [{
        ...cue('timed', 1),
        changes: [[1, 999] as const],
        timing: [
          { family: 'position' as const, fadeMs: 90000, delayMs: -20, curve: 'linear' as const },
          { family: 'color' as const, fadeMs: 0, delayMs: 0, curve: 'snap' as const }
        ]
      }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).cues[0]).toMatchObject({
      changes: [[1, 255]],
      timing: [
        { family: 'position', fadeMs: 60000, delayMs: 0, curve: 'linear' },
        { family: 'color', fadeMs: 0, delayMs: 0, curve: 'snap' }
      ]
    });
  });

  it('validates and sanitizes persisted two-dimensional fixture selection grids', () => {
    const show = {
      version: 4 as const,
      name: 'Grid Show',
      cues: [],
      groups: [{
        id: 'movers', name: 'Movers', labelColor: '#55e98d', masterDefault: 100,
        fxEnabled: true, notes: '', fixtureOrder: ['a', 'b', 'c', 'd'],
        selectionGrid: {
          rows: 2, columns: 2, traversal: 'snake-row' as const,
          cells: [
            { fixtureId: 'a', row: 0, column: 0 },
            { fixtureId: 'b', row: 0, column: 1 },
            { fixtureId: 'c', row: 1, column: 0 },
            { fixtureId: 'd', row: 1, column: 1 }
          ]
        }
      }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).groups?.[0].selectionGrid).toMatchObject({ rows: 2, columns: 2, traversal: 'snake-row' });
  });

});
