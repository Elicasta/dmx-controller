import { describe, expect, it } from 'vitest';
import { EMPTY_SHOW, type ShowFile } from './show';
import { createSection, EMPTY_TIMELINE } from './show-design';
import { deriveSongProgram, mergeSongProgramIntoShow, showSongNames } from './song-library';

function sampleShow(): ShowFile {
  const section = createSection('Chorus', 'Hineh Ma Tov', '', 130);
  const cue = {
    id: 'cue-1',
    sourceSectionId: section.id,
    number: 1,
    name: 'Hineh Ma Tov · Chorus',
    trackName: 'Hineh Ma Tov',
    fadeMs: 0,
    values: { red: 255, green: 255, blue: 255, uv: 0, dimmer: 255 },
    changes: [[1, 255] as const]
  };
  return {
    ...structuredClone(EMPTY_SHOW),
    name: 'Service',
    creatorSections: [section],
    cues: [cue],
    timelineShows: [{
      id: 'timeline-1',
      name: 'Hineh Ma Tov',
      timeline: { ...EMPTY_TIMELINE, bpm: 130, clips: [{ id: 'clip-1', cueId: cue.id, startBar: 0, lengthBars: 4, lane: 0, enabled: true }] }
    }]
  };
}

describe('song program library', () => {
  it('derives reusable programming from a show', () => {
    const show = sampleShow();
    const program = deriveSongProgram(show, 'Hineh Ma Tov');
    expect(program.name).toBe('Hineh Ma Tov');
    expect(program.bpm).toBe(130);
    expect(program.sections).toHaveLength(1);
    expect(program.cues).toHaveLength(1);
    expect(program.timeline?.clips).toHaveLength(1);
  });

  it('reinstantiates IDs when loading a song into another show', () => {
    const show = sampleShow();
    const program = deriveSongProgram(show, 'Hineh Ma Tov');
    const next = mergeSongProgramIntoShow({ ...structuredClone(EMPTY_SHOW), name: 'Next Service', cues: [] }, program);
    expect(next.creatorSections).toHaveLength(1);
    expect(next.cues).toHaveLength(1);
    expect(next.creatorSections![0].id).not.toBe(program.sections[0].id);
    expect(next.cues[0].id).not.toBe(program.cues[0].id);
    expect(next.cues[0].sourceSectionId).toBe(next.creatorSections![0].id);
    expect(next.timelineShows?.[0].timeline.clips[0].cueId).toBe(next.cues[0].id);
  });

  it('finds songs across creator, cues, and timeline shows', () => {
    const show = sampleShow();
    expect(showSongNames(show)).toEqual(['Hineh Ma Tov']);
  });
});
