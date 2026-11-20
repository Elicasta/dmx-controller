import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { parseFixtureImport } from './fixture-import';
import { DEFAULT_PATCH, FIXTURE_LIBRARY, registerImportedProfiles, validatePatch } from './fixtures';

const sample = JSON.stringify({
  manufacturer: 'Fixture Lab',
  name: 'RGB Moving Head',
  categories: ['Moving Head'],
  availableChannels: {
    Dimmer: { type: 'Intensity' },
    Red: { type: 'ColorIntensity', color: 'Red' },
    Green: { type: 'ColorIntensity', color: 'Green' },
    Pan: { type: 'Pan', fineChannelAliases: ['Pan fine'] },
    Tilt: { type: 'Tilt' },
    Mystery: { type: 'Maintenance' }
  },
  modes: [
    { name: 'Seven channel', shortName: '7ch', channels: [
      'Dimmer', 'Red', 'Green', 'Pan', 'Pan fine', 'Tilt', 'Mystery'
    ] }
  ]
});

describe('fixture definition compatibility', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); }
    } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('converts OFL aliases and retains unmapped DMX slots', () => {
    const [profile] = parseFixtureImport('head.json', sample);
    const mode = profile.modes[0];
    expect(profile.verified).toBe(false);
    expect(profile.id).toBe('ofl-fixture-lab-rgb-moving-head');
    expect(mode.channelCount).toBe(7);
    expect(mode.channels.map((channel) => channel.parameter)).toEqual([
      'dimmer','red','green','pan','panFine','tilt',undefined
    ]);
  });

  it('registers without replacing built-in fixtures or changing a saved patch', () => {
    const [profile] = parseFixtureImport('head.json', sample);
    const existingCount = FIXTURE_LIBRARY.length;
    expect(registerImportedProfiles([profile])).toBe(1);
    expect(FIXTURE_LIBRARY.length).toBe(existingCount + 1);
    expect(registerImportedProfiles([profile])).toBe(0);
    expect(validatePatch(DEFAULT_PATCH[0], DEFAULT_PATCH)).toBeNull();
    expect(FIXTURE_LIBRARY[0].id).toBe('adj-mega-par-profile-plus');
  });

  it('rejects unsupported matrix modes instead of guessing the footprint', () => {
    const value = JSON.parse(sample);
    value.modes[0].channels = [{ insert: 'matrixChannels', repeatFor: 'eachPixel' }];
    expect(() => parseFixtureImport('matrix.json', JSON.stringify(value))).toThrow(/matrix/i);
  });

  it('rejects malformed JSON, oversized files and invalid channels', () => {
    expect(() => parseFixtureImport('head.json', '{')).toThrow(/invalid/i);
    expect(() => parseFixtureImport('head.gdtf', sample)).toThrow(/supported/i);
    expect(() => parseFixtureImport('head.json', ' '.repeat(2_000_001))).toThrow(/2 MB/);
    const [profile] = parseFixtureImport('head.json', sample);
    profile.modes[0].channels[0].offset = 700;
    expect(() => registerImportedProfiles([profile])).toThrow(/invalid/i);
  });

  it('does not mutate the profile library when persistence fails', () => {
    const [profile] = parseFixtureImport('head.json', sample);
    profile.id += '-quota-test';
    const before = FIXTURE_LIBRARY.length;
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw Error('quota'); } } });
    expect(() => registerImportedProfiles([profile])).toThrow(/storage/i);
    expect(FIXTURE_LIBRARY.length).toBe(before);
  });

  it('rejects QLC+ external entities before any XML parsing', () => {
    expect(() => parseFixtureImport('bad.qxf', '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><FixtureDefinition/>')).toThrow(/DTD/i);
  });
});
