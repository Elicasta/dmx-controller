# Fixture Definition Imports (Compatibility Milestone)

The fixture library keeps verified built-in profiles and separately persisted custom profiles.
Importing a definition does **not** patch a light or change DMX output.

## Import

1. Open **Build → Fixtures → Import a fixture definition**.
2. Select one or multiple Open Fixture Library JSON (.json) or QLC+ fixture-definition XML (.qxf) files.
3. Confirm the brand, model, mode and footprint in the **Add Fixtures** selector.
4. Check the actual fixture manual and exact mode on the device.
5. Tick **I checked the fixture manual and exact mode**, then patch a fixture to an available DMX address.

No account or network connection is needed to import a file. Imported definitions remain on this Mac in LumaRig's local application storage. Existing built-in profile IDs, show patches, address allocations, and fixture calibration are not changed by importing a definition. An existing ID is skipped, not replaced.

## Supported mapping

- OFL `availableChannels`, `fineChannelAliases`, plain `modes[].channels`
- QLC+ `FixtureDefinition` manufacturer/model/type, channel group/color, and named modes with explicit zero-based offsets
- Semantic Dimmer, RGBWAUV, Pan/Tilt (including fine), Strobe, Focus, Zoom, Iris, Gobo, Prism, and supported modifiers
- Unknown slots retain their original position and channel footprint. They are not automatically controlled.

The imported profile is always marked **unverified**. Pan/Tilt geometry and physical range are not inferred from channel names alone, so 3D aiming requires a calibrated movement profile. Multi-pixel matrix insertion blocks and GDTF ZIP imports are **not** handled by this importer yet. Import a flattened OFL mode for those fixtures instead.

## Reliability and data

- Fixture-definition files up to 2 MB each. Batch imports register as one transaction.
- Invalid channels, duplicate mode offsets, universe overflows and overlapping address ranges are rejected.
- Up to 1,500 imported profiles in local browser storage, subject to the system's available storage quota.
- The cache must be saved before in-memory registration. Storage quota failure leaves the active catalog and patch intact.
- Imported profiles are not yet embedded into exported show documents. Export/backup the full application data before migrating computers. Avoid removing local application data while profiles are in use.
- Fixture definitions can be wrong or outdated. Verify all channels on a test rig, especially shutter, strobe, pan/tilt, resets, and laser effects.

## Origins and licensing

Open Fixture Library (OFL) project: https://github.com/OpenLightingProject/open-fixture-library (MIT).
QLC+ fixture definitions can be opened from their original .qxf files.
This implementation does not copy proprietary Cuelight application code or bundle the Cuelight fixture collection.

## Known gaps

- Complete GDTF ZIP parser and manufacturer geometry import
- OFL matrix/template expansion
- Packaged offline catalog distribution and cross-device sync
- A dedicated channel-mapping correction editor and UI-level profile export

Do not treat this release as physical certification.
