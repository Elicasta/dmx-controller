import { readFileSync, writeFileSync } from 'node:fs';

const checkOnly = process.argv.includes('--check');
const packagePath = 'package.json';
const cargoPath = 'src-tauri/Cargo.toml';
const cargoLockPath = 'src-tauri/Cargo.lock';
const tauriPath = 'src-tauri/tauri.conf.json';

const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const version = String(pkg.version || '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version || '(empty)'}`);
}

const cargo = readFileSync(cargoPath, 'utf8');
const packageStart = cargo.indexOf('[package]');
const packageEnd = cargo.indexOf('\n[', packageStart + '[package]'.length);
const packageSectionEnd = packageEnd === -1 ? cargo.length : packageEnd;
const packageSection = cargo.slice(packageStart, packageSectionEnd);
const cargoMatch = packageSection.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) throw new Error('Could not find [package] version in src-tauri/Cargo.toml.');

const lock = readFileSync(cargoLockPath, 'utf8');
const lockPattern = /(\[\[package\]\]\nname = "dmx-controller-mac-v1"\nversion = ")[^"]+(")/;
const lockMatch = lock.match(lockPattern);
if (!lockMatch) throw new Error('Could not find LumaRig package version in src-tauri/Cargo.lock.');

const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'));
if (tauri.version !== '../package.json') {
  throw new Error('src-tauri/tauri.conf.json must source its version from ../package.json.');
}

const cargoVersion = cargoMatch[1];
const lockVersion = lockMatch[0].match(/version = "([^"]+)"/)?.[1] ?? '';
const mismatches = [
  cargoVersion === version ? null : `Cargo.toml=${cargoVersion}`,
  lockVersion === version ? null : `Cargo.lock=${lockVersion}`,
].filter(Boolean);

if (checkOnly) {
  if (mismatches.length) {
    throw new Error(`Release version mismatch. package.json=${version}; ${mismatches.join('; ')}`);
  }
  console.log(`Release metadata aligned at ${version}.`);
  process.exit(0);
}

let nextCargo = cargo;
if (cargoVersion !== version) {
  const absoluteVersionStart = packageStart + (cargoMatch.index ?? 0);
  const before = nextCargo.slice(0, absoluteVersionStart);
  const rest = nextCargo.slice(absoluteVersionStart);
  nextCargo = before + rest.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  writeFileSync(cargoPath, nextCargo);
}

if (lockVersion !== version) {
  writeFileSync(cargoLockPath, lock.replace(lockPattern, `$1${version}$2`));
}

console.log(`Synced native release metadata to ${version}.`);
