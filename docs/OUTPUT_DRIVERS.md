# Output Drivers

\`OutputRouter\` receives the finished DMX universe frame and fans it out to independent drivers.

Available drivers:

- \`VirtualOutputDriver\`: latest frame for tests and visualization; always enabled.
- uDMX callback: direct Rust USB output, universe 1 only when connected.
- Art-Net: independent UDP/6454 output, existing LumaViz link.
- sACN (E1.31): independent UDP/5568 output, disabled by default. Configured in **Build → Connections**.

The Rust backend isolates USB under \`DmxOutput\` and owns DMX transmission timing. Network drivers must never stop the lighting runtime or USB output when a socket send fails.

## sACN configuration

Use the exact receiver IPv4 for unicast or \`multicast\` for standardized E1.31 group 239.255.x.y, where x.y represents the one-based universe. The producer uses the default priority 100, start code 0 and one CID per application runtime. Sender sequence numbers are tracked per universe.

The sACN status shows UDP packet submissions and socket errors. **It does not prove receiver connectivity**, node discovery, or fixture output. sACN is not automatically enabled after installation. Put the lighting output on a private, isolated network.

Important: stopping output without sending stream-termination packets may leave a receiver holding its last frame until its configured source-loss timeout. This initial driver does not claim verified stream termination. Do not use it for hazardous fixtures, and retain a physical emergency power/DMX stop.

## Timing and verification

- USB hardware loop: driver-specific, current uDMX target 40 Hz.
- Network routing: follows the resolved show frame, separate from UI refresh.
- Recorder: 20 Hz changed-channel snapshots.
- Stage rendering: browser animation cadence.

Automated validation covers exact E1.31 638-byte packet layout, field offsets, 512 slots, universe limits, multicast destination selection, disabled output, and error isolation.

A physical release gate must capture packets using a known sACN receiver, verify fixture identity, test network unplug/reconnect, and exercise zero/blackout/failure behavior. Do not assume a successful UDP send means delivery.
