import { describe, expect, it } from 'vitest';
import { collectMediaIds, countMediaIds, mediaKindForName, mediaNameForId, nativeMediaLibraryAvailable } from './media-library';

describe('media library helpers', () => {
  it('classifies supported media names', () => {
    expect(mediaKindForName('song.wav')).toBe('audio');
    expect(mediaKindForName('walk-in.mp4')).toBe('video');
    expect(mediaKindForName('logo.PNG')).toBe('image');
    expect(mediaKindForName('unknown.bin', 'video/mp4')).toBe('video');
  });

  it('collects media ids across nested show/program state without duplicates', () => {
    const value = {
      working: {
        songs: [{ mediaId: 'song-a', mediaName: 'a.wav' }],
        timeline: { videoClips: [{ mediaId: 'video-a', name: 'intro.mp4' }] },
      },
      recovery: [{ show: { songs: [{ mediaId: 'song-a', mediaName: 'a.wav' }] } }],
    };
    expect(collectMediaIds(value).sort()).toEqual(['song-a', 'video-a']);
  });

  it('counts references and resolves a display name', () => {
    const value = {
      a: { mediaId: 'shared', mediaName: 'main.wav' },
      b: [{ mediaId: 'shared', name: 'clip.wav' }, { mediaId: 'other', name: 'video.mp4' }],
    };
    expect(countMediaIds(value)).toEqual({ shared: 2, other: 1 });
    expect(mediaNameForId(value, 'shared')).toBe('main.wav');
    expect(mediaNameForId(value, 'other')).toBe('video.mp4');
  });

  it('keeps native-only calls disabled in unit-test browserless runtime', () => {
    expect(nativeMediaLibraryAvailable()).toBe(false);
  });
});
