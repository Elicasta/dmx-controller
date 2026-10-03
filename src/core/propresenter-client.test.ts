import { describe, expect, it } from 'vitest';
import {
  observeProPresenterTransport,
  proPresenterTransportMs,
  type ProPresenterStatus,
} from './propresenter-client';

function status(value: unknown): ProPresenterStatus {
  return {
    baseUrl: 'http://127.0.0.1:50001',
    version: {},
    slide: {},
    activePresentation: {},
    presentationTransport: value,
  };
}

describe('ProPresenter transport bridge', () => {
  it('converts the presentation transport seconds to milliseconds', () => {
    expect(proPresenterTransportMs(status(12.5))).toBe(12500);
    expect(proPresenterTransportMs(status(-1))).toBeNull();
    expect(proPresenterTransportMs(status({ time: 12 }))).toBeNull();
  });

  it('requires sustained movement before transport ownership can be claimed', () => {
    const first = observeProPresenterTransport(null, 1000, 0);
    const second = observeProPresenterTransport(first, 1750, 750);
    const third = observeProPresenterTransport(second, 2500, 1500);
    expect(first.movingTicks).toBe(0);
    expect(second.movingTicks).toBe(1);
    expect(third.movingTicks).toBe(2);
    expect(third.stillTicks).toBe(0);
  });

  it('counts sustained stillness and ignores large seeks as play-state evidence', () => {
    const first = observeProPresenterTransport(null, 1000, 0);
    const still1 = observeProPresenterTransport(first, 1000, 750);
    const still2 = observeProPresenterTransport(still1, 1000, 1500);
    expect(still2.stillTicks).toBe(2);

    const seek = observeProPresenterTransport(still2, 9000, 2250);
    expect(seek.movingTicks).toBe(0);
    expect(seek.stillTicks).toBe(0);
    expect(seek.positionMs).toBe(9000);
  });
});
