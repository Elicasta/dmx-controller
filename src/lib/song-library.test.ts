import { describe, expect, it } from 'vitest';
import { EMPTY_SHOW, isShowFile, resolveShowCueFrame, type ShowFile } from './show';
import { DEFAULT_PATCH } from './fixtures';
import { createSection } from './show-design';
import { buildSong, renameSong } from './song-bank';
import { extractSongProgram, insertSongProgram, programId } from './song-library';
import { checkpointState, emptyProgramState, validateProgramState } from './program-storage';
const song = { id: 'song-a', name: 'Hineh Ma Tov', bpm: 130.5, mediaId: 'file-a', mediaName: 'song.wav' };
function programmed(): ShowFile {
  const show = buildSong({ ...structuredClone(EMPTY_SHOW), songs: [song], creatorSections: [createSection('Chorus', song.name, '', song.bpm)] }, song, DEFAULT_PATCH);
  show.timelineShows![0].timeline.clips[0].startBar = 12;
  show.timelineShows![0].timeline.clips[0].lane = 2;
  show.timelineShows![0].timeline.audioOffsetBars = 1.25;
  return show;
}
describe('independent Song Programs and checkpoints', () => {
  it('retains programming and media after New Show and JSON reload', () => {
    const original = programmed();
    const saved = checkpointState(emptyProgramState(), original);
    const next = checkpointState(saved, structuredClone(EMPTY_SHOW), { recover: original, capture: 'none' });
    const reopened = validateProgramState(JSON.parse(JSON.stringify(next)));
    expect(reopened.working!.cues).toHaveLength(0);
    expect(reopened.programs).toHaveLength(1);
    expect(reopened.recovery[0].show).toEqual(original);
    const result = insertSongProgram(reopened.working!, reopened.programs[0]);
    expect(isShowFile(result.show)).toBe(true);
    expect(result.song).toMatchObject({ bpm: 130.5, mediaId: 'file-a' });
    expect(result.show.creatorSections![0].name).toBe('Chorus');
    expect(result.show.timelineShows![0].timeline.clips[0]).toMatchObject({ startBar: 12, lane: 2 });
    expect(result.show.timelineShows![0].timeline.audioOffsetBars).toBe(1.25);
    expect(resolveShowCueFrame(result.show.cues, 0)).toEqual(resolveShowCueFrame(original.cues, 0));
  });
  it('remaps sections, cues and clips without mutating the library or existing show', () => {
    const original = programmed(), saved = checkpointState(emptyProgramState(), original);
    const result = insertSongProgram(original, saved.programs[0]);
    expect(result.song.name).toBe('Hineh Ma Tov (2)');
    expect(new Set(result.show.cues.map(c => c.id)).size).toBe(2);
    expect(result.show.cues[1].sourceSectionId).toBe(result.show.creatorSections![1].id);
    expect(result.show.timelineShows![1].timeline.clips[0].cueId).toBe(result.show.cues[1].id);
    result.show.creatorSections![1].name = 'Changed';
    expect(saved.programs[0].show.creatorSections![0].name).toBe('Chorus');
    expect(original.creatorSections![0].name).toBe('Chorus');
  });
  it('captures tracked cue states independently of preceding songs', () => {
    const original = programmed();
    original.cues.unshift({ ...original.cues[0], id:'preceding', trackName:'Other', changes:[[1,255]], universe:undefined });
    original.cues[1].changes = [[2,128]];
    const payload = extractSongProgram(original, song);
    expect(payload.cues).toHaveLength(1);
    expect(resolveShowCueFrame(payload.cues,0).slice(0,2)).toEqual([255,128]);
  });
  it('keeps identity across rename and advances revisions only when content changes', () => {
    const original = programmed();
    const first = checkpointState(emptyProgramState(), original);
    const second = checkpointState(first, original);
    expect(second.programs[0].revision).toBe(1);
    const renamed = checkpointState(second, renameSong(original, song.id, 'New Name'));
    expect(renamed.programs).toHaveLength(1);
    expect(renamed.programs[0].show.name).toBe('New Name');
    expect(renamed.programs[0].revision).toBe(2);
  });
  it('loading an older Show does not overwrite newer library programming', () => {
    const original = programmed(), newer = structuredClone(original);
    newer.creatorSections![0].name = 'New Chorus';
    const first = checkpointState(emptyProgramState(), original);
    const updated = checkpointState(first, newer);
    const loaded = checkpointState(updated, original, { recover: newer, capture:'none' });
    const autosaved = checkpointState(loaded, original);
    expect(autosaved.programs[0].show.creatorSections![0].name).toBe('New Chorus');
  });
  it('imports legacy saved Shows without replacing existing library masters', () => {
    const original = programmed(), old = structuredClone(original);
    old.creatorSections![0].name = 'Old';
    const first = checkpointState(emptyProgramState(), original);
    expect(checkpointState(first, original, { seed:[old] }).programs[0].show.creatorSections![0].name).toBe('Chorus');
    expect(programId({ ...original, name:'Show A' }, { ...song, id:'legacy:Song' })).not.toBe(programId({ ...original, name:'Show B' }, { ...song, id:'legacy:Song' }));
  });
  it('keeps group targets when IDs collide with another Show', () => {
    const original = programmed();
    original.groups = [{ id:'g1', name:'Back Wall', labelColor:'#ffffff', masterDefault:100, fxEnabled:true, notes:'', fixtureOrder:[DEFAULT_PATCH[0].id] }];
    original.creatorSections![0].groupId = 'g1';
    original.creatorSections![0].layers = [{ id:'l1', groupId:'g1', recipeId:'row-chase', energy:70, enabled:true }];
    const saved = checkpointState(emptyProgramState(), original);
    const result = insertSongProgram({ ...structuredClone(EMPTY_SHOW), groups:original.groups }, saved.programs[0]);
    expect(result.show.groups![1].id).not.toBe('g1');
    expect(result.show.creatorSections![0].groupId).toBe(result.show.groups![1].id);
    expect(result.show.creatorSections![0].layers[0].groupId).toBe(result.show.groups![1].id);
  });
  it('rejects invalid saves and corrupt persisted data without modifying previous state', () => {
    const first = checkpointState(emptyProgramState(), programmed());
    const before = structuredClone(first);
    expect(() => checkpointState(first, { ...EMPTY_SHOW, songs:[{...song,bpm:NaN}] })).toThrow();
    expect(first).toEqual(before);
    expect(() => validateProgramState({version:1, programs:[{}], recovery:[]})).toThrow(/preserved/);
  });
  it('bounds recovery while leaving the reusable library intact', () => {
    const original = programmed(); let state = checkpointState(emptyProgramState(), original);
    for(let i=0;i<15;i++) state=checkpointState(state, {...EMPTY_SHOW, name:`Show ${i}`}, {recover:original,capture:'none'});
    expect(state.recovery).toHaveLength(10); expect(state.programs).toHaveLength(1);
  });
});
