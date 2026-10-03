# Releasing LumaRig

LumaRig source lives in `Elicasta/dmx-controller`. Public signed installers and updater metadata are published to `Elicasta/dmx-controller-releases` so installed apps can update without GitHub source access.

## Current release line

The public updater line is already active. The latest published release before this branch is **0.5.2**. The current release candidate is **0.6.0**.

Never publish a version lower than the latest public release. Tauri's updater compares semantic versions, so a lower version will not be offered as an upgrade to newer installations.

## One-time repository setup

The source repository needs these Actions secrets:

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PUBLIC_KEY` | Public updater verification key |
| `TAURI_SIGNING_PRIVATE_KEY` | Private updater signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the private updater key |
| `DMX_RELEASE_TOKEN` | Fine-grained token with Contents read/write access to `dmx-controller-releases` |

Never commit the private updater key, its password, or the release token. Keep a secure backup of the private updater key and password. Losing either prevents future builds from updating installations that trust the current key.

## Release gate

Before publishing:

1. Merge the intended release candidate into `main`.
2. Confirm the `main` CI run is green.
3. Confirm the version in source is aligned with `npm run check:version`.
4. Confirm the requested release version is greater than the latest release in `dmx-controller-releases`.
5. Keep real-hardware checks separate from software CI: physical DMX, real NDI/camera devices, second-display routing, and multitouch show operation still need a real-machine pass when those areas changed.

The publish workflows run their own validation again before signing. A green PR alone does not bypass the release workflow's tests.

## Version source

`package.json` is the app-version source used by Tauri through `src-tauri/tauri.conf.json`.

Release metadata is kept aligned across:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

Use:

```bash
npm run check:version
```

to verify alignment.

The publish workflows call:

```bash
npm run sync:release-version -- <version>
```

before packaging, so the requested release version is stamped atomically into the frontend and native metadata.

## Publish macOS

Open **Actions → Publish macOS Release → Run workflow** on the source repository.

Enter the release version, for example `0.6.0`, plus release notes.

The workflow:

1. validates source version metadata;
2. runs frontend tests;
3. builds the frontend;
4. runs native Rust tests;
5. validates release secrets;
6. stamps the requested version;
7. builds Apple Silicon, Intel, and Universal macOS packages;
8. signs updater artifacts with the Tauri updater key;
9. publishes installers, signatures, and `latest.json` to `dmx-controller-releases`.

macOS application signing is currently ad-hoc. This is suitable for the current internal/private distribution flow, but macOS may require approval in Privacy & Security. External distribution should move to Developer ID signing and notarization.

## Publish Windows

Open **Actions → Publish Windows Release → Run workflow**.

The workflow:

1. validates release secrets;
2. stamps and verifies the requested version;
3. runs frontend tests and the production build;
4. performs a native Windows x64 compile check;
5. builds and publishes NSIS and MSI installers plus updater signatures.

## In-app updater behavior

Installed LumaRig builds read:

`https://github.com/Elicasta/dmx-controller-releases/releases/latest/download/latest.json`

When an operator installs an update while physical DMX is connected, LumaRig stops active effects, disarms audio-reactive output, disconnects/zeros uDMX, installs the signed update, and restarts.

## Version rules

Use semantic versions:

- patch: `0.5.2 → 0.5.3` for contained fixes;
- minor: `0.5.x → 0.6.0` for a feature release;
- major: `0.x → 1.0.0` when LumaRig reaches the intended stable-production milestone.

Do not reuse a published version number.
