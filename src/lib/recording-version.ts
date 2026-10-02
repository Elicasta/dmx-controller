import {extractSongProgram,insertSongProgram,type SongProgram} from './song-library';
import {isShowFile,type ShowFile,type ShowRecording} from './show';
import type {SongRecord} from './song-record';
/** Independent, editable take version. Original Song and saved recording are untouched. */
export function recordingSongVersion(show:ShowFile,song:SongRecord,take:ShowRecording):{show:ShowFile;song:SongRecord}{
  if(!Number.isFinite(take.durationMs)||take.durationMs<1)throw Error('The recording is empty.');
  const source=extractSongProgram(show,song),id=crypto.randomUUID();
  const original=source.songs![0];
  const name=song.name+' · '+take.name;
  source.name=name;source.songs=[{...original,name,libraryId:id,versionOf:song.versionOf ?? song.libraryId ?? song.id,sourceRecordingId:take.id}];
  source.creatorSections=[];source.cues=[];
  source.timeline={...source.timeline!,bpm:song.bpm,audioOffsetBars:0,audioTrimInMs:undefined,audioTrimOutMs:undefined,clips:[],takeClips:[{
    id:crypto.randomUUID(),name:take.name,recordingId:take.id,startBar:0,lengthBars:Math.max(.0001,take.durationMs/(60000/song.bpm*(source.timeline?.beatsPerBar??4))),
    durationMs:take.durationMs,trimInMs:0,trimOutMs:take.durationMs,enabled:true,frames:structuredClone(take.frames),
  }]};
  const program:SongProgram={id,savedAt:new Date().toISOString(),revision:1,show:source};
  if(!isShowFile(source))throw Error('Recording cannot be imported: invalid timing or frame data.');
  return insertSongProgram(show,program);
}
