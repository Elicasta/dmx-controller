#!/usr/bin/env bash
set -euo pipefail

echo "Looking for Anyma/uDMX-like USB devices..."
echo

if command -v system_profiler >/dev/null 2>&1; then
  system_profiler SPUSBDataType 2>/dev/null \
    | grep -i -B 8 -A 14 -E 'uDMX|anyma|0x16c0|0x05dc|0x05e4' \
    || true
else
  echo "system_profiler is unavailable."
fi

echo
echo "Raw IORegistry matches:"
if command -v ioreg >/dev/null 2>&1; then
  ioreg -p IOUSB -l -w 0 2>/dev/null \
    | grep -i -E 'uDMX|anyma|16c0|05dc|05e4' \
    || true
fi

echo
echo "Expected original Anyma identity: VID 16C0, PID 05DC, manufacturer www.anyma.ch, product uDMX."
