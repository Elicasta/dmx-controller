import { readFileSync, writeFileSync } from 'node:fs';

const checkOnly = process.argv.includes('--check');
const requestedVersion = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const packagePath = 'package.json';
const packageLockPath = 'package-lock.json';
const cargoPath = 'src-tauri/Cargo.toml';
const cargoLockPath = 'src-tauri/Cargo.lock';
const tauriPath = 'src-tauri/tauri.conf.json';

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
const currentVersion = String(pkg.version || '').trim();
const targetVersion = String(requestedVersion || currentVersion).trim();

if (!semver.test(targetVersion)) {
  throw new Error(`Invalid release version: ${targetVersion || '(empty)'}`);
}

const cargo = readFileSync(cargoPath, 'utf8');
const packageStart = cargo.indexOf('[package]');
const packageEnd = cargo.indexOf('\n[', packageStart + '[package]'.length);
const packageSectionEnd = packageEnd === -1 ? cargo.length : packageEnd;
const packageSection = cargo.slice(packageStart, packageSectionEnd);
const cargoMatch = packageSection.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) throw new Error('Could not find [package] version in src-tauri/Cargo.toml.');

const lock = readFileSync(cargoLockPath, 'utf8');
const lockPattern = /(\[\[package\]\]\r?\nname = "dmx-controller-mac-v1"\r?\nversion = ")[^"]+(")/;
const lockMatch = lock.match(lockPattern);
if (!lockMatch) throw new Error('Could not find LumaRig package version in src-tauri/Cargo.lock.');

const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'));
if (tauri.version !== '../package.json') {
  throw new Error('src-tauri/tauri.conf.json must source its version from ../package.json.');
}

const cargoVersion = cargoMatch[1];
const cargoLockVersion = lockMatch[0].match(/version = "([^"]+)"/)?.[1] ?? '';
const packageLockVersion = String(packageLock.version || '').trim();
const packageLockRootVersion = String(packageLock.packages?.['']?.version || '').trim();

const versions = {
  'package.json': currentVersion,
  'package-lock.json': packageLockVersion,
  'package-lock root': packageLockRootVersion,
  'Cargo.toml': cargoVersion,
  'Cargo.lock': cargoLockVersion,
};

if (checkOnly) {
  const mismatches = Object.entries(versions)
    .filter(([, value]) => value !== targetVersion)
    .map(([name, value]) => `${name}=${value || '(empty)'}`);
  if (mismatches.length) {
    throw new Error(`Release version mismatch. expected=${targetVersion}; ${mismatches.join('; ')}`);
  }
  console.log(`Release metadata aligned at ${targetVersion}.`);
  process.exit(0);
}

pkg.version = targetVersion;
packageLock.version = targetVersion;
packageLock.packages ??= {};
packageLock.packages[''] ??= {};
packageLock.packages[''].version = targetVersion;

const absoluteVersionStart = packageStart + (cargoMatch.index ?? 0);
const nextCargo =
  cargo.slice(0, absoluteVersionStart)
  + cargo.slice(absoluteVersionStart).replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
const nextCargoLock = lock.replace(lockPattern, `$1${targetVersion}$2`);

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
writeFileSync(cargoPath, nextCargo);
writeFileSync(cargoLockPath, nextCargoLock);

console.log(`Synced all release metadata to ${targetVersion}.`);
