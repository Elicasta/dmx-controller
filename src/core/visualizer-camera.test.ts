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

describe('orthographic programming cameras', () => {
  it('preserves scale across depth in front and side views',()=>{
    for(const preset of ['front','side'] as const){
      const camera=visualizerCameraPreset(preset,DEFAULT_STAGE_DIMENSIONS);
      expect(camera.projection).toBe('orthographic');
      const a=projectVisualizerPoint(camera.target,camera,1000,600);
      const b=projectVisualizerPoint({...camera.target,y:camera.target.y+1},camera,1000,600);
      const away=preset==='front'?{...camera.target,z:camera.target.z-5}:{...camera.target,x:camera.target.x-5};
      const c=projectVisualizerPoint(away,camera,1000,600);
      const d=projectVisualizerPoint({...away,y:away.y+1},camera,1000,600);
      expect(Math.abs(b.y-a.y)).toBeCloseTo(Math.abs(d.y-c.y));
    }
  });
  it('projects top-view positions without perspective distortion or singular basis',()=>{
    const camera=visualizerCameraPreset('top',DEFAULT_STAGE_DIMENSIONS);
    const a=projectVisualizerPoint({x:0,y:0,z:2},camera,800,500);
    const b=projectVisualizerPoint({x:1,y:0,z:2},camera,800,500);
    const c=projectVisualizerPoint({x:0,y:5,z:2},camera,800,500);
    const d=projectVisualizerPoint({x:1,y:5,z:2},camera,800,500);
    expect(b.x-a.x).toBeCloseTo(d.x-c.x);
    expect(Number.isFinite(a.y)).toBe(true);
  });
});
