import { applyUniverseUpdates, clampDmx, makeUniverse, type DmxUpdate } from '../lib/dmx';
import {
  fixtureColorUpdates,
  parameterChannel,
  fixtureParameterUpdate,
  type PatchedFixture
} from '../lib/fixtures';
import type { ControlCommandEnvelope, ControlSource } from './control-command';
import { aimFixtureAtTarget, fixtureMovementUpdates } from './fixture-geometry';
import { arrangeTargetPoints } from './targets';

export type AttributeSourceTrace = {
  source: ControlSource;
  commandId: string;
  commandType: ControlCommandEnvelope['command']['type'];
  timestamp: number;
};

export type ShowRuntimeSnapshot = {
  revision: number;
  activeUniverse: number;
  universes: ReadonlyMap<number, readonly number[]>;
  patch: readonly PatchedFixture[];
  master: number;
  blackout: boolean;
  lastCommand: ControlCommandEnvelope | null;
  sourceTrace: ReadonlyMap<string, AttributeSourceTrace>;
  groupMasters: ReadonlyMap<string, number>;
};

export type RuntimeDispatchResult = {
  revision: number;
  universe: number;
  frame: number[];
  baseFrame: number[];
  changedChannels: number[];
  patchChanged: boolean;
  warnings: string[];
};

function normalizeFrame(values: readonly number[]): number[] {
  return Array.from({ length: 512 }, (_, index) => clampDmx(values[index] ?? 0));
}

function changedChannels(previous: readonly number[], next: readonly number[]): number[] {
  const result: number[] = [];
  for (let index = 0; index < 512; index += 1) {
    if ((previous[index] ?? 0) !== (next[index] ?? 0)) result.push(index + 1);
  }
  return result;
}

export class ShowRuntime {
  private revision = 0;
  private activeUniverse = 1;
  private baseUniverses = new Map<number, number[]>([[1, makeUniverse()]]);
  private universes = new Map<number, number[]>([[1, makeUniverse()]]);
  private patch: PatchedFixture[] = [];
  private master = 1;
  private blackout = false;
  private lastCommand: ControlCommandEnvelope | null = null;
  private sourceTrace = new Map<string, AttributeSourceTrace>();
  private groupMasters = new Map<string, number>();

  constructor(initial?: { frame?: readonly number[]; patch?: readonly PatchedFixture[] }) {
    if (initial?.frame) {
      const frame = normalizeFrame(initial.frame);
      this.baseUniverses.set(1, frame);
      this.universes.set(1, [...frame]);
    }
    if (initial?.patch) this.patch = initial.patch.map((fixture) => ({ ...fixture }));
  }

  get frame(): readonly number[] {
    return this.universes.get(this.activeUniverse) ?? makeUniverse();
  }

  get baseFrame(): readonly number[] {
    return this.baseUniverses.get(this.activeUniverse) ?? makeUniverse();
  }

  get snapshot(): ShowRuntimeSnapshot {
    return {
      revision: this.revision,
      activeUniverse: this.activeUniverse,
      universes: new Map([...this.universes].map(([universe, frame]) => [universe, [...frame]])),
      patch: this.patch.map((fixture) => ({ ...fixture })),
      master: this.master,
      blackout: this.blackout,
      lastCommand: this.lastCommand,
      sourceTrace: new Map(this.sourceTrace),
      groupMasters: new Map(this.groupMasters)
    };
  }

  configurePatch(patch: readonly PatchedFixture[]) {
    this.patch = patch.map((fixture) => ({ ...fixture }));
  }

  sourceFor(universe: number, channel: number): AttributeSourceTrace | undefined {
    return this.sourceTrace.get(`${universe}:${channel}`);
  }

