import { describe, expect, it, vi } from 'vitest';
import { ArtNetOutputDriver } from './artnet-output';

describe('ArtNetOutputDriver', () => {
  it('sends the same resolved frame and universe to the configured target', async () => {
    const sender = vi.fn(async () => {});
    const driver = new ArtNetOutputDriver(
      () => ({ enabled: true, target: '127.0.0.1' }),
      sender
    );
    const frame = Array.from({ length: 512 }, (_, index) => index % 256);

    await driver.sendFrame(2, frame);

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith('127.0.0.1', 2, frame);
    expect(driver.status()).toMatchObject({ framesSent: 1 });
  });

  it('sends physical black on Art-Net while preserving the caller frame', async () => {
    let sent: readonly number[] = [];
    const sender = vi.fn(async (_target: string, _universe: number, frame: readonly number[]) => {
      sent = [...frame];
    });
    const driver = new ArtNetOutputDriver(
      () => ({ enabled: true, target: '127.0.0.1', blackout: true }),
      sender
    );
    const frame = Array.from({ length: 512 }, () => 200);

    await driver.sendFrame(2, frame);

    expect(frame[0]).toBe(200);
    expect(sent).toHaveLength(512);
    expect(sent.every((value) => value === 0)).toBe(true);
  });

  it('does nothing while the visualizer output is disabled', async () => {
    const sender = vi.fn(async () => {});
    const driver = new ArtNetOutputDriver(
      () => ({ enabled: false, target: '127.0.0.1' }),
      sender
    );

    await driver.sendFrame(1, [255]);

    expect(sender).not.toHaveBeenCalled();
    expect(driver.status().framesSent).toBe(0);
  });

  it('keeps visualizer failures non-fatal while exposing status', async () => {
    const driver = new ArtNetOutputDriver(
      () => ({ enabled: true, target: 'bad-target' }),
      async () => { throw new Error('send failed'); }
    );

    await expect(driver.sendFrame(1, [0])).resolves.toBeUndefined();
    expect(driver.status().lastError).toContain('send failed');
    expect(driver.status().framesSent).toBe(0);
  });
});
