import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGE_DIMENSIONS } from './geometry';
import {
  cameraBasis,
  cameraOrbitFromPose,
  interpolateVisualizerCamera,
  orbitVisualizerCamera,
  projectVisualizerPoint,
  visualizerCameraPreset,
  visualizerFlybyCamera
} from './visualizer-camera';

describe('visualizer camera math', () => {
  it('projects the stage center into the visible canvas', () => {
    const camera = visualizerCameraPreset('foh', DEFAULT_STAGE_DIMENSIONS);
    const projected = projectVisualizerPoint(
      { x: 0, y: DEFAULT_STAGE_DIMENSIONS.height * .25, z: DEFAULT_STAGE_DIMENSIONS.depth * .45 },
      camera,
      1200,
      700
    );

    expect(projected.visible).toBe(true);
    expect(projected.depth).toBeGreaterThan(0);
    expect(projected.x).toBeGreaterThan(300);
    expect(projected.x).toBeLessThan(900);
  });

  it('keeps camera basis orthogonal enough for rendering', () => {
    const basis = cameraBasis(visualizerCameraPreset('stage-left', DEFAULT_STAGE_DIMENSIONS));
    const dot = (a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}) => a.x*b.x+a.y*b.y+a.z*b.z;
    expect(Math.abs(dot(basis.forward, basis.right))).toBeLessThan(1e-6);
    expect(Math.abs(dot(basis.forward, basis.up))).toBeLessThan(1e-6);
  });

  it('round trips an orbit camera pose', () => {
    const camera = orbitVisualizerCamera({ x: 0, y: 1, z: 2 }, .7, .3, 15, 55);
    const orbit = cameraOrbitFromPose(camera);
    expect(orbit.yaw).toBeCloseTo(.7, 5);
    expect(orbit.pitch).toBeCloseTo(.3, 5);
    expect(orbit.distance).toBeCloseTo(15, 5);
  });

  it('interpolates and completes the flyby at valid poses', () => {
    const a = visualizerCameraPreset('foh', DEFAULT_STAGE_DIMENSIONS);
    const b = visualizerCameraPreset('close', DEFAULT_STAGE_DIMENSIONS);
    const midpoint = interpolateVisualizerCamera(a, b, .5);
    const flyby = visualizerFlybyCamera(.72, DEFAULT_STAGE_DIMENSIONS);

    expect(midpoint.position.z).toBeLessThan(a.position.z);
    expect(midpoint.position.z).toBeGreaterThan(b.position.z);
    expect(Number.isFinite(flyby.position.x)).toBe(true);
    expect(Number.isFinite(flyby.target.z)).toBe(true);
  });
});
