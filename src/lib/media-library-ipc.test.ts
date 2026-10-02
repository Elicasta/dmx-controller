import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn(),convertFileSrc:vi.fn()}));
import {invoke} from '@tauri-apps/api/core';
import {persistManagedMedia,exportPortableBackup,countMediaIds,importPortableBackup} from './media-library';
const call=vi.mocked(invoke);
beforeEach(()=>{call.mockReset();vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});});
afterEach(()=>vi.unstubAllGlobals());
it('sends raw binary IPC chunks with job token and monotonically increasing offsets',async()=>{
 call.mockImplementation(async c=>c==='media_begin_managed_write'?'job':{id:'asset'});
 const blob=new Blob([new Uint8Array(2*1024*1024+3)]);
 await persistManagedMedia('asset',blob,'test.wav');
 const chunks=call.mock.calls.filter(c=>c[0]==='media_append_managed_write');
 let offset=0;
 for(const chunk of chunks){expect(chunk[1]).toBeInstanceOf(Uint8Array);expect((chunk[1] as Uint8Array).byteLength).toBeLessThanOrEqual(1048576);expect(chunk[2]).toEqual({headers:{'x-lumarig-media-job':'job','x-lumarig-media-offset':String(offset)}});offset+=(chunk[1] as Uint8Array).byteLength;}
 expect(offset).toBe(blob.size);expect(call.mock.calls.at(-1)).toEqual(['media_finish_managed_write',{assetId:'asset',jobId:'job',expectedSize:blob.size,name:'test.wav',folderId:null,kind:'audio'}]);
});
it('cancels an interrupted upload and never publishes partial media',async()=>{
 call.mockImplementation(async c=>{if(c==='media_begin_managed_write')return 'job';if(c==='media_append_managed_write')throw Error('disk full');});
 await expect(persistManagedMedia('asset',new Blob(['data']),'test.wav')).rejects.toThrow('disk full');
 expect(call.mock.calls.at(-1)).toEqual(['media_cancel_managed_write',{jobId:'job'}]);expect(call.mock.calls.some(c=>c[0]==='media_finish_managed_write')).toBe(false);
});
it('refuses export when one required asset is missing',async()=>{
 call.mockResolvedValue({version:1,folders:[],assets:[{id:'a',name:'a.wav',missing:true}]});await expect(exportPortableBackup({},['a'],'backup')).rejects.toThrow('Relink missing');expect(call).toHaveBeenCalledTimes(1);
});
it('handles native picker cancellation without a state replacement',async()=>{call.mockResolvedValue(null);expect(await importPortableBackup()).toBeNull();});
it('counts unusual media IDs without inheriting Object properties',()=>{expect(countMediaIds([{mediaId:'__proto__'},{mediaId:'constructor'},{mediaId:'constructor'}])).toEqual(JSON.parse('{"__proto__":1,"constructor":2}'));});
