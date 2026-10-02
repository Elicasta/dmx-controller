export type SongRecord = {
  versionOf?: string;
  sourceRecordingId?: string;
  id: string;
  libraryId?: string;
  name: string;
  bpm: number;
  musicalKey?: string;
  artist?: string;
  arrangement?: string[];
  notes?: string;
  tempoLocked?: boolean;
  mediaId?: string;
  mediaName?: string;
};
export function isSongRecord(value: unknown): value is SongRecord {
  if (!value || typeof value !== "object") return false;
  const s = value as SongRecord;
  return (
    (s.versionOf===undefined || typeof s.versionOf==='string') &&
    (s.sourceRecordingId===undefined || typeof s.sourceRecordingId==='string') &&
    typeof s.id === "string" &&
    !!s.id &&
    typeof s.name === "string" &&
    !!s.name.trim() &&
    Number.isFinite(s.bpm) &&
    s.bpm >= 20 &&
    s.bpm <= 300 &&
    (s.musicalKey === undefined || (typeof s.musicalKey === 'string' && s.musicalKey.length <= 32)) &&
    (s.artist === undefined || (typeof s.artist === 'string' && s.artist.length <= 180)) &&
    (s.arrangement === undefined || (Array.isArray(s.arrangement) && s.arrangement.length <= 128 && s.arrangement.every(item => typeof item === 'string' && item.length <= 180))) &&
    (s.notes === undefined || (typeof s.notes === 'string' && s.notes.length <= 12000)) &&
    (s.tempoLocked === undefined || typeof s.tempoLocked === 'boolean') &&
    (s.libraryId === undefined || (typeof s.libraryId === "string" && !!s.libraryId)) &&
    (s.mediaId === undefined || typeof s.mediaId === "string") &&
    (s.mediaName === undefined || typeof s.mediaName === "string")
  );
}
