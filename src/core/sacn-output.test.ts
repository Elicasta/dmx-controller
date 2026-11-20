import { describe, expect, it, vi } from 'vitest';
import { SacnOutputDriver } from './sacn-output';

describe('sACN output driver', () => {
  it('sends one-based universes and resolved 512-channel frames', async () => {
    const send = vi.fn(async () => {});
    const driver = new SacnOutputDriver(() => ({ enabled: true, target: 'multicast' }), send);
    const frame = Array.from({ length: 512 }, (_, index) => index % 256);
    await driver.sendFrame(2, frame);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith('multicast', 2, frame);
    expect(driver.status()).toMatchObject({ framesSent: 1, lastError: undefined });
  });

  it('does not touch the network when disarmed', async () => {
    const send = vi.fn(async () => {});
    const driver = new SacnOutputDriver(() => ({ enabled: false, target: 'multicast' }), send);
    await driver.sendFrame(1, [255]);
    expect(send).not.toHaveBeenCalled();
  });

  it('reports errors without breaking physical output routing', async () => {
    const driver = new SacnOutputDriver(
      () => ({ enabled: true, target: 'wrong' }),
      async () => { throw new Error('invalid destination'); }
    );
    await expect(driver.sendFrame(1, [255])).resolves.toBeUndefined();
    expect(driver.status().lastError).toContain('invalid destination');
    expect(driver.status().framesSent).toBe(0);
  });
});