  dispatch(envelope: ControlCommandEnvelope): RuntimeDispatchResult {
    const command = envelope.command;
    const universe = 'universe' in command ? command.universe : this.activeUniverse;
    this.activeUniverse = universe;
    const previous = this.universes.get(universe) ?? makeUniverse();
    const previousBase = this.baseUniverses.get(universe) ?? makeUniverse();
    let nextBase = [...previousBase];
    let outputOverride: number[] | null = null;
    let patchChanged = false;
    const warnings: string[] = [];

    if (command.type === 'frame.replace') {
      nextBase = normalizeFrame(command.values);
    } else if (command.type === 'frame.output.replace') {
      nextBase = normalizeFrame(command.values);
      outputOverride = [...nextBase];
    } else if (command.type === 'frame.update') {
      nextBase = applyUniverseUpdates(previousBase, command.updates);
    } else if (command.type === 'fixture.attribute') {
      const updates = this.fixtureUpdates(command.fixtureIds, (fixture) => {
        const update = fixtureParameterUpdate(fixture, command.parameter, command.value);
        return update ? [update] : [];
      });
      nextBase = applyUniverseUpdates(previousBase, updates);
    } else if (command.type === 'fixture.color') {
      const updates = this.fixtureUpdates(command.fixtureIds, (fixture) => fixtureColorUpdates(fixture, [
        command.color.red,
        command.color.green,
        command.color.blue
      ]));
      nextBase = applyUniverseUpdates(previousBase, updates);
    } else if (command.type === 'fixture.position') {
      const positions = new Map(command.positions.map((position) => [position.fixtureId, position]));
      const updates = this.patch
        .filter((fixture) => (fixture.universe ?? 1) === universe && positions.has(fixture.id))
        .flatMap((fixture) => {
          const position = positions.get(fixture.id)!;
          const resolved = fixtureMovementUpdates(fixture, position.panNormalized, position.tiltNormalized);
          if (!resolved.length) warnings.push(`${fixture.name} has no Pan/Tilt channels for this absolute palette.`);
          return resolved;
        });
      nextBase = applyUniverseUpdates(previousBase, updates);
    } else if (command.type === 'fixture.target') {
      const ids = new Set(command.fixtureIds);
      const fixtures = this.patch
        .map((fixture, index) => ({ fixture, index }))
        .filter(({ fixture }) => (fixture.universe ?? 1) === universe && ids.has(fixture.id));
      const targets = arrangeTargetPoints(command.target, fixtures.length, command.arrangement, command.spreadMeters);
      const updates = fixtures.flatMap(({ fixture, index }, targetIndex) => {
        const solution = aimFixtureAtTarget(previousBase, fixture, targets[targetIndex], index, this.patch.length);
        if (!solution) {
          warnings.push(`${fixture.name} has no Pan/Tilt geometry.`);
          return [];
        }
        if (!solution.reachable) {
          warnings.push(`${fixture.name} cannot reach that target within its movement range.`);
          return [];
        }
        return solution.updates;
      });
      nextBase = applyUniverseUpdates(previousBase, updates);
    } else if (command.type === 'fixture.select') {
      const ids = new Set(command.fixtureIds);
      this.patch = this.patch.map((fixture) => {
        const selected = command.mode === 'replace'
          ? ids.has(fixture.id)
          : command.mode === 'add'
          ? fixture.selected || ids.has(fixture.id)
          : command.mode === 'remove'
          ? fixture.selected && !ids.has(fixture.id)
          : ids.has(fixture.id) ? !fixture.selected : fixture.selected;
        return selected === fixture.selected ? fixture : { ...fixture, selected };
      });
      patchChanged = true;
    } else if (command.type === 'group.color') {
      const updates = this.patch
        .filter((fixture) => (fixture.universe ?? 1) === universe && fixture.group === command.groupName)
        .flatMap((fixture) => fixtureColorUpdates(fixture, [command.color.red, command.color.green, command.color.blue]));
      nextBase = applyUniverseUpdates(previousBase, updates);
    } else if (command.type === 'group.master.set') {
      this.groupMasters.set(command.groupName, Math.max(0, Math.min(1, command.value)));
    } else if (command.type === 'master.set') {
      this.master = Math.max(0, Math.min(1, command.value));
    } else if (command.type === 'blackout.set') {
      this.blackout = command.active;
    }

    const next = outputOverride ?? this.resolveFrame(universe, nextBase);
    const changed = changedChannels(previous, next);
    this.baseUniverses.set(universe, nextBase);
    this.universes.set(universe, next);
    this.lastCommand = envelope;
    this.revision += 1;
    const trace: AttributeSourceTrace = {
      source: envelope.source,
      commandId: envelope.id,
      commandType: command.type,
      timestamp: envelope.timestamp
    };
    changed.forEach((channel) => this.sourceTrace.set(`${universe}:${channel}`, trace));

    return {
      revision: this.revision,
      universe,
      frame: [...next],
      baseFrame: [...nextBase],
      changedChannels: changed,
      patchChanged,
      warnings
    };
  }

  private resolveFrame(universe: number, base: readonly number[]): number[] {
    const next = [...base];
    this.patch
      .filter((fixture) => (fixture.universe ?? 1) === universe)
      .forEach((fixture) => {
        const dimmer = parameterChannel(fixture, 'dimmer');
        if (!dimmer) return;
        const groupMaster = this.groupMasters.get(fixture.group) ?? 1;
        next[dimmer - 1] = clampDmx((base[dimmer - 1] ?? 0) * groupMaster * this.master);
      });
    return next;
  }

  private fixtureUpdates(
    fixtureIds: readonly string[],
    resolve: (fixture: PatchedFixture) => ReadonlyArray<DmxUpdate>
  ): DmxUpdate[] {
    const ids = new Set(fixtureIds);
    return this.patch
      .filter((fixture) => (fixture.universe ?? 1) === this.activeUniverse && ids.has(fixture.id))
      .flatMap((fixture) => resolve(fixture));
  }
}
