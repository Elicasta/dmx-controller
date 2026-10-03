import { describe, expect, it } from 'vitest';
import { buildShowPreflight, preflightSummary } from './show-preflight';

const ready = {
  dmxConnected: true,
  blackout: false,
  fixtureCount: 8,
  cueCount: 40,
  songCount: 8,
  timelineClipCount: 80,
  missingMediaNames: [],
  displayCount: 2,
  assignedVideoInputs: 0,
  videoInputCount: 0,
  videoPermissionBlocked: false,
};

describe('show preflight', () => {
  it('marks a healthy two-display physical-DMX show ready', () => {
    const items = buildShowPreflight(ready);
    expect(items.every(item => item.level === 'pass')).toBe(true);
    expect(preflightSummary(items)).toEqual({ level: 'pass', label: 'READY' });
  });

  it('blocks on blackout, missing media and unavailable assigned video input', () => {
    const items = buildShowPreflight({
      ...ready,
      blackout: true,
      missingMediaNames: ['walk-in.mp4'],
      assignedVideoInputs: 1,
      videoPermissionBlocked: true,
    });
    expect(items.filter(item => item.level === 'fail').map(item => item.id)).toEqual(['blackout', 'media', 'video-input']);
    expect(preflightSummary(items).level).toBe('fail');
  });

  it('warns instead of failing for intentional virtual DMX or one-display rehearsal', () => {
    const items = buildShowPreflight({ ...ready, dmxConnected: false, displayCount: 1 });
    expect(items.find(item => item.id === 'dmx')?.level).toBe('warn');
    expect(items.find(item => item.id === 'display')?.level).toBe('warn');
    expect(preflightSummary(items).level).toBe('warn');
  });

  it('warns when a show approaches supported collection limits', () => {
    const items = buildShowPreflight({ ...ready, cueCount: 190, timelineClipCount: 950 });
    expect(items.find(item => item.id === 'show-size')?.level).toBe('warn');
  });
});
