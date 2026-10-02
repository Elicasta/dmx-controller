export type SongRecord = {
  versionOf?: string;
  sourceRecordingId?: string;
  id: string;
  libraryId?: string;
  name: string;
  bpm: number;
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
    (s.tempoLocked === undefined || typeof s.tempoLocked === 'boolean') &&
    (s.libraryId === undefined || (typeof s.libraryId === "string" && !!s.libraryId)) &&
    (s.mediaId === undefined || typeof s.mediaId === "string") &&
    (s.mediaName === undefined || typeof s.mediaName === "string")
  );
}
