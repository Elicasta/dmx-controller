import { describe, expect, it, vi } from 'vitest';
import { QlcOutputDriver } from './qlc-output';
import type { QlcCommand } from './qlc-websocket';

function makeDriver() {
  const sent: QlcCommand[] = [];
  return {sent, driver:new QlcOutputDriver(command=>sent.push(command))};
}
describe('QLC+ external output', () => {
  it('is not armed by default and does not send live output', () => {
    const {driver,sent}=makeDriver();
    driver.sendFrame(1,Array(512).fill(100));
    driver.flush();
    expect(sent).toHaveLength(0);
  });
  it('routes channels using 1-based global address, sends dirty values only', () => {
    vi.useFakeTimers();
    try {
      const {driver,sent}=makeDriver();
      driver.arm();
      driver.sendFrame(1,Array(512).fill(0));
      driver.flush();
      expect(sent[0]).toEqual({type:'channel',address:1,value:0});
      for(let n=0;n<4;n++)driver.flush();
      expect(sent).toHaveLength(512);
      driver.sendFrame(1,Array(512).fill(0));
      driver.flush();
      expect(sent).toHaveLength(512);
      const changed=Array(512).fill(0);changed[1]=245;changed[511]=77;
      driver.sendFrame(1,changed);
      driver.flush();
      expect(sent.slice(-2)).toEqual([{type:'channel',address:2,value:245},{type:'channel',address:512,value:77}]);
      driver.disarm();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('drops old queued levels in favor of the latest frame',()=>{
    vi.useFakeTimers();
    try {
      const {driver,sent}=makeDriver();
      driver.arm();driver.sendFrame(1,Array(512).fill(10));
      driver.flush();
      driver.sendFrame(1,Array(512).fill(20));
      for(let n=0;n<6;n++)driver.flush();
      expect(sent[sent.length-1]).toEqual({type:'channel',address:512,value:20});
      driver.disarm();
    } finally { vi.useRealTimers(); }
  });
  it('rejects invalid universes and values, disarms on socket failure',()=>{
    vi.useFakeTimers();
    try {
      const driver=new QlcOutputDriver(()=>{throw Error('socket closed');});
      driver.arm();
      expect(()=>driver.sendFrame(0,Array(512).fill(0))).toThrow('universe');
      expect(()=>driver.sendFrame(1,Array(512).fill(300))).toThrow('512-channel');
      driver.sendFrame(1,Array(512).fill(0));
      expect(()=>driver.flush()).toThrow('socket closed');
      expect(driver.active).toBe(false);
      expect(driver.status().lastError).toContain('socket closed');
    } finally { vi.useRealTimers(); }
  });
});
