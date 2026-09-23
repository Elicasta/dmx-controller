import type { EffectId } from '../lib/effects';
import { findMode, parameterChannel, readFixtureParameter, type FixtureParameter, type PatchedFixture } from '../lib/fixtures';
import type { FixtureGroup } from '../lib/show';

const GROUP_COLORS = ['#55e98d', '#ff3dbb', '#8b5cf6', '#35a7ff', '#f7be45', '#27d3d8'];

function groupId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
  let hash = 0;
  for (const character of name) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return `group-${slug}-${Math.abs(hash).toString(36)}`;
}

export function makeFixtureGroup(name: string, index = 0): FixtureGroup {
  const cleanName = name.trim().slice(0, 64) || `Group ${index + 1}`;
  return {
    id: groupId(cleanName),
    name: cleanName,
    labelColor: GROUP_COLORS[index % GROUP_COLORS.length],
    masterDefault: 100,
    fxEnabled: true,
    notes: '',
    fixtureOrder: []
  };
}

export function reconcileFixtureGroups(
  saved: readonly FixtureGroup[],
  patch: readonly PatchedFixture[]
): FixtureGroup[] {
  const next = saved.map((group) => ({ ...group, fixtureOrder: [...group.fixtureOrder] }));
  const names = new Set(next.map((group) => group.name));
  patch.forEach((fixture) => {
    const name = fixture.group.trim();
    if (name && !names.has(name)) {
      next.push(makeFixtureGroup(name, next.length));
      names.add(name);
    }
  });
  return next.map((group) => {
    const members = patch.filter((fixture) => fixture.group === group.name).map((fixture) => fixture.id);
    const ordered = group.fixtureOrder.filter((id) => members.includes(id));
    members.forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
    return { ...group, fixtureOrder: ordered };
  });
}

export function fixturesInGroup(
  patch: readonly PatchedFixture[],
  group: Pick<FixtureGroup, 'name' | 'fixtureOrder'>
): PatchedFixture[] {
  const order = new Map(group.fixtureOrder.map((id, index) => [id, index]));
  return patch
    .filter((fixture) => fixture.group === group.name)
    .sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

export function getSelectedFixtures(patch: readonly PatchedFixture[]): PatchedFixture[] {
  return patch.filter((fixture) => fixture.selected);
}

export function fixtureSupportsParameter(fixture: PatchedFixture, parameter: FixtureParameter): boolean {
  return parameterChannel(fixture, parameter) !== null;
}

export function fixtureSupportsColor(fixture: PatchedFixture): boolean {
  return ['red', 'green', 'blue'].every((parameter) => (
    fixtureSupportsParameter(fixture, parameter as FixtureParameter)
  ));
}

export function fixtureIntensityPercent(frame: readonly number[], fixture: PatchedFixture): number | null {
  if (!fixtureSupportsParameter(fixture, 'dimmer')) return null;
  return Math.round(readFixtureParameter(frame, fixture, 'dimmer') / 255 * 100);
}

export function fixtureFootprintLabel(fixture: PatchedFixture): string {
  const mode = findMode(fixture);
  const end = fixture.address + (mode?.channelCount ?? 1) - 1;
  const prefix = `U${fixture.universe ?? 1}`;
  return `${prefix} · ${String(fixture.address).padStart(3, '0')}${end === fixture.address ? '' : `–${String(end).padStart(3, '0')}`}`;
}

export function effectSupportedByFixture(effect: EffectId, fixture: PatchedFixture): boolean {
  if (effect === 'sweep') return fixtureSupportsParameter(fixture, 'pan') && fixtureSupportsParameter(fixture, 'tilt');
  if (effect === 'uv-pulse') return fixtureSupportsParameter(fixture, 'uv');
  if (effect === 'rainbow' || effect === 'color-chase') return fixtureSupportsColor(fixture);
  if (effect === 'strobe') return fixtureSupportsParameter(fixture, 'strobe') || fixtureSupportsParameter(fixture, 'dimmer');
  return fixtureSupportsParameter(fixture, 'dimmer');
}

export function effectSupportedByFixtures(effect: EffectId, fixtures: readonly PatchedFixture[]): boolean {
  return fixtures.length > 0 && fixtures.some((fixture) => effectSupportedByFixture(effect, fixture));
}

export function assignFixturesToGroup(
  patch: readonly PatchedFixture[],
  fixtureIds: readonly string[],
  groupName: string
): PatchedFixture[] {
  const ids = new Set(fixtureIds);
  return patch.map((fixture) => ids.has(fixture.id) ? { ...fixture, group: groupName } : fixture);
}

export function removeFixtureGroup(
  groups: readonly FixtureGroup[],
  patch: readonly PatchedFixture[],
  groupIdToRemove: string
): { groups: FixtureGroup[]; patch: PatchedFixture[] } {
  const removed = groups.find((group) => group.id === groupIdToRemove);
  return {
    groups: groups.filter((group) => group.id !== groupIdToRemove),
    patch: removed ? patch.map((fixture) => fixture.group === removed.name ? { ...fixture, group: '' } : fixture) : [...patch]
  };
}

export function renameFixtureGroup(
  groups: readonly FixtureGroup[],
  patch: readonly PatchedFixture[],
  groupIdToRename: string,
  nextName: string
): { groups: FixtureGroup[]; patch: PatchedFixture[] } {
  const cleanName = nextName.trim().slice(0, 64);
  const current = groups.find((group) => group.id === groupIdToRename);
  if (!current || !cleanName) return { groups: [...groups], patch: [...patch] };
  return {
    groups: groups.map((group) => group.id === groupIdToRename ? { ...group, name: cleanName } : group),
    patch: patch.map((fixture) => fixture.group === current.name ? { ...fixture, group: cleanName } : fixture)
  };
}
