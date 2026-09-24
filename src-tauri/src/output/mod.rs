pub mod artnet;
pub mod udmx;

pub const DMX_CHANNELS: usize = 512;

/// Hardware boundary for DMX output.
///
/// Output implementations stay isolated from the lighting engine. The app currently
/// ships Anyma uDMX plus an Art-Net bridge used by LumaViz and LAN DMX receivers.
pub trait DmxOutput {
    fn display_name(&self) -> String;
    fn send_channel(&mut self, index: usize, value: u8) -> Result<(), String>;
    fn send_range(&mut self, start_index: usize, values: &[u8]) -> Result<(), String>;

    fn send_universe(&mut self, values: &[u8; DMX_CHANNELS]) -> Result<(), String> {
        self.send_range(0, values)
    }
}

pub mod lumaviz_direct;

pub mod fixture_frame;
pub mod direct_server;
