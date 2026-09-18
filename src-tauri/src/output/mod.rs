pub mod udmx;

pub const DMX_CHANNELS: usize = 512;

/// Hardware boundary for DMX output.
///
/// Milestone 1 only ships the Anyma uDMX driver. Future isolated USB, Art-Net,
/// or sACN outputs can implement this trait without changing the lighting engine.
pub trait DmxOutput {
    fn display_name(&self) -> String;
    fn send_channel(&mut self, index: usize, value: u8) -> Result<(), String>;
    fn send_range(&mut self, start_index: usize, values: &[u8]) -> Result<(), String>;

    fn send_universe(&mut self, values: &[u8; DMX_CHANNELS]) -> Result<(), String> {
        self.send_range(0, values)
    }
}
