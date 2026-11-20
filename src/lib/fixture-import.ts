/**
 * User-supplied OFL JSON and QLC+ QXF fixture definitions.
 * Imported modes remain UNVERIFIED pending physical validation.
 */
import type { FixtureCategory, FixtureChannel, FixtureMode, FixtureParameter, FixtureProfile } from './fixtures';

type Json = Record<string, unknown>;
const MAX_IMPORT_BYTES = 2_000_000;
const obj = (v: unknown): Json => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Json : {};
const str = (v: unknown): string => typeof v === 'string' ? v.trim().slice(0, 180) : '';
const slug = (v: string): string => v.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'fixture';

function category(v: string): FixtureCategory {
  if (/moving|scanner|spot|beam|wash.*head/i.test(v)) return 'Moving Head';
  if (/bar|strip|batten|pixel/i.test(v)) return 'Bar';
  if (/par|wash|flood|led/i.test(v)) return 'Par';
  return 'Other';
}

function semanticParameter(name: string, details: Json = {}): FixtureParameter | undefined {
  const type = str(details.type).toLowerCase();
  const words = [name, str(details.name), str(details.color), str(details.group)]
    .filter(Boolean).join(' ').toLowerCase();
  const fine = /\b(fine|16[\s-]?bit|least significant|lsb)\b/i.test(words);
  if (type === 'pan' || /\bpan\b/.test(words)) return fine ? 'panFine' : 'pan';
  if (type === 'tilt' || /\btilt\b/.test(words)) return fine ? 'tiltFine' : 'tilt';
  if (/gobo.*rotat/.test(words)) return 'goboRotate';
  if (/prism.*rotat/.test(words)) return 'prismRotate';
  if (!/wheel|speed|macro/.test(words)) {
    if (/\buv\b|\bultraviolet\b/.test(words)) return 'uv';
    for (const color of ['red', 'green', 'blue', 'white', 'amber'] as const) {
      if (new RegExp('\\b' + color + '\\b').test(words)) return color;
    }
  }
  if (type === 'intensity' || /\b(dimmer|intensity|master dim)\b/.test(words)) return 'dimmer';
  if (/\b(strobe|shutter)\b/.test(words)) return 'strobe';
  if (/\bzoom\b/.test(words)) return 'zoom';
  if (/\bfocus\b/.test(words)) return 'focus';
  if (/\biris\b/.test(words)) return 'iris';
  if (/\bprism\b/.test(words)) return 'prism';
  if (/\bgobo\b/.test(words)) return 'gobo';
  if (/color wheel|colour wheel/.test(words)) return 'colorWheel';
  if (/movement speed|pan.?tilt speed/.test(words)) return 'movementSpeed';
  if (/\bmacro\b/.test(words)) return 'macro';
  return undefined;
}

function makeMode(id: string, name: string, channelNames: readonly (string | null)[],
  definitions: Json, aliases: Map<string, { name: string; details: Json }>): FixtureMode {
  if (!channelNames.length || channelNames.length > 512) throw new Error('Mode must have 1–512 DMX channels.');
  const channels: FixtureChannel[] = channelNames.map((rawName, offset) => {
    const title = rawName ?? 'Unused';
    const alias = aliases.get(title);
    const details = alias?.details ?? obj(definitions[title]);
    const parameter = rawName === null ? undefined :
      alias ? semanticParameter(alias.name + ' fine', details) : semanticParameter(title, details);
    return { offset, label: title, ...(parameter ? { parameter } : {}) };
  });
  return { id: slug(id), name: name || 'DMX Mode', channelCount: channels.length, channels };
}

function uniqueModes(modes: FixtureMode[]): FixtureMode[] {
  const seen = new Set<string>();
  return modes.map((mode, index) => {
    let id = mode.id || 'mode-' + (index+1);
    while (seen.has(id)) id += '-' + (index+1);
    seen.add(id);
    return { ...mode, id };
  });
}

