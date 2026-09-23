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
  baseUniverses: ReadonlyMap<number, readonly number[]>;
  patch: readonly PatchedFixture[];
  master: number;
  blackout: boolean;
  lastCommand: ControlCommandEnvelope | null;
  sourceTrace: ReadonlyMap<string, AttributeSourceTrace>;
  groupMasters: ReadonlyMap<string, number>;
};

export type RuntimeOutputFrame = {
  universe: number;
  frame: number[];
  baseFrame: number[];
  changedChannels: number[];
};

export type RuntimeDispatchResult = RuntimeOutputFrame & {
  revision: number;
  outputs: RuntimeOutputFrame[];
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
  private flashFixtureIds = new Set<string>();

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
      baseUniverses: new Map([...this.baseUniverses].map(([universe, frame]) => [universe, [...frame]])),
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
    if (command.type === 'frame.batch.replace') return this.dispatchBatchReplace(envelope, command.frames);
    const targetUniverses = this.commandUniverses(command);
    const groupUniverses = command.type === 'group.color' || command.type === 'group.master.set'
      ? targetUniverses
      : [];
    const universe = 'universe' in command
      ? command.universe
      : targetUniverses[0] ?? this.activeUniverse;
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
    } else if (command.type === 'fixture.flash.set') {
      for (const fixtureId of command.fixtureIds) {
        if (command.active) this.flashFixtureIds.add(fixtureId);
        else this.flashFixtureIds.delete(fixtureId);
      }
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
      nextBase = this.applyTargetCommand(command, universe, previousBase, warnings);
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

    const outputs: RuntimeOutputFrame[] = [{
      universe,
      frame: [...next],
      baseFrame: [...nextBase],
      changedChannels: changed
    }];

    for (const secondaryUniverse of targetUniverses) {
      if (secondaryUniverse === universe) continue;
      const secondaryPrevious = this.universes.get(secondaryUniverse) ?? makeUniverse();
      const secondaryBase = this.baseUniverses.get(secondaryUniverse) ?? makeUniverse();
      const secondaryNextBase = this.applyCommandToUniverseBase(command, secondaryUniverse, secondaryBase, warnings);
      const secondaryNext = this.resolveFrame(secondaryUniverse, secondaryNextBase);
      const secondaryChanged = changedChannels(secondaryPrevious, secondaryNext);
      this.baseUniverses.set(secondaryUniverse, secondaryNextBase);
      this.universes.set(secondaryUniverse, secondaryNext);
      secondaryChanged.forEach((channel) => this.sourceTrace.set(`${secondaryUniverse}:${channel}`, trace));
      outputs.push({
        universe: secondaryUniverse,
        frame: [...secondaryNext],
        baseFrame: [...secondaryNextBase],
        changedChannels: secondaryChanged
      });
    }

    return {
      revision: this.revision,
      universe,
      frame: [...next],
      baseFrame: [...nextBase],
      changedChannels: changed,
      outputs,
      patchChanged,
      warnings
    };
  }

  private dispatchBatchReplace(
    envelope: ControlCommandEnvelope,
    frames: Array<{ universe: number; values: readonly number[] }>
  ): RuntimeDispatchResult {
    const unique = new Map<number, readonly number[]>();
    for (const frame of frames) {
      if (!Number.isInteger(frame.universe) || frame.universe < 1) continue;
      unique.set(frame.universe, frame.values);
    }
    if (!unique.size) {
      const universe = this.activeUniverse;
      const baseFrame = [...(this.baseUniverses.get(universe) ?? makeUniverse())];
      const frame = [...(this.universes.get(universe) ?? this.resolveFrame(universe, baseFrame))];
      return {
        revision: this.revision,
        universe,
        frame,
        baseFrame,
        changedChannels: [],
        outputs: [],
        patchChanged: false,
        warnings: ['Multi-universe frame replace contained no valid universes.']
      };
    }

    const ordered = [...unique.entries()].sort(([a], [b]) => a - b);
    this.activeUniverse = ordered[0][0];
    const trace: AttributeSourceTrace = {
      source: envelope.source,
      commandId: envelope.id,
      commandType: envelope.command.type,
      timestamp: envelope.timestamp
    };
    const outputs: RuntimeOutputFrame[] = [];

    for (const [universe, values] of ordered) {
      const previous = this.universes.get(universe) ?? makeUniverse();
      const nextBase = normalizeFrame(values);
      const next = this.resolveFrame(universe, nextBase);
      const changed = changedChannels(previous, next);
      this.baseUniverses.set(universe, nextBase);
      this.universes.set(universe, next);
      changed.forEach((channel) => this.sourceTrace.set(`${universe}:${channel}`, trace));
      outputs.push({
        universe,
        frame: [...next],
        baseFrame: [...nextBase],
        changedChannels: changed
      });
    }

    this.lastCommand = envelope;
    this.revision += 1;
    const primary = outputs[0];
    return {
      revision: this.revision,
      universe: primary.universe,
      frame: [...primary.frame],
      baseFrame: [...primary.baseFrame],
      changedChannels: [...primary.changedChannels],
      outputs,
      patchChanged: false,
      warnings: []
    };
  }

  private commandUniverses(command: ControlCommandEnvelope['command']): number[] {
    if (command.type === 'frame.batch.replace') return [...new Set(command.frames.map((frame) => frame.universe))].sort((a, b) => a - b);
    if ('universe' in command) return [command.universe];
    let fixtureIds: readonly string[] = [];
    if (command.type === 'fixture.attribute' || command.type === 'fixture.color' || command.type === 'fixture.flash.set' || command.type === 'fixture.target') {
      fixtureIds = command.fixtureIds;
    } else if (command.type === 'fixture.position') {
      fixtureIds = command.positions.map((position) => position.fixtureId);
    } else if (command.type === 'group.color' || command.type === 'group.master.set') {
      return [...new Set(this.patch.filter((fixture) => fixture.group === command.groupName).map((fixture) => fixture.universe ?? 1))].sort((a, b) => a - b);
    } else if (command.type === 'master.set' || command.type === 'blackout.set') {
      return [...new Set([this.activeUniverse, ...this.baseUniverses.keys(), ...this.patch.map((fixture) => fixture.universe ?? 1)])].sort((a, b) => a - b);
    }
    if (fixtureIds.length) {
      const ids = new Set(fixtureIds);
      return [...new Set(this.patch.filter((fixture) => ids.has(fixture.id)).map((fixture) => fixture.universe ?? 1))].sort((a, b) => a - b);
    }
    return [this.activeUniverse];
  }

  private applyCommandToUniverseBase(
    command: ControlCommandEnvelope['command'],
    universe: number,
    base: readonly number[],
    warnings: string[]
  ): number[] {
    let next = [...base];
    if (command.type === 'fixture.attribute') {
      const ids = new Set(command.fixtureIds);
      const updates = this.patch
        .filter((fixture) => (fixture.universe ?? 1) === universe && ids.has(fixture.id))
        .flatMap((fixture) => {
          const update = fixtureParameterUpdate(fixture, command.parameter, command.value);
          return update ? [update] : [];
        });
      next = applyUniverseUpdates(base, updates);
    } else if (command.type === 'fixture.color') {
      const ids = new Set(command.fixtureIds);
      const updates = this.patch
        .filter((fixture) => (fixture.universe ?? 1) === universe && ids.has(fixture.id))
        .flatMap((fixture) => fixtureColorUpdates(fixture, [command.color.red, command.color.green, command.color.blue]));
      next = applyUniverseUpdates(base, updates);
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
      next = applyUniverseUpdates(base, updates);
    } else if (command.type === 'fixture.target') {
      next = this.applyTargetCommand(command, universe, base, warnings);
    } else if (command.type === 'group.color') {
      const updates = this.patch
        .filter((fixture) => (fixture.universe ?? 1) === universe && fixture.group === command.groupName)
        .flatMap((fixture) => fixtureColorUpdates(fixture, [command.color.red, command.color.green, command.color.blue]));
      next = applyUniverseUpdates(base, updates);
    }
    return next;
  }

  private applyTargetCommand(
    command: Extract<ControlCommandEnvelope['command'], { type: 'fixture.target' }>,
    universe: number,
    base: readonly number[],
    warnings: string[]
  ): number[] {
    const ids = new Set(command.fixtureIds);
    const fixtures = this.patch
      .map((fixture, index) => ({ fixture, index }))
      .filter(({ fixture }) => ids.has(fixture.id));
    const targets = arrangeTargetPoints(command.target, fixtures.length, command.arrangement, command.spreadMeters);
    const updates = fixtures.flatMap(({ fixture, index }, targetIndex) => {
      if ((fixture.universe ?? 1) !== universe) return [];
      const solution = aimFixtureAtTarget(base, fixture, targets[targetIndex], index, this.patch.length);
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
    return applyUniverseUpdates(base, updates);
  }

  private resolveFrame(universe: number, base: readonly number[]): number[] {
    const next = [...base];
    this.patch
      .filter((fixture) => (fixture.universe ?? 1) === universe)
      .forEach((fixture) => {
        const dimmer = parameterChannel(fixture, 'dimmer');
        if (!dimmer) return;
        const groupMaster = this.groupMasters.get(fixture.group) ?? 1;
        const sourceDimmer = this.flashFixtureIds.has(fixture.id) ? 255 : (base[dimmer - 1] ?? 0);
        next[dimmer - 1] = clampDmx(sourceDimmer * groupMaster * this.master);
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
