use std::{
    net::{Ipv4Addr, SocketAddrV4, UdpSocket},
    time::Duration,
    str::FromStr,
    sync::{
        atomic::{AtomicU8, Ordering},
        Mutex,
    },
};
use tauri::State;
use std::time::Duration;

use super::DMX_CHANNELS;

const ARTNET_PORT: u16 = 6454;
const ARTNET_HEADER: &[u8; 8] = b"Art-Net\0";
const OP_DMX: u16 = 0x5000;
const PROTOCOL_VERSION: u16 = 14;
const MAX_ARTNET_UNIVERSE: u16 = 32_768;
const LUMAVIZ_PROBE: &[u8] = b"LUMARIG-LUMAVIZ-PROBE-v1";
const LUMAVIZ_ACK: &[u8] = b"LUMAVIZ-LUMARIG-ACK-v1";

pub struct ArtNetEngine {
    socket: Mutex<Option<UdpSocket>>,
    sequence: AtomicU8,
}

const LUMAVIZ_PING: &[u8] = b"LUMARIG-PING";
const LUMAVIZ_ACK: &[u8] = b"LUMAVIZ-ACK";

impl Default for ArtNetEngine {
    fn default() -> Self {
        Self {
            socket: Mutex::new(None),
            sequence: AtomicU8::new(1),
        }
    }
}

impl ArtNetEngine {
    fn next_sequence(&self) -> u8 {
        self.sequence
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |current| {
                Some(if current >= 255 { 1 } else { current + 1 })
            })
            .unwrap_or(1)
    }

    fn with_socket<T>(&self, operation: impl FnOnce(&UdpSocket) -> Result<T, String>) -> Result<T, String> {
        let mut guard = self
            .socket
            .lock()
            .map_err(|_| "Art-Net socket state is unavailable".to_string())?;

        if guard.is_none() {
            let socket = UdpSocket::bind(("0.0.0.0", 0))
                .map_err(|error| format!("Could not open Art-Net UDP socket: {error}"))?;
            socket
                .set_broadcast(true)
                .map_err(|error| format!("Could not enable Art-Net broadcast: {error}"))?;
            *guard = Some(socket);
        }

        operation(guard.as_ref().expect("socket initialized"))
    }

    pub fn probe_lumaviz(&self, target: &str) -> Result<bool, String> {
        let target_ip = Ipv4Addr::from_str(target.trim())
            .map_err(|_| "LumaViz target must be an IPv4 address".to_string())?;
        let socket = UdpSocket::bind(("0.0.0.0", 0))
            .map_err(|error| format!("Could not open LumaViz probe socket: {error}"))?;
        socket.set_read_timeout(Some(Duration::from_millis(350)))
            .map_err(|error| format!("Could not set LumaViz probe timeout: {error}"))?;
        socket.send_to(LUMAVIZ_PROBE, SocketAddrV4::new(target_ip, ARTNET_PORT))
            .map_err(|error| format!("LumaViz probe failed: {error}"))?;
        let mut reply = [0u8; 64];
        match socket.recv_from(&mut reply) {
            Ok((count, _)) => Ok(&reply[..count] == LUMAVIZ_ACK),
            Err(error) if matches!(error.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => Ok(false),
            Err(error) => Err(format!("LumaViz acknowledgement failed: {error}")),
        }
    }

    pub fn send_frame(&self, target: &str, universe: u16, values: &[u8]) -> Result<(), String> {
        let target_ip = Ipv4Addr::from_str(target.trim())
            .map_err(|_| "Art-Net target must be an IPv4 address such as 127.0.0.1 or 255.255.255.255".to_string())?;
        let sequence = self.next_sequence();
        let packet = build_artdmx_packet(universe, sequence, values)?;
        let destination = SocketAddrV4::new(target_ip, ARTNET_PORT);

        self.with_socket(|socket| {
            socket
                .send_to(&packet, destination)
                .map_err(|error| format!("Art-Net send to {destination} failed: {error}"))?;
            Ok(())
        })
    }
}

pub fn build_artdmx_packet(universe: u16, sequence: u8, values: &[u8]) -> Result<Vec<u8>, String> {
    if universe == 0 || universe > MAX_ARTNET_UNIVERSE {
        return Err(format!(
            "Art-Net universe must be between 1 and {MAX_ARTNET_UNIVERSE}"
        ));
    }

    let mut packet = vec![0u8; 18 + DMX_CHANNELS];
    packet[0..8].copy_from_slice(ARTNET_HEADER);
    packet[8..10].copy_from_slice(&OP_DMX.to_le_bytes());
    packet[10..12].copy_from_slice(&PROTOCOL_VERSION.to_be_bytes());
    packet[12] = sequence;
    packet[13] = 0;

    let port_address = universe - 1;
    packet[14..16].copy_from_slice(&port_address.to_le_bytes());
    packet[16..18].copy_from_slice(&(DMX_CHANNELS as u16).to_be_bytes());

    for (index, value) in values.iter().take(DMX_CHANNELS).enumerate() {
        packet[18 + index] = *value;
    }

    Ok(packet)
}

