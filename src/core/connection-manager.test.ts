import { describe, expect, it } from 'vitest';
import { ConnectionManager } from './connection-manager';

describe('ConnectionManager', () => {
  it('keeps stable connection identities while statuses change', () => {
    const manager = new ConnectionManager();
    manager.upsert({ id:'midi-main', kind:'midi', name:'IAC Driver', status:'connecting', capabilities:['transport','controls'] });
    manager.heartbeat('midi-main','Clock 128 BPM',1000);
    expect(manager.get('midi-main')).toMatchObject({
      id:'midi-main', status:'connected', lastSeenAt:1000, detail:'Clock 128 BPM'
    });
    manager.fail('midi-main','Clock lost',true);
    expect(manager.get('midi-main')).toMatchObject({ status:'degraded', lastError:'Clock lost' });
  });

  it('returns deterministic snapshots', () => {
    const manager = new ConnectionManager();
    manager.upsert({ id:'studio', kind:'studio', name:'LumaStudio', status:'connected', capabilities:['transport'] });
    manager.upsert({ id:'ableton', kind:'ableton', name:'Ableton Live', status:'off', capabilities:['transport'] });
    expect(manager.snapshot().map(item=>item.id)).toEqual(['ableton','studio']);
  });
});
