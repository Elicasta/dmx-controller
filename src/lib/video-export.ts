import {invoke} from '@tauri-apps/api/core';
export async function exportTrimmedVideo(source:Blob,name:string,startMs:number,endMs:number,onProgress:(message:string)=>void):Promise<string>{
  if(!('__TAURI_INTERNALS__' in window))throw Error('Trimmed MP4 export is available in the Mac app.');
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)throw Error('Choose a valid video trim.');
  const jobId=await invoke<string>('begin_video_export');
  try{
    for(let offset=0;offset<source.size;offset+=1048576){
      const bytes=Array.from(new Uint8Array(await source.slice(offset,offset+1048576).arrayBuffer()));
      await invoke('append_video_export',{jobId,offset,bytes});onProgress(`Preparing video export ${Math.round(Math.min(source.size,offset+bytes.length)/source.size*100)}%`);
    }
    onProgress('Exporting trimmed 1080p MP4…');
    return await invoke<string>('finish_video_export',{jobId,name:name.replace(/\.[^.]+$/,''),startMs,endMs});
  }catch(error){await invoke('cancel_video_export',{jobId}).catch(()=>{});throw error;}
}
