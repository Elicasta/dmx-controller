# Fixture Calibration

Calibration is stored per fixture instance because two units of the same model can be mounted and aligned differently.

Current schema:

```json
{
  "panOffsetDegrees": 0,
  "tiltOffsetDegrees": 0,
  "panInvert": false,
  "tiltInvert": false,
  "status": "uncalibrated",
  "confidence": 0,
  "lastCalibratedAt": null,
  "observations": []
}
```

Each observation stores the target ID/name, its world-space coordinate, the raw normalized Pan/Tilt values that put the real beam on that target, and capture time. The evidence remains with the fixture so a result can be audited or solved again.

## Guided procedure

1. Confirm measured fixture position, base rotation, mounting, profile, and mode.
2. Select the fixture in the Stage Designer and open **Fixture calibration**.
3. Send the fixture to profile home.
4. Choose a known target, manually place the real beam on it with the live Pan/Tilt controls, then capture the observation.
5. Repeat for a second and preferably third well-spaced target.
6. Solve calibration. The solver evaluates normal, reversed-pan, reversed-tilt, and both-reversed interpretations across every observation.
7. Review status, confidence, offsets, axes, and last-solved date.
8. Test several targets in AIM mode before trusting the result in a show.

One observation produces `partial` status. Two or more produce `calibrated` status, but confidence still reflects geometric consistency and point count. Reset removes the result and evidence. Copy is available only for selected movers and warns that fixture-specific calibration should be copied only between identical units with matching mounts and orientation.

## Solver rule

For each possible axis-inversion combination, the solver:

1. converts every captured raw value into physical movement;
2. enumerates all equivalent Pan/Tilt solutions for the known world target;
3. estimates a consistent Pan and Tilt offset;
4. runs each observation forward through the beam engine;
5. scores the final angular error and offset consistency;
6. persists the lowest-error deterministic result.

This avoids accepting an equivalent but incorrect Pan/Tilt branch on wide-range fixtures.

## Physical acceptance procedure

For the first moving fixture:

1. Measure and enter X/Y/Z.
2. Enter mounting and base orientation.
3. Verify profile Pan/Tilt ranges and coarse/fine channels.
4. Test home, center, stage-left, and stage-right targets.
5. Record beam miss distance at each target.
6. Accept the initial model only when normal church throws are within roughly 1–2 feet, then tighten calibration where hardware repeatability permits.

Software cannot certify this step without the fixture, venue measurements, and an operator observing the real beam.
