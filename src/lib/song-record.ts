import type { TempoAnalysis } from './tempo-analysis';
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
  tempoAnalysis?: TempoAnalysis;
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
    (s.tempoAnalysis === undefined || (
      s.tempoAnalysis?.version === 1 &&
      Number.isFinite(s.tempoAnalysis.bpm) && s.tempoAnalysis.bpm >= 20 && s.tempoAnalysis.bpm <= 300 &&
      Number.isFinite(s.tempoAnalysis.confidence) && s.tempoAnalysis.confidence >= 0 && s.tempoAnalysis.confidence <= 1 &&
      Number.isFinite(s.tempoAnalysis.downbeatMs) && s.tempoAnalysis.downbeatMs >= 0 &&
      Number.isFinite(s.tempoAnalysis.downbeatConfidence) && s.tempoAnalysis.downbeatConfidence >= 0 && s.tempoAnalysis.downbeatConfidence <= 1 &&
      typeof s.tempoAnalysis.analyzedAt === 'string' &&
      (s.tempoAnalysis.halfBpm === null || (Number.isFinite(s.tempoAnalysis.halfBpm) && s.tempoAnalysis.halfBpm >= 20 && s.tempoAnalysis.halfBpm <= 300)) &&
      (s.tempoAnalysis.doubleBpm === null || (Number.isFinite(s.tempoAnalysis.doubleBpm) && s.tempoAnalysis.doubleBpm >= 20 && s.tempoAnalysis.doubleBpm <= 300)) &&
      (s.tempoAnalysis.manualDownbeat === undefined || typeof s.tempoAnalysis.manualDownbeat === 'boolean')
    )) &&
    (s.libraryId === undefined || (typeof s.libraryId === "string" && !!s.libraryId)) &&
    (s.mediaId === undefined || typeof s.mediaId === "string") &&
    (s.mediaName === undefined || typeof s.mediaName === "string")
  );
}
