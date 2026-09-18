use super::{DmxOutput, DMX_CHANNELS};
use rusb::{Device, DeviceDescriptor, DeviceHandle, Direction, GlobalContext, Recipient, RequestType};
use serde::Serialize;
use std::time::Duration;

const UDMX_VENDOR_ID: u16 = 0x16C0;
const UDMX_PRODUCT_ID: u16 = 0x05DC;
// Some compatible clone cables report this PID. We still require uDMX-like
// descriptor strings before treating it as a verified target.
const UDMX_CLONE_PRODUCT_ID: u16 = 0x05E4;

const CMD_SET_SINGLE_CHANNEL: u8 = 1;
const CMD_SET_CHANNEL_RANGE: u8 = 2;
const USB_TIMEOUT: Duration = Duration::from_millis(1000);

#[derive(Clone, Debug, Serialize)]
pub struct UdmxDeviceInfo {
    pub device_key: String,
    pub bus: u8,
    pub address: u8,
    pub vid: u16,
    pub pid: u16,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub identity_verified: bool,
    pub likely_udmx: bool,
}

pub struct UdmxOutput {
    handle: DeviceHandle<GlobalContext>,
    info: UdmxDeviceInfo,
}

impl UdmxOutput {
    pub fn open(device_key: &str) -> Result<Self, String> {
        let devices = rusb::devices().map_err(|error| format!("USB scan failed: {error}"))?;

        for device in devices.iter() {
            let key = device_key_for(&device);
            if key != device_key {
                continue;
            }

            let descriptor = device
                .device_descriptor()
                .map_err(|error| format!("Could not read USB descriptor: {error}"))?;
            let info = describe_device(&device, &descriptor);

            if !info.likely_udmx {
                return Err(format!(
                    "USB device {} is not a verified uDMX target (VID {:04X}, PID {:04X}).",
                    device_key, info.vid, info.pid
                ));
            }

            let handle = device
                .open()
                .map_err(|error| format!("Could not open uDMX device: {error}"))?;

            return Ok(Self { handle, info });
        }

        Err(format!("uDMX device {device_key} is no longer connected."))
    }

    pub fn list_devices() -> Result<Vec<UdmxDeviceInfo>, String> {
        let devices = rusb::devices().map_err(|error| format!("USB scan failed: {error}"))?;
        let mut found = Vec::new();

        for device in devices.iter() {
            let descriptor = match device.device_descriptor() {
                Ok(value) => value,
                Err(_) => continue,
            };

            if !is_supported_usb_id(descriptor.vendor_id(), descriptor.product_id()) {
                continue;
            }

            found.push(describe_device(&device, &descriptor));
        }

        found.sort_by_key(|device| (device.bus, device.address));
        Ok(found)
    }

    fn write_single(&mut self, index: usize, value: u8) -> Result<(), String> {
        if index >= DMX_CHANNELS {
            return Err(format!("DMX channel index must be 0-{}", DMX_CHANNELS - 1));
        }

        let request_type = udmx_request_type();
        let transferred = self
            .handle
            .write_control(
                request_type,
                CMD_SET_SINGLE_CHANNEL,
                value as u16,
                index as u16,
                &[],
                USB_TIMEOUT,
            )
            .map_err(|error| format!("uDMX channel write failed: {error}"))?;

        if transferred != 0 {
            return Err(format!(
                "uDMX single-channel write returned unexpected payload length {transferred}."
            ));
        }

        Ok(())
    }

    fn write_range(&mut self, start_index: usize, values: &[u8]) -> Result<(), String> {
        validate_range(start_index, values.len())?;
        if values.is_empty() {
            return Ok(());
        }

        let request_type = udmx_request_type();
        let transferred = self
            .handle
            .write_control(
                request_type,
                CMD_SET_CHANNEL_RANGE,
                values.len() as u16,
                start_index as u16,
                values,
                USB_TIMEOUT,
            )
            .map_err(|error| format!("uDMX range write failed: {error}"))?;

        if transferred != values.len() {
            return Err(format!(
                "uDMX range write was short: sent {transferred} of {} bytes.",
                values.len()
            ));
        }

        Ok(())
    }
}

