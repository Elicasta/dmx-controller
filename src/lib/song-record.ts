export type SongRecord = {
  id: string;
  libraryId?: string;
  name: string;
  bpm: number;
  mediaId?: string;
  mediaName?: string;
};
export function isSongRecord(value: unknown): value is SongRecord {
  if (!value || typeof value !== "object") return false;
  const s = value as SongRecord;
  return (
    typeof s.id === "string" &&
    !!s.id &&
    typeof s.name === "string" &&
    !!s.name.trim() &&
    Number.isFinite(s.bpm) &&
    s.bpm >= 20 &&
    s.bpm <= 300 &&
    (s.libraryId === undefined || (typeof s.libraryId === "string" && !!s.libraryId)) &&
    (s.mediaId === undefined || typeof s.mediaId === "string") &&
    (s.mediaName === undefined || typeof s.mediaName === "string")
  );
}