function oflProfile(dataInput: Json, filename: string): FixtureProfile {
  const nested = obj(dataInput.fixture);
  const data = Object.keys(nested).length ? nested : dataInput;
  const manufacturer = str(dataInput.manufacturer) || str(dataInput.manufacturerKey)
    || str(data.manufacturer) || str(data.manufacturerKey) || 'Imported (unknown brand)';
  const model = str(data.name) || str(data.model) || filename.replace(/\.json$/i, '');
  const available = obj(data.availableChannels);
  const aliases = new Map<string, { name: string; details: Json }>();
  for (const [name, raw] of Object.entries(available)) {
    const details = obj(raw);
    if (Array.isArray(details.fineChannelAliases)) {
      for (const fine of details.fineChannelAliases) {
        if (typeof fine === 'string') aliases.set(fine, { name, details });
      }
    }
  }
  if (!Array.isArray(data.modes) || !data.modes.length) throw new Error('OFL fixture has no DMX modes.');
  const modes = data.modes.map((raw, index) => {
    const mode = obj(raw);
    if (!Array.isArray(mode.channels) || !mode.channels.every((v) => v === null || typeof v === 'string')) {
      throw new Error('Matrix/template channels need a flattened OFL export. This file was not imported.');
    }
    return makeMode(str(mode.shortName) || str(mode.name) || 'mode-' + (index+1),
      str(mode.name) || 'Mode ' + (index+1), mode.channels as (string|null)[], available, aliases);
  });
  const categories = Array.isArray(data.categories) ? data.categories.map(String).join(' ') : '';
  return {
    id: 'ofl-' + slug(manufacturer) + '-' + slug(model), manufacturer, model,
    category: category(categories || model), verified: false,
    note: 'Imported OFL profile. Confirm exact model/revision and channel mode on hardware. Unknown channels remain raw.',
    modes: uniqueModes(modes),
  };
}

function textOf(node: Element, name: string): string {
  return node.getElementsByTagNameNS('*', name).item(0)?.textContent?.trim() ?? '';
}
function children(node: Element, name: string): Element[] {
  return Array.from(node.children).filter((entry) => entry.localName === name);
}
function qlcProfile(xml: string): FixtureProfile {
  if (/<!(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('XML DTDs and entities are not allowed.');
  if (typeof DOMParser === 'undefined') throw new Error('QLC+ XML import needs the desktop interface.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Invalid QLC+ XML.');
  const root = document.documentElement;
  if (root.localName !== 'FixtureDefinition') throw new Error('Expected a QLC+ FixtureDefinition (.qxf) file.');
  const manufacturer = textOf(root, 'Manufacturer') || 'Imported (unknown brand)';
  const model = textOf(root, 'Model') || 'Unknown model';
  const definitions: Json = {};
  for (const channel of children(root, 'Channel')) {
    const name = channel.getAttribute('Name') || '';
    if (!name) continue;
    definitions[name] = {
      name, group: children(channel, 'Group')[0]?.textContent ?? '',
      color: textOf(channel, 'Colour'),
    };
  }
  const modes = children(root, 'Mode').map((mode, index) => {
    const slots = children(mode, 'Channel').map((channel) => ({
      offset: Number(channel.getAttribute('Number')),
      name: channel.textContent?.trim() || 'Unused',
    }));
    if (!slots.length || slots.length > 512 || slots.some((slot) =>
      !Number.isInteger(slot.offset) || slot.offset < 0 || slot.offset >= 512)) {
      throw new Error('QLC+ mode has invalid DMX channel offsets.');
    }
    const count = Math.max(...slots.map((slot) => slot.offset)) + 1;
    const names: (string|null)[] = Array(count).fill(null);
    for (const slot of slots) {
      if (names[slot.offset] !== null) throw new Error('QLC+ mode repeats a DMX channel offset.');
      names[slot.offset] = slot.name;
    }
    return makeMode(mode.getAttribute('Name') || 'mode-' + (index+1),
      mode.getAttribute('Name') || 'Mode ' + (index+1), names, definitions, new Map());
  });
  if (!modes.length) throw new Error('QLC+ fixture has no DMX modes.');
  return {
    id: 'qlc-' + slug(manufacturer) + '-' + slug(model), manufacturer, model,
    category: category(textOf(root, 'Type') || model),
    verified: false,
    note: 'Imported QLC+ fixture. Confirm exact model/revision and channel mode on hardware.',
    modes: uniqueModes(modes),
  };
}

/** Pure parse step. No active fixture patch or storage is changed until registration succeeds. */
export function parseFixtureImport(filename: string, text: string): FixtureProfile[] {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Fixture import is limited to 2 MB. Import a single fixture definition.');
  }
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'qxf') return [qlcProfile(text)];
  if (extension === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error('Invalid fixture JSON.'); }
    return [oflProfile(obj(parsed), filename)];
  }
  throw new Error('Supported formats: OFL .json and QLC+ .qxf. GDTF archive import is not yet available.');
}
