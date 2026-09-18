use crate::output::{udmx::UdmxOutput, DmxOutput, DMX_CHANNELS};
use serde::Serialize;
use std::{
    sync::{
        mpsc::{self, Receiver, Sender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

const OUTPUT_INTERVAL: Duration = Duration::from_millis(25); // host-side max update rate: 40 Hz

#[derive(Clone, Debug, Default, Serialize)]
pub struct DmxStatus {
    pub connected: bool,
    pub device_key: Option<String>,
    pub device_name: Option<String>,
    pub blackout: bool,
    pub usb_writes: u64,
    pub channels_sent: u64,
    pub last_error: Option<String>,
}

enum DmxCommand {
    Connect {
        device_key: String,
        reply: Sender<Result<(), String>>,
    },
    Disconnect {
        reply: Sender<Result<(), String>>,
    },
    SetChannel { index: usize, value: u8 },
    SetUniverse(Vec<u8>),
    SetBlackout {
        enabled: bool,
        reply: Sender<Result<(), String>>,
    },
    Shutdown,
}

#[derive(Clone, Copy, Debug)]
struct DirtyRange {
    start: usize,
    end: usize,
}

impl DirtyRange {
    fn channel(index: usize) -> Self {
        Self { start: index, end: index }
    }

    fn full() -> Self {
        Self {
            start: 0,
            end: DMX_CHANNELS - 1,
        }
    }

    fn include(&mut self, index: usize) {
        self.start = self.start.min(index);
        self.end = self.end.max(index);
    }

    fn include_all(&mut self) {
        self.start = 0;
        self.end = DMX_CHANNELS - 1;
    }
}

pub struct DmxEngine {
    tx: Sender<DmxCommand>,
    status: Arc<Mutex<DmxStatus>>,
}

impl DmxEngine {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let status = Arc::new(Mutex::new(DmxStatus::default()));
        let worker_status = Arc::clone(&status);

        thread::Builder::new()
            .name("dmx-output".to_string())
            .spawn(move || run_worker(rx, worker_status))
            .expect("failed to spawn DMX output thread");

        Self { tx, status }
    }

    pub fn list_devices(&self) -> Result<Vec<crate::output::udmx::UdmxDeviceInfo>, String> {
        UdmxOutput::list_devices()
    }

    pub fn connect(&self, device_key: String) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.send(DmxCommand::Connect {
            device_key,
            reply: reply_tx,
        })?;
        receive_reply(reply_rx, "uDMX connection")
    }

    pub fn disconnect(&self) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.send(DmxCommand::Disconnect { reply: reply_tx })?;
        receive_reply(reply_rx, "uDMX disconnect")
    }

    pub fn set_channel(&self, channel: usize, value: u8) -> Result<(), String> {
        if !(1..=DMX_CHANNELS).contains(&channel) {
            return Err(format!("DMX channel must be 1-{DMX_CHANNELS}"));
        }
        self.send(DmxCommand::SetChannel {
            index: channel - 1,
            value,
        })
    }

    pub fn set_universe(&self, values: Vec<u8>) -> Result<(), String> {
        if values.len() != DMX_CHANNELS {
            return Err(format!("Universe must contain exactly {DMX_CHANNELS} channels"));
        }
        self.send(DmxCommand::SetUniverse(values))
    }

    pub fn set_blackout(&self, enabled: bool) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.send(DmxCommand::SetBlackout {
            enabled,
            reply: reply_tx,
        })?;
        receive_reply(reply_rx, "blackout change")
    }

    pub fn status(&self) -> DmxStatus {
        self.status.lock().map(|status| status.clone()).unwrap_or_else(|_| DmxStatus {
            last_error: Some("DMX status lock poisoned".to_string()),
            ..Default::default()
        })
    }

    fn send(&self, command: DmxCommand) -> Result<(), String> {
        self.tx.send(command).map_err(|error| error.to_string())
    }
}

impl Drop for DmxEngine {
    fn drop(&mut self) {
        let _ = self.tx.send(DmxCommand::Shutdown);
    }
}

