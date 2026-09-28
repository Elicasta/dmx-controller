import { describe, expect, it } from 'vitest';
import { applyLightingOffset, cueChanges, cueChangesByUniverse, diffUniverse, isShowFile, midiSongPositionToMs, moveCue, removeCuePreservingTracking, renumberCues, resolveShowCueFrames, sanitizeShow, type ShowCue } from './show';

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

  it('tracks and resolves sparse changes across multiple universes', () => {
    const black = Array(512).fill(0);
    const u1Blue = [...black]; u1Blue[2] = 255;
    const u2Red = [...black]; u2Red[0] = 255;
    const u1Bright = [...u1Blue]; u1Bright[4] = 200;

    const firstFrames = new Map<number, number[]>([[1, u1Blue], [2, u2Red]]);
    const secondFrames = new Map<number, number[]>([[1, u1Bright], [2, u2Red]]);
    const emptyFrames = new Map<number, number[]>([[1, black], [2, black]]);

    const cues: ShowCue[] = [
      {
        ...cue('color', 1),
        changes: cueChanges(black, u1Blue),
        universeChanges: cueChangesByUniverse(emptyFrames, firstFrames),
        universe: u1Blue,
        universes: [{ universe: 1, values: u1Blue }, { universe: 2, values: u2Red }]
      },
      {
        ...cue('bright', 2),
        changes: cueChanges(u1Blue, u1Bright),
        universeChanges: cueChangesByUniverse(firstFrames, secondFrames),
        universe: u1Bright,
        universes: [{ universe: 1, values: u1Bright }, { universe: 2, values: u2Red }]
      }
    ];

    const resolved = resolveShowCueFrames(cues, 1, emptyFrames);
    expect(resolved.get(1)?.[2]).toBe(255);
    expect(resolved.get(1)?.[4]).toBe(200);
    expect(resolved.get(2)?.[0]).toBe(255);
  });

  it('preserves resolved multi-universe looks when tracked cues move or are deleted', () => {
    const black = Array(512).fill(0);
    const u1A = [...black]; u1A[0] = 100;
    const u2A = [...black]; u2A[1] = 120;
    const u1B = [...u1A]; u1B[4] = 200;
    const start = new Map<number, number[]>([[1, black], [2, black]]);
    const a = new Map<number, number[]>([[1, u1A], [2, u2A]]);
    const b = new Map<number, number[]>([[1, u1B], [2, u2A]]);
    const cues: ShowCue[] = [
      { ...cue('a', 1), universeChanges: cueChangesByUniverse(start, a), universes: [{ universe: 1, values: u1A }, { universe: 2, values: u2A }] },
      { ...cue('b', 2), universeChanges: cueChangesByUniverse(a, b), universes: [{ universe: 1, values: u1B }, { universe: 2, values: u2A }] }
    ];

    const moved = moveCue(cues, 'b', -1);
    expect(resolveShowCueFrames(moved, 0).get(1)?.[4]).toBe(200);
    expect(resolveShowCueFrames(moved, 1).get(2)?.[1]).toBe(120);

    const removed = removeCuePreservingTracking(cues, 'a');
    expect(resolveShowCueFrames(removed, 0).get(1)?.[4]).toBe(200);
    expect(resolveShowCueFrames(removed, 0).get(2)?.[1]).toBe(120);
  });

  it('sanitizes cue family timing and two-dimensional group selection grids without losing Pro show data', () => {
    const show = sanitizeShow({
      version: 4,
      name: 'Engine',
      colorPalettes: [{ id: 'red', name: 'Red', color: '#ff0000', folder: 'Colors' }],
      cues: [{
        ...cue('timed', 1),
        timing: [{ family: 'position', fadeMs: 1234, delayMs: 250, curve: 'ease' }]
      }],
      groups: [{
        id: 'movers',
        name: 'Movers',
        labelColor: '#55e98d',
        masterDefault: 100,
        fxEnabled: true,
        notes: '',
        fixtureOrder: ['a', 'b'],
        selectionGrid: {
          rows: 1,
          columns: 2,
          traversal: 'snake-row',
          cells: [
            { fixtureId: 'a', row: 0, column: 0 },
            { fixtureId: 'b', row: 0, column: 1 }
          ]
        }
      }]
    });

    expect(show.cues[0].timing?.[0]).toEqual({ family: 'position', fadeMs: 1234, delayMs: 250, curve: 'ease' });
    expect(show.groups?.[0].selectionGrid?.traversal).toBe('snake-row');
    expect(show.colorPalettes?.[0].name).toBe('Red');
  });

});
