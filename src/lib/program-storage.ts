import { extractSongProgram, isSongProgram, programId, type SongProgram } from './song-library';
import { songsForShow } from './song-bank';
import { isShowFile, type ShowFile } from './show';

export type Recovery = { id: string; savedAt: string; show: ShowFile; workspace?: Record<string, unknown> };
export type ProgramState = { version: 1; working?: ShowFile; workspace?: Record<string, unknown>; programs: SongProgram[]; recovery: Recovery[] };
export const emptyProgramState = (): ProgramState => ({ version: 1, programs: [], recovery: [] });
export function validateProgramState(value: unknown): ProgramState {
  if (!value) return emptyProgramState();
  const s = value as ProgramState;
  if (s.version !== 1 || !Array.isArray(s.programs) || !s.programs.every(isSongProgram)
    || !Array.isArray(s.recovery) || !s.recovery.every(r => typeof r.id === 'string' && typeof r.savedAt === 'string' && isShowFile(r.show)
      && (r.workspace === undefined || (!!r.workspace && typeof r.workspace === 'object' && !Array.isArray(r.workspace))))
    || (s.workspace !== undefined && (!s.workspace || typeof s.workspace !== 'object' || Array.isArray(s.workspace)))
    || (s.working !== undefined && !isShowFile(s.working)))
    throw Error('Saved library could not be read. Existing data has been preserved.');
  return s;
}
export function checkpointState(state: ProgramState, show: ShowFile,
  options: { capture?: 'changed' | 'all' | 'none'; recover?: ShowFile; seed?: ShowFile[]; forceId?: string; workspace?: Record<string, unknown>; recoverWorkspace?: Record<string, unknown> } = {}): ProgramState {
  if (!isShowFile(show)) throw Error('Cannot save invalid show programming.');
  const programs = new Map(state.programs.map(p => [p.id, p]));
  const capture = (input: ShowFile, onlyMissing = false) => {
    for (const song of songsForShow(input)) {
      const id = programId(input, song), payload = extractSongProgram(input, song);
      const existing = programs.get(id);
      if (onlyMissing && existing) continue;
      const previous = state.working && songsForShow(state.working).find(s => programId(state.working!, s) === id);
      if (options.capture !== 'all' && existing && options.forceId !== id && previous
        && JSON.stringify(extractSongProgram(state.working!, previous)) === JSON.stringify(payload)) continue;
      if (existing && JSON.stringify(existing.show) === JSON.stringify(payload)) continue;
      programs.set(id, { id, show: payload, savedAt: new Date().toISOString(), revision: (existing?.revision ?? 0) + 1 });
    }
  };
  for (const seed of options.seed ?? []) capture(seed, true);
  if (options.recover) capture(options.recover);
  if (options.capture !== 'none') capture(show);
  const recovery = [...state.recovery];
  if (options.recover && (options.recoverWorkspace || songsForShow(options.recover).length || options.recover.cues.length || options.recover.notes)) {
    recovery.unshift({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), show: structuredClone(options.recover), workspace: structuredClone(options.recoverWorkspace ?? state.workspace) });
  }
  return { version: 1, working: structuredClone(show), workspace: structuredClone(options.workspace ?? state.workspace), programs: [...programs.values()], recovery: recovery.slice(0, 10) };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumarig-program-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? Error('Song Library storage is unavailable.'));
    request.onblocked = () => reject(Error('Close other LumaRig windows and retry saving.'));
  });
}
/** Each write commits the working show, library and recovery together. Abort keeps the prior record. */
export async function readProgramState(): Promise<ProgramState> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('state'), request = tx.objectStore('state').get('current');
    request.onsuccess = () => { try { resolve(validateProgramState(request.result)); } catch (e) { reject(e); } };
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
let pending: Promise<unknown> = Promise.resolve();
export function saveProgramState(show: ShowFile, options: Parameters<typeof checkpointState>[2] = {}): Promise<ProgramState> {
  const snapshot = structuredClone(show), savedOptions = structuredClone(options);
  const operation = pending.then(async () => {
    const db = await database();
    try { return await new Promise<ProgramState>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite', { durability: 'strict' });
      const store = tx.objectStore('state'), request = store.get('current');
      let next: ProgramState, error: unknown;
      request.onsuccess = () => {
        try { next = checkpointState(validateProgramState(request.result), snapshot, savedOptions); store.put(next, 'current'); }
        catch (e) { error = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () => reject(error ?? tx.error ?? Error('Save failed. Your previous saved work is intact.'));
    }); } finally { db.close(); }
  });
  pending = operation.catch(() => undefined);
  return operation;
}
