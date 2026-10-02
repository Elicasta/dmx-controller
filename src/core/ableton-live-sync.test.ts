import { describe, expect, it } from 'vitest';
import {
  abletonBeatToBar,
  abletonTimelineMarkers,
  abletonTimelinePositionBar,
  activeAbletonLocator,
  sanitizeAbletonSnapshot,
} from './ableton-live-sync';

describe('Ableton Live synchronization', () => {
  it('maps Live beats to LumaRig bars without an off-by-one shift', () => {
    expect(abletonBeatToBar(0, 4)).toBe(0);
    expect(abletonBeatToBar(4, 4)).toBe(1);
    expect(abletonBeatToBar(9, 3)).toBe(3);
  });

  it('sanitizes malformed snapshots and sorts locators by arrangement time', () => {
    const snapshot = sanitizeAbletonSnapshot({
      setName: 'Sunday Set',
      bpm: 999,
      beatsPerBar: 0,
      currentBeat: -3,
      playing: 1,
      locators: [
        { id: 'chorus', name: ' Chorus ', beat: 32 },
        { id: 'intro', name: 'Intro', beat: 0 },
        { id: '', name: '', beat: -4 },
      ],
    });
    expect(snapshot.bpm).toBe(300);
    expect(snapshot.beatsPerBar).toBe(1);
    expect(snapshot.currentBeat).toBe(0);
    expect(snapshot.playing).toBe(true);
    expect(snapshot.locators.map((locator) => locator.name)).toEqual(['Intro', 'Locator 3', 'Chorus']);
    expect(snapshot.locators[1].beat).toBe(0);
  });

  it('preserves duplicate locator names as separate timeline markers', () => {
    const markers = abletonTimelineMarkers({
      setId: 'set',
      setName: 'Set',
      bpm: 120,
      beatsPerBar: 4,
      currentBeat: 0,
      playing: false,
      locators: [
        { id: 'chorus-1', name: 'Chorus', beat: 16 },
        { id: 'chorus-2', name: 'Chorus', beat: 48 },
      ],
    });
    expect(markers.map((marker) => marker.bar)).toEqual([4, 12]);
    expect(markers.map((marker) => marker.id)).toEqual(['chorus-1', 'chorus-2']);
  });

  it('selects the latest locator at exact boundaries', () => {
    const snapshot = sanitizeAbletonSnapshot({
      bpm: 100,
      beatsPerBar: 4,
      currentBeat: 32,
      locators: [
        { id: 'verse', name: 'Verse', beat: 16 },
        { id: 'chorus', name: 'Chorus', beat: 32 },
        { id: 'bridge', name: 'Bridge', beat: 64 },
      ],
    });
    expect(activeAbletonLocator(snapshot)?.name).toBe('Chorus');
    expect(abletonTimelinePositionBar(snapshot)).toBe(8);
  });
});
