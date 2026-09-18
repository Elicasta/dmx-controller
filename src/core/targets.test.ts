import { describe, expect, it } from 'vitest';
import { arrangeTargetPoints } from './targets';

describe('group target arrangements', () => {
  const target = { x: 0, y: 2, z: 4 };

  it('converges every fixture on the same point', () => {
    expect(arrangeTargetPoints(target, 3, 'converge')).toEqual([target, target, target]);
  });

  it('creates a symmetric horizontal fan in fixture order', () => {
    expect(arrangeTargetPoints(target, 3, 'fan-horizontal', 6).map((point) => point.x)).toEqual([-3, 0, 3]);
  });

  it('creates a vertical fan without changing X/Z', () => {
    expect(arrangeTargetPoints(target, 2, 'fan-vertical', 4)).toEqual([
      { x: 0, y: 0, z: 4 },
      { x: 0, y: 4, z: 4 }
    ]);
  });
});
