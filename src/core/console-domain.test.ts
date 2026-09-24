import { describe, expect, it } from 'vitest';
import { DEFAULT_PATCH, migratePatchedFixture, type PatchedFixture } from '../lib/fixtures';
import {
  assignFixturesToGroup,
  effectSupportedByFixture,
  fixtureFootprintLabel,
  fixtureIntensityPercent,
  fixturesInGroup,
  makeFixtureGroup,
  reconcileFixtureGroups,
  removeFixtureGroup,
  renameFixtureGroup
} from './console-domain';

const mover: PatchedFixture = migratePatchedFixture({
  id: 'mover-1', name: 'Mover 1', profileId: 'generic-moving-head', modeId: '14ch-common',
  universe: 2, address: 101, group: 'Movers', selected: false, collapsed: false
}, 0, 1);

describe('console domain adapters', () => {
  it('reconciles persisted groups with real patch membership and order', () => {
    const front = { ...makeFixtureGroup('Front Wash'), fixtureOrder: ['missing', DEFAULT_PATCH[0].id] };
    const groups = reconcileFixtureGroups([front], [mover, DEFAULT_PATCH[0]]);
    expect(groups.map((group) => group.name)).toEqual(['Front Wash', 'Movers']);
    expect(groups[0].fixtureOrder).toEqual([DEFAULT_PATCH[0].id]);
    expect(fixturesInGroup([mover, DEFAULT_PATCH[0]], groups[1]).map((fixture) => fixture.id)).toEqual(['mover-1']);
  });

  it('assigns, renames, and removes groups without deleting fixtures', () => {
    const groups = [makeFixtureGroup('Front Wash'), makeFixtureGroup('Movers', 1)];
    const assigned = assignFixturesToGroup([DEFAULT_PATCH[0], mover], [mover.id], 'Front Wash');
    expect(assigned.find((fixture) => fixture.id === mover.id)?.group).toBe('Front Wash');
    const renamed = renameFixtureGroup(groups, assigned, groups[0].id, 'Main Wash');
    expect(renamed.patch.every((fixture) => fixture.group === 'Main Wash')).toBe(true);
    const removed = removeFixtureGroup(renamed.groups, renamed.patch, groups[0].id);
    expect(removed.patch).toHaveLength(2);
    expect(removed.patch.every((fixture) => fixture.group === '')).toBe(true);
  });

  it('refuses duplicate group names at the domain boundary', () => {
    const groups = [makeFixtureGroup('Front Wash'), makeFixtureGroup('Movers', 1)];
    const result = renameFixtureGroup(groups, [DEFAULT_PATCH[0], mover], groups[1].id, 'front wash');
    expect(result.groups.map((group) => group.name)).toEqual(['Front Wash', 'Movers']);
    expect(result.patch).toEqual([DEFAULT_PATCH[0], mover]);
  });

  it('reads semantic intensity, footprint, and effect capability', () => {
    const frame = Array(512).fill(0);
    frame[4] = 128;
    expect(fixtureIntensityPercent(frame, DEFAULT_PATCH[0])).toBe(50);
    expect(fixtureFootprintLabel(mover)).toBe('U2 · 101–114');
    expect(effectSupportedByFixture('sweep', mover)).toBe(true);
    expect(effectSupportedByFixture('sweep', DEFAULT_PATCH[0])).toBe(false);
  });
});
