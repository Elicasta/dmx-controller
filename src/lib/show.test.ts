import { describe, expect, it } from 'vitest';
import { applyLightingOffset, cueChanges, diffUniverse, isShowFile, midiSongPositionToMs, moveCue, removeCuePreservingTracking, renumberCues, resolveShowCueFrame, sanitizeShow, type ShowCue, type ShowFile } from './show';
import { EMPTY_TIMELINE } from './show-design';

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

  it('accepts supported large-show boundaries and rejects files beyond them', () => {
    const cues = Array.from({ length: 200 }, (_, index) => cue(`cue-${index}`, index + 1));
    const songs = Array.from({ length: 100 }, (_, index) => ({
      id: `song-${index}`,
      name: `Song ${index + 1}`,
      bpm: 120,
    }));
    const thousandClips = Array.from({ length: 1000 }, (_, index) => ({
      id: `clip-${index}`,
      cueId: cues[index % cues.length].id,
      startBar: index,
      lengthBars: 1,
      lane: index % 8,
      enabled: true,
    }));
    const timelineShows = Array.from({ length: 100 }, (_, index) => ({
      id: `timeline-${index}`,
      name: `Timeline ${index + 1}`,
      timeline: {
        ...EMPTY_TIMELINE,
        bpm: 120,
        clips: index === 0 ? thousandClips : [],
      },
    }));
    const large: ShowFile = {
      version: 4,
      name: 'Boundary Show',
      cues,
      songs,
      timelineShows,
    };

    expect(isShowFile(large)).toBe(true);
    expect(isShowFile({ ...large, cues: [...cues, cue('cue-over', 201)] })).toBe(false);
    expect(isShowFile({
      ...large,
      songs: [...songs, { id: 'song-over', name: 'Song 101', bpm: 120 }],
    })).toBe(false);
    expect(isShowFile({
      ...large,
      timelineShows: [...timelineShows, { id: 'timeline-over', name: 'Timeline 101', timeline: EMPTY_TIMELINE }],
    })).toBe(false);
    expect(isShowFile({
      ...large,
      timelineShows: [{
        id: 'timeline-too-many-clips',
        name: 'Too Many Clips',
        timeline: {
          ...EMPTY_TIMELINE,
          bpm: 120,
          clips: [...thousandClips, { id: 'clip-over', cueId: cues[0].id, startBar: 1001, lengthBars: 1, lane: 0, enabled: true }],
        },
      }],
    })).toBe(false);
  });

  it('caps oversized persisted collections during sanitization', () => {
    const oversized = {
      version: 4 as const,
      name: 'Oversized',
      cues: Array.from({ length: 240 }, (_, index) => cue(`cue-${index}`, index + 1)),
      recordings: Array.from({ length: 30 }, (_, index) => ({
        id: `take-${index}`,
        name: `Take ${index}`,
        trackName: 'song.wav',
        durationMs: 1000,
        createdAt: new Date(index * 1000).toISOString(),
        frames: [],
      })),
    };
    const cleaned = sanitizeShow(oversized);
    expect(cleaned.cues).toHaveLength(200);
    expect(cleaned.recordings).toHaveLength(24);
    expect(cleaned.recordings?.[0].id).toBe('take-6');
  });

  it('validates and sanitizes persisted show data', () => {
    const show = { version: 1 as const, name: ' Show ', cues: [cue('a', 8)] };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show)).toMatchObject({ name: 'Show', cues: [{ number: 1 }] });
    expect(isShowFile({ version: 1, name: 'Broken', cues: [{}] })).toBe(false);
  });

  it('keeps full-universe snapshots for multi-fixture cues', () => {
    const show = {
      version: 1 as const,
      name: 'Patched show',
      cues: [{ ...cue('a', 1), universe: Array(512).fill(300) }]
    };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).cues[0].universe?.[0]).toBe(255);
  });

  it('preserves show notes and limits oversized note fields', () => {
    const show = { version: 1 as const, name: 'Notes', notes: 'x'.repeat(5000), cues: [] };
    expect(isShowFile(show)).toBe(true);
    expect(sanitizeShow(show).notes).toHaveLength(4000);
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
    expect(sanitizeShow(show).recordings?.[0]).toMatchObject({ name: 'Take One', frames: [{ updates: [[1, 255]] }] });
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

  it('migrates legacy shows and preserves spatial and absolute position palettes in v4', () => {
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

  it('stores sparse tracked cue changes and resolves inheritance forward', () => {
    const firstFrame = Array(512).fill(0);
    firstFrame[0] = 255;
    firstFrame[4] = 100;
    const secondFrame = [...firstFrame];
    secondFrame[4] = 200;

    const cues: ShowCue[] = [
      { ...cue('a', 1), changes: cueChanges(Array(512).fill(0), firstFrame), universe: firstFrame },
      { ...cue('b', 2), changes: cueChanges(firstFrame, secondFrame), universe: secondFrame }
    ];

    expect(cues[0].changes).toEqual([[1, 255], [5, 100]]);
    expect(cues[1].changes).toEqual([[5, 200]]);
    expect(resolveShowCueFrame(cues, 1).slice(0, 5)).toEqual([255, 0, 0, 0, 200]);
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
    expect(sanitizeShow(show).groups?.[0].selectionGrid).toMatchObject({
      rows: 2,
      columns: 2,
      traversal: 'snake-row'
    });
  });

});
