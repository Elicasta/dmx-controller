import { describe, expect, it } from 'vitest';
import { CallbackOutputDriver, OutputRouter, VirtualOutputDriver } from './output-router';

describe('OutputRouter', () => {
  it('sends the same finished frame to virtual and physical adapters', async () => {
    const virtual = new VirtualOutputDriver();
    let received: readonly number[] = [];
    const physical = new CallbackOutputDriver('test', 'Test output', (_universe, frame) => { received = [...frame]; });
    const router = new OutputRouter();
    router.register(virtual);
    router.register(physical);
    const frame = Array.from({ length: 512 }, (_, index) => index % 256);
    await router.route(1, frame);
    expect(virtual.frame(1)).toEqual(frame);
    expect(received).toEqual(frame);
    expect(router.status()).toMatchObject([
      { id: 'virtual', framesSent: 1 },
      { id: 'test', framesSent: 1 }
    ]);
  });
});
