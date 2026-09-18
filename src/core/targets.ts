import { stageElementPosition, type StageElement } from '../lib/stage';
import type { StageDimensions, Vec3 } from './geometry';

export type TargetCategory = 'stage' | 'performer' | 'scenery' | 'audience' | 'custom';
export type TargetArrangement = 'converge' | 'fan-horizontal' | 'fan-vertical' | 'mirror' | 'cross';

export type TargetPoint = {
  id: string;
  name: string;
  position: Vec3;
  category: TargetCategory;
};

function elementCategory(element: StageElement): TargetCategory {
  if (element.type === 'person' || element.type === 'drums') return 'performer';
  return 'scenery';
}

export function buildStageTargets(elements: readonly StageElement[], dimensions: StageDimensions): TargetPoint[] {
  const staticTargets: TargetPoint[] = [
    { id: 'target-center-stage', name: 'Center Stage', position: { x: 0, y: 1.2, z: dimensions.depth * .48 }, category: 'stage' },
    { id: 'target-stage-left', name: 'Stage Left', position: { x: -dimensions.width * .34, y: 1.2, z: dimensions.depth * .48 }, category: 'stage' },
    { id: 'target-stage-right', name: 'Stage Right', position: { x: dimensions.width * .34, y: 1.2, z: dimensions.depth * .48 }, category: 'stage' },
    { id: 'target-back-wall', name: 'Back Wall', position: { x: 0, y: dimensions.height * .42, z: dimensions.depth }, category: 'scenery' },
    { id: 'target-audience-center', name: 'Audience Center', position: { x: 0, y: 1.4, z: -dimensions.roomDepth * .3 }, category: 'audience' },
    { id: 'target-audience-left', name: 'Audience Left', position: { x: -dimensions.roomWidth * .28, y: 1.4, z: -dimensions.roomDepth * .3 }, category: 'audience' },
    { id: 'target-audience-right', name: 'Audience Right', position: { x: dimensions.roomWidth * .28, y: 1.4, z: -dimensions.roomDepth * .3 }, category: 'audience' }
  ];
  const elementTargets = elements.map((element): TargetPoint => ({
    id: `target-element-${element.id}`,
    name: element.label,
    position: stageElementPosition(element, dimensions),
    category: elementCategory(element)
  }));
  return [...staticTargets, ...elementTargets];
}

export function arrangeTargetPoints(
  target: Vec3,
  count: number,
  arrangement: TargetArrangement = 'converge',
  spreadMeters = 4
): Vec3[] {
  if (count <= 0) return [];
  if (count === 1 || arrangement === 'converge') return Array.from({ length: count }, () => ({ ...target }));
  const normalizedIndex = (index: number) => count === 1 ? 0 : index / (count - 1) - .5;
  return Array.from({ length: count }, (_, index) => {
    const amount = normalizedIndex(index) * spreadMeters;
    if (arrangement === 'fan-horizontal') return { ...target, x: target.x + amount };
    if (arrangement === 'fan-vertical') return { ...target, y: target.y + amount };
    if (arrangement === 'mirror') {
      const side = index % 2 === 0 ? -1 : 1;
      const tier = Math.floor(index / 2) + 1;
      return { ...target, x: target.x + side * spreadMeters * tier / Math.max(2, count) };
    }
    const crossAmount = Math.abs(amount) < 1e-6 ? spreadMeters * .18 : amount;
    return index % 2 === 0
      ? { ...target, x: target.x + crossAmount }
      : { ...target, y: target.y + crossAmount };
  });
}