fn run_worker(rx: Receiver<DmxCommand>, status: Arc<Mutex<DmxStatus>>) {
    let mut universe = [0u8; DMX_CHANNELS];
    let mut blackout = false;
    let mut output: Option<Box<dyn DmxOutput>> = None;
    let mut dirty: Option<DirtyRange> = None;
    let mut next_flush = Instant::now();

    loop {
        let wait = next_flush.saturating_duration_since(Instant::now());
        match rx.recv_timeout(wait) {
            Ok(command) => match command {
                DmxCommand::Connect { device_key, reply } => {
                    if let Some(mut current) = output.take() {
                        let zeros = [0u8; DMX_CHANNELS];
                        let _ = current.send_universe(&zeros);
                    }

                    match UdmxOutput::open(&device_key) {
                        Ok(mut connected) => {
                            let physical = if blackout { [0u8; DMX_CHANNELS] } else { universe };
                            match connected.send_universe(&physical) {
                                Ok(_) => {
                                    let name = connected.display_name();
                                    output = Some(Box::new(connected));
                                    dirty = None;
                                    update_status(&status, |s| {
                                        s.connected = true;
                                        s.device_key = Some(device_key.clone());
                                        s.device_name = Some(name);
                                        s.usb_writes = s.usb_writes.saturating_add(1);
                                        s.channels_sent = s.channels_sent.saturating_add(DMX_CHANNELS as u64);
                                        s.last_error = None;
                                    });
                                    let _ = reply.send(Ok(()));
                                }
                                Err(error) => {
                                    let message = format!("Connected to uDMX but initial output failed: {error}");
                                    update_status(&status, |s| {
                                        s.connected = false;
                                        s.device_key = None;
                                        s.device_name = None;
                                        s.last_error = Some(message.clone());
                                    });
                                    let _ = reply.send(Err(message));
                                }
                            }
                        }
                        Err(error) => {
                            output = None;
                            update_status(&status, |s| {
                                s.connected = false;
                                s.device_key = None;
                                s.device_name = None;
                                s.last_error = Some(error.clone());
                            });
                            let _ = reply.send(Err(error));
                        }
                    }
                    next_flush = Instant::now() + OUTPUT_INTERVAL;
                }
                DmxCommand::Disconnect { reply } => {
                    let zero_error = safe_zero_and_drop(&mut output, &status);
                    dirty = None;
                    update_status(&status, |s| {
                        s.connected = false;
                        s.device_key = None;
                        s.device_name = None;
                        s.last_error = zero_error.clone();
                    });
                    let result = zero_error.map_or(Ok(()), Err);
                    let _ = reply.send(result);
                }
                DmxCommand::SetChannel { index, value } => {
                    universe[index] = value;
                    dirty = Some(match dirty {
                        Some(mut range) => {
                            range.include(index);
                            range
                        }
                        None => DirtyRange::channel(index),
                    });
                }
                DmxCommand::SetUniverse(values) => {
                    universe.copy_from_slice(&values);
                    dirty = Some(match dirty {
                        Some(mut range) => {
                            range.include_all();
                            range
                        }
                        None => DirtyRange::full(),
                    });
                }
                DmxCommand::SetBlackout { enabled, reply } => {
                    let mut result = Ok(());
                    if blackout != enabled {
                        blackout = enabled;
                        update_status(&status, |s| s.blackout = enabled);

                        let physical = if enabled { [0u8; DMX_CHANNELS] } else { universe };
                        let send_result = output
                            .as_mut()
                            .map(|connected| connected.send_universe(&physical));
                        match send_result {
                            Some(Ok(())) => {
                                dirty = None;
                                record_write(&status, DMX_CHANNELS);
                            }
                            Some(Err(error)) => {
                                result = Err(error.clone());
                                handle_output_error(&mut output, &status, error);
                            }
                            None => {}
                        }
                    }
                    let _ = reply.send(result);
                }
                DmxCommand::Shutdown => {
                    let _ = safe_zero_and_drop(&mut output, &status);
                    break;
                }
            },
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                let _ = safe_zero_and_drop(&mut output, &status);
                break;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        if Instant::now() >= next_flush {
            if !blackout {
                if let Some(range) = dirty {
                    let values = &universe[range.start..=range.end];
                    let channel_count = values.len();
                    let send_result = output.as_mut().map(|connected| {
                        if range.start == range.end {
                            connected.send_channel(range.start, values[0])
                        } else {
                            connected.send_range(range.start, values)
                        }
                    });

                    match send_result {
                        Some(Ok(())) => {
                            dirty = None;
                            record_write(&status, channel_count);
                        }
                        Some(Err(error)) => {
                            handle_output_error(&mut output, &status, error);
                        }
                        None => {}
                    }
                }
            }
            next_flush = Instant::now() + OUTPUT_INTERVAL;
        }
    }
}

fn safe_zero_and_drop(
    output: &mut Option<Box<dyn DmxOutput>>,
    status: &Arc<Mutex<DmxStatus>>,
) -> Option<String> {
    let mut error_message = None;
    if let Some(connected) = output.as_mut() {
        let zeros = [0u8; DMX_CHANNELS];
        match connected.send_universe(&zeros) {
            Ok(_) => record_write(status, DMX_CHANNELS),
            Err(error) => {
                let message = format!("Could not zero DMX output before disconnect: {error}");
                update_status(status, |s| s.last_error = Some(message.clone()));
                error_message = Some(message);
            }
        }
    }
    *output = None;
    error_message
}

fn handle_output_error(
    output: &mut Option<Box<dyn DmxOutput>>,
    status: &Arc<Mutex<DmxStatus>>,
    error: String,
) {
    *output = None;
    update_status(status, |s| {
        s.connected = false;
        s.device_key = None;
        s.device_name = None;
        s.last_error = Some(format!("uDMX output lost: {error}"));
    });
}

fn record_write(status: &Arc<Mutex<DmxStatus>>, channels: usize) {
    update_status(status, |s| {
        s.usb_writes = s.usb_writes.saturating_add(1);
        s.channels_sent = s.channels_sent.saturating_add(channels as u64);
        s.last_error = None;
    });
}

fn receive_reply(
    reply_rx: Receiver<Result<(), String>>,
    operation: &str,
) -> Result<(), String> {
    reply_rx
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| format!("Timed out waiting for {operation}."))?
}

fn update_status(status: &Arc<Mutex<DmxStatus>>, update: impl FnOnce(&mut DmxStatus)) {
    if let Ok(mut current) = status.lock() {
        update(&mut current);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dirty_range_expands_to_cover_multiple_channels() {
        let mut range = DirtyRange::channel(7);
        range.include(2);
        range.include(12);
        assert_eq!(range.start, 2);
        assert_eq!(range.end, 12);
    }

    #[test]
    fn full_dirty_range_covers_universe() {
        let range = DirtyRange::full();
        assert_eq!(range.start, 0);
        assert_eq!(range.end, 511);
    }
}
