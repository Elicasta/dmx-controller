# Releasing DMX Controller

The source repository can stay private. Installed apps must be able to download the updater manifest and signed bundles without a GitHub login, so release artifacts are published to a separate public repository:

- Source: `Elicasta/dmx-controller` (private)
- Releases: `Elicasta/dmx-controller-releases` (public)

## One-time setup

### 1. Create the public release repository

Create `Elicasta/dmx-controller-releases` as a public repository and initialize it with a README so it has a `main` branch.

Do not put source code in this repository. It only hosts GitHub Releases and updater assets.

### 2. Add four Actions secrets to the private source repository

Open:

`dmx-controller → Settings → Secrets and variables → Actions`

Create these repository secrets:

| Secret | Value |
| --- | --- |
| `TAURI_SIGNING_PUBLIC_KEY` | Contents of `~/.tauri/dmx-controller.key.pub` |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/dmx-controller.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when the updater key was generated |
| `DMX_RELEASE_TOKEN` | Fine-grained GitHub token with Contents read/write access to only `dmx-controller-releases` |

Never commit the private updater key, its password, or the release token.

Keep a secure backup of the private updater key and its password. Losing either prevents future versions from updating installations that trust this signing key.

### 3. First updater-enabled install

The currently installed 0.2.0 build does not contain the updater. Publish version `0.3.0`, download the Apple Silicon DMG on the M1 Mac, and install it once manually.

After 0.3.0 is installed, later releases can be installed from inside DMX Controller.

## Publish a release without Terminal

1. Push or merge the code you want to ship into `main`.
2. Open the private source repository on GitHub.
3. Open **Actions → Publish macOS Release → Run workflow**.
4. Enter a version greater than the installed version, such as `0.3.1`.
5. Enter release notes.
6. Run the workflow.

The workflow:

1. runs the frontend and native test suites;
2. builds Apple Silicon, Intel, and Universal macOS versions;
3. ad-hoc signs the macOS bundles;
4. signs updater artifacts with the Tauri updater key;
5. publishes the installers and signatures to the public release repository;
6. generates `latest.json` for the installed apps.

## In-app behavior

DMX Controller checks for an update shortly after launch and also exposes **Setup → Settings → Software Update → Check for Updates**.

When an operator installs an update while physical DMX is connected, the app stops active effects, disarms audio-reactive output, zeros/disconnects uDMX, installs the signed update, and restarts. This avoids leaving the USB interface intentionally live during the app replacement/restart.

## Version rules

Use semantic versions:

- patch: `0.3.0 → 0.3.1` for fixes
- minor: `0.3.1 → 0.4.0` for feature releases
- major: `0.x → 1.0.0` when the controller is ready for a stable production milestone

The release workflow injects the requested version into the build. You do not need to edit three separate version files manually.

## Apple signing

The current pipeline uses Tauri's ad-hoc macOS signing identity (`-`). This is enough for the current private/test distribution flow, but macOS can still require the user to approve the app in Privacy & Security.

For polished external distribution, replace ad-hoc signing with a Developer ID Application certificate and Apple notarization.