impl DmxOutput for UdmxOutput {
    fn display_name(&self) -> String {
        let product = self.info.product.as_deref().unwrap_or("uDMX");
        match self.info.serial_number.as_deref() {
            Some(serial) if !serial.is_empty() => format!("{product} ({serial})"),
            _ => product.to_string(),
        }
    }

    fn send_channel(&mut self, index: usize, value: u8) -> Result<(), String> {
        self.write_single(index, value)
    }

    fn send_range(&mut self, start_index: usize, values: &[u8]) -> Result<(), String> {
        self.write_range(start_index, values)
    }
}

fn describe_device(device: &Device<GlobalContext>, descriptor: &DeviceDescriptor) -> UdmxDeviceInfo {
    let (manufacturer, product, serial_number) = read_strings(device, descriptor);
    let identity_verified = is_udmx_identity(manufacturer.as_deref(), product.as_deref());
    let supported_id = is_supported_usb_id(descriptor.vendor_id(), descriptor.product_id());

    UdmxDeviceInfo {
        device_key: device_key_for(device),
        bus: device.bus_number(),
        address: device.address(),
        vid: descriptor.vendor_id(),
        pid: descriptor.product_id(),
        manufacturer,
        product,
        serial_number,
        identity_verified,
        likely_udmx: supported_id && identity_verified,
    }
}

fn read_strings(
    device: &Device<GlobalContext>,
    descriptor: &DeviceDescriptor,
) -> (Option<String>, Option<String>, Option<String>) {
    let handle = match device.open() {
        Ok(handle) => handle,
        Err(_) => return (None, None, None),
    };

    let languages = match handle.read_languages(Duration::from_millis(250)) {
        Ok(languages) => languages,
        Err(_) => return (None, None, None),
    };
    let Some(language) = languages.first().copied() else {
        return (None, None, None);
    };

    let manufacturer = handle
        .read_manufacturer_string(language, descriptor, Duration::from_millis(250))
        .ok();
    let product = handle
        .read_product_string(language, descriptor, Duration::from_millis(250))
        .ok();
    let serial_number = handle
        .read_serial_number_string(language, descriptor, Duration::from_millis(250))
        .ok();

    (manufacturer, product, serial_number)
}

fn is_supported_usb_id(vid: u16, pid: u16) -> bool {
    vid == UDMX_VENDOR_ID && (pid == UDMX_PRODUCT_ID || pid == UDMX_CLONE_PRODUCT_ID)
}

fn is_udmx_identity(manufacturer: Option<&str>, product: Option<&str>) -> bool {
    let manufacturer = manufacturer.unwrap_or_default().to_ascii_lowercase();
    let product = product.unwrap_or_default().to_ascii_lowercase();

    product.contains("udmx")
        && (manufacturer.contains("anyma")
            || manufacturer.contains("illutz")
            || manufacturer.contains("www.anyma.ch")
            || manufacturer.is_empty())
}

fn device_key_for(device: &Device<GlobalContext>) -> String {
    format!("{:03}:{:03}", device.bus_number(), device.address())
}

fn udmx_request_type() -> u8 {
    rusb::request_type(Direction::Out, RequestType::Vendor, Recipient::Device)
}

fn validate_range(start_index: usize, len: usize) -> Result<(), String> {
    if start_index >= DMX_CHANNELS {
        return Err(format!("DMX start channel index must be 0-{}", DMX_CHANNELS - 1));
    }
    if len > DMX_CHANNELS || start_index.saturating_add(len) > DMX_CHANNELS {
        return Err(format!(
            "DMX range {}..{} exceeds the 512-channel universe.",
            start_index,
            start_index.saturating_add(len)
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_type_is_vendor_device_out() {
        assert_eq!(udmx_request_type(), 0x40);
    }

    #[test]
    fn accepts_original_udmx_identity() {
        assert!(is_supported_usb_id(0x16C0, 0x05DC));
        assert!(is_udmx_identity(Some("www.anyma.ch"), Some("uDMX")));
    }

    #[test]
    fn rejects_other_shared_vid_devices() {
        assert!(!is_udmx_identity(Some("Other Vendor"), Some("USB Widget")));
    }

    #[test]
    fn full_universe_range_is_valid() {
        assert!(validate_range(0, 512).is_ok());
    }

    #[test]
    fn out_of_bounds_range_is_rejected() {
        assert!(validate_range(511, 2).is_err());
        assert!(validate_range(512, 0).is_err());
    }
}
