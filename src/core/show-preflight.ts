export type PreflightLevel = 'pass' | 'warn' | 'fail';

export type ShowPreflightItem = {
  id: string;
  label: string;
  level: PreflightLevel;
  detail: string;
};

export type ShowPreflightInput = {
  dmxConnected: boolean;
  dmxError?: string;
  blackout: boolean;
  fixtureCount: number;
  cueCount: number;
  songCount: number;
  timelineClipCount: number;
  missingMediaNames: string[];
  displayCount: number;
  assignedVideoInputs: number;
  videoInputCount: number;
  missingVideoInputNames: string[];
  videoPermissionBlocked: boolean;
  visualizerError?: string;
};

export function buildShowPreflight(input: ShowPreflightInput): ShowPreflightItem[] {
  const items: ShowPreflightItem[] = [];

  items.push(input.blackout
    ? { id: 'blackout', label: 'Blackout', level: 'fail', detail: 'Blackout is active. Release it before show playback.' }
    : { id: 'blackout', label: 'Blackout', level: 'pass', detail: 'Output blackout is clear.' });

  if (input.dmxError) {
    items.push({ id: 'dmx', label: 'DMX Output', level: 'fail', detail: input.dmxError });
  } else if (input.dmxConnected) {
    items.push({ id: 'dmx', label: 'DMX Output', level: 'pass', detail: 'Physical DMX interface is connected.' });
  } else {
    items.push({ id: 'dmx', label: 'DMX Output', level: 'warn', detail: 'Running in virtual output mode. Connect physical DMX before the show if required.' });
  }

  if (input.missingMediaNames.length) {
    const names = input.missingMediaNames.slice(0, 3).join(', ');
    const remainder = input.missingMediaNames.length > 3 ? ` +${input.missingMediaNames.length - 3} more` : '';
    items.push({ id: 'media', label: 'Media', level: 'fail', detail: `Missing media: ${names}${remainder}.` });
  } else {
    items.push({ id: 'media', label: 'Media', level: 'pass', detail: 'All referenced native media is available.' });
  }

  if (input.assignedVideoInputs > 0) {
    if (input.videoPermissionBlocked) {
      items.push({ id: 'video-input', label: 'Video Inputs', level: 'fail', detail: 'A screen uses a live video input, but camera/video-input permission is blocked.' });
    } else if (input.missingVideoInputNames.length) {
      const names = input.missingVideoInputNames.slice(0, 3).join(', ');
      const remainder = input.missingVideoInputNames.length > 3 ? ` +${input.missingVideoInputNames.length - 3} more` : '';
      items.push({ id: 'video-input', label: 'Video Inputs', level: 'fail', detail: `Assigned video input unavailable: ${names}${remainder}.` });
    } else if (input.videoInputCount === 0) {
      items.push({ id: 'video-input', label: 'Video Inputs', level: 'fail', detail: 'A screen expects a live video input, but no video input is currently available.' });
    } else {
      items.push({ id: 'video-input', label: 'Video Inputs', level: 'pass', detail: `${input.videoInputCount} video input${input.videoInputCount === 1 ? '' : 's'} available for ${input.assignedVideoInputs} assigned screen${input.assignedVideoInputs === 1 ? '' : 's'}.` });
    }
  }

  items.push(input.displayCount > 1
    ? { id: 'display', label: 'Displays', level: 'pass', detail: `${input.displayCount} displays detected. Pop-out Visualizer/Video Output will target the secondary display.` }
    : { id: 'display', label: 'Displays', level: 'warn', detail: 'Only one display detected. Second-screen output cannot be verified on this machine.' });

  if (input.visualizerError) {
    items.push({ id: 'visualizer', label: 'Visualizer', level: 'warn', detail: input.visualizerError });
  } else {
    items.push({ id: 'visualizer', label: 'Visualizer', level: 'pass', detail: 'Visualizer renderer is available.' });
  }

  if (input.fixtureCount === 0) {
    items.push({ id: 'show-size', label: 'Show Data', level: 'warn', detail: 'No fixtures are patched.' });
  } else {
    const nearLimit = input.cueCount >= 180 || input.songCount >= 90 || input.timelineClipCount >= 900;
    items.push({
      id: 'show-size',
      label: 'Show Data',
      level: nearLimit ? 'warn' : 'pass',
      detail: `${input.fixtureCount} fixtures · ${input.songCount} songs · ${input.cueCount} cues · ${input.timelineClipCount} timeline clips${nearLimit ? ' · near a supported collection limit' : ''}.`
    });
  }

  return items;
}

export function preflightSummary(items: readonly ShowPreflightItem[]) {
  const failures = items.filter(item => item.level === 'fail').length;
  const warnings = items.filter(item => item.level === 'warn').length;
  if (failures) return { level: 'fail' as const, label: `${failures} BLOCKER${failures === 1 ? '' : 'S'}` };
  if (warnings) return { level: 'warn' as const, label: `${warnings} WARNING${warnings === 1 ? '' : 'S'}` };
  return { level: 'pass' as const, label: 'READY' };
}