#[tauri::command]
pub fn probe_lumaviz(engine: State<'_, ArtNetEngine>, target: String) -> Result<bool, String> {
    engine.probe_lumaviz(&target)
}

#[tauri::command]
pub fn send_artnet_frame(
    engine: State<'_, ArtNetEngine>,
    target: String,
    universe: u16,
    values: Vec<u8>,
) -> Result<(), String> {
    engine.send_frame(&target, universe, &values)
}

#[tauri::command]
pub fn probe_lumaviz(engine: State<'_, ArtNetEngine>, target: String) -> Result<bool, String> {
    let target_ip = Ipv4Addr::from_str(target.trim())
        .map_err(|_| "LumaViz target must be an IPv4 address".to_string())?;
    let destination = SocketAddrV4::new(target_ip, ARTNET_PORT);
    engine.with_socket(|socket| {
        socket.set_read_timeout(Some(Duration::from_millis(350)))
            .map_err(|error| format!("Could not set LumaViz probe timeout: {error}"))?;
        socket.send_to(LUMAVIZ_PING, destination)
            .map_err(|error| format!("LumaViz probe send failed: {error}"))?;
        let mut reply = [0u8; 64];
        match socket.recv_from(&mut reply) {
            Ok((count, source)) => Ok(source.ip() == target_ip && &reply[..count] == LUMAVIZ_ACK),
            Err(error) if matches!(error.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => Ok(false),
            Err(error) => Err(format!("LumaViz probe receive failed: {error}")),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_artdmx_for_one_based_universe() {
        let packet = build_artdmx_packet(1, 7, &[255, 10, 20]).unwrap();
        assert_eq!(&packet[0..8], ARTNET_HEADER);
        assert_eq!(u16::from_le_bytes([packet[8], packet[9]]), OP_DMX);
        assert_eq!(u16::from_be_bytes([packet[10], packet[11]]), PROTOCOL_VERSION);
        assert_eq!(packet[12], 7);
        assert_eq!(u16::from_le_bytes([packet[14], packet[15]]), 0);
        assert_eq!(u16::from_be_bytes([packet[16], packet[17]]), 512);
        assert_eq!(&packet[18..21], &[255, 10, 20]);
        assert_eq!(packet.len(), 530);
    }

    #[test]
    fn maps_second_lumarig_universe_to_port_address_one() {
        let packet = build_artdmx_packet(2, 1, &[]).unwrap();
        assert_eq!(u16::from_le_bytes([packet[14], packet[15]]), 1);
    }

    #[test]
    fn rejects_invalid_universe() {
        assert!(build_artdmx_packet(0, 1, &[]).is_err());
        assert!(build_artdmx_packet(MAX_ARTNET_UNIVERSE + 1, 1, &[]).is_err());
    }

    #[test]
    fn sends_real_artdmx_over_udp_loopback() {
        use std::time::Duration;

        let receiver = UdpSocket::bind(("127.0.0.1", ARTNET_PORT))
            .expect("bind Art-Net loopback receiver");
        receiver
            .set_read_timeout(Some(Duration::from_secs(2)))
            .expect("set Art-Net loopback timeout");

        let engine = ArtNetEngine::default();
        let mut frame = vec![0u8; DMX_CHANNELS];
        frame[0..5].copy_from_slice(&[128, 255, 64, 0, 16]);

        engine
            .send_frame("127.0.0.1", 1, &frame)
            .expect("send Art-Net loopback frame");

        let mut buffer = [0u8; 530];
        let (count, source) = receiver
            .recv_from(&mut buffer)
            .expect("receive Art-Net loopback frame");

        assert_eq!(source.ip(), Ipv4Addr::LOCALHOST);
        assert_eq!(count, 530);
        assert_eq!(&buffer[0..8], ARTNET_HEADER);
        assert_eq!(u16::from_le_bytes([buffer[8], buffer[9]]), OP_DMX);
        assert_eq!(u16::from_le_bytes([buffer[14], buffer[15]]), 0);
        assert_eq!(u16::from_be_bytes([buffer[16], buffer[17]]), 512);
        assert_eq!(&buffer[18..23], &[128, 255, 64, 0, 16]);
    }
}
