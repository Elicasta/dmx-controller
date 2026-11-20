//! E1.31 (sACN) unicast/multicast DMX data output.
//! Network send success indicates a UDP datagram was handed to the OS, NOT that a fixture received it.
use std::{
    collections::HashMap,
    net::{Ipv4Addr, SocketAddrV4, UdpSocket},
    str::FromStr,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

use super::DMX_CHANNELS;

const SACN_PORT: u16 = 5568;
const MAX_SACN_UNIVERSE: u16 = 63_999;
const PACKET_LENGTH: usize = 638;
const ACN_IDENTIFIER: &[u8; 12] = b"ASC-E1.17\0\0\0";
const SOURCE_NAME: &[u8] = b"LumaRig";

struct SocketState {
    socket: Option<UdpSocket>,
    sequences: HashMap<u16, u8>,
}

pub struct SacnEngine {
    state: Mutex<SocketState>,
    cid: [u8; 16],
}

impl Default for SacnEngine {
    fn default() -> Self {
        // One unique Component Identifier per running source. No network or device identifiers are sent.
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let seed = nanos ^ ((std::process::id() as u128) << 64);
        let mut cid = seed.to_be_bytes();
        cid[6] = (cid[6] & 0x0f) | 0x40;
        cid[8] = (cid[8] & 0x3f) | 0x80;
        Self {
            state: Mutex::new(SocketState { socket: None, sequences: HashMap::new() }),
            cid,
        }
    }
}

fn destination(target: &str, universe: u16) -> Result<SocketAddrV4, String> {
    if !(1..=MAX_SACN_UNIVERSE).contains(&universe) {
        return Err(format!("sACN universe must be 1–{MAX_SACN_UNIVERSE}"));
    }
    let ip = if target.trim().eq_ignore_ascii_case("multicast") {
        Ipv4Addr::new(239, 255, (universe >> 8) as u8, (universe & 255) as u8)
    } else {
        Ipv4Addr::from_str(target.trim())
            .map_err(|_| "sACN target must be a LAN IPv4 address or 'multicast'".to_owned())?
    };
    if ip.is_unspecified() || ip.is_broadcast() {
        return Err("sACN requires a valid unicast IPv4 address or 'multicast'".into());
    }
    Ok(SocketAddrV4::new(ip, SACN_PORT))
}

/// Build a 638-byte E1.31 Data Packet (126-byte header, start code, 512 DMX slots).
pub fn build_sacn_packet(
    universe: u16,
    sequence: u8,
    cid: &[u8; 16],
    values: &[u8],
) -> Result<[u8; PACKET_LENGTH], String> {
    if !(1..=MAX_SACN_UNIVERSE).contains(&universe) {
        return Err(format!("sACN universe must be 1–{MAX_SACN_UNIVERSE}"));
    }
    if values.len() > DMX_CHANNELS {
        return Err("sACN frame cannot exceed 512 DMX channels".into());
    }
    let mut p = [0u8; PACKET_LENGTH];
    p[0..2].copy_from_slice(&0x0010u16.to_be_bytes());
    p[4..16].copy_from_slice(ACN_IDENTIFIER);
    p[16..18].copy_from_slice(&(0x7000u16 | (PACKET_LENGTH as u16 - 16)).to_be_bytes());
    p[18..22].copy_from_slice(&4u32.to_be_bytes()); // VECTOR_ROOT_E131_DATA
    p[22..38].copy_from_slice(cid);
    p[38..40].copy_from_slice(&(0x7000u16 | (PACKET_LENGTH as u16 - 38)).to_be_bytes());
    p[40..44].copy_from_slice(&2u32.to_be_bytes()); // VECTOR_E131_DATA_PACKET
    p[44..44 + SOURCE_NAME.len()].copy_from_slice(SOURCE_NAME);
    p[108] = 100; // Standard source priority
    p[111] = sequence;
    p[113..115].copy_from_slice(&universe.to_be_bytes());
    p[115..117].copy_from_slice(&(0x7000u16 | (PACKET_LENGTH as u16 - 115)).to_be_bytes());
    p[117] = 2; // VECTOR_DMP_SET_PROPERTY
    p[118] = 0xa1;
    p[121..123].copy_from_slice(&1u16.to_be_bytes());
    p[123..125].copy_from_slice(&513u16.to_be_bytes());
    p[125] = 0; // DMX start code
    p[126..126 + values.len()].copy_from_slice(values);
    Ok(p)
}

impl SacnEngine {
    pub fn send_frame(&self, target: &str, universe: u16, values: &[u8]) -> Result<(), String> {
        let addr = destination(target, universe)?;
        // Do not increment sequence on a rejected frame.
        if values.len() > DMX_CHANNELS {
            return Err("sACN frame cannot exceed 512 DMX channels".into());
        }
        let mut state = self.state.lock().map_err(|_| "sACN output lock unavailable".to_owned())?;
        if state.socket.is_none() {
            let socket = UdpSocket::bind(("0.0.0.0", 0))
                .map_err(|error| format!("sACN UDP socket failed: {error}"))?;
            socket.set_multicast_ttl_v4(1)
                .map_err(|error| format!("sACN multicast TTL failed: {error}"))?;
            state.socket = Some(socket);
        }
        let sequence = state.sequences.get(&universe).copied().unwrap_or(0).wrapping_add(1);
        let packet = build_sacn_packet(universe, sequence, &self.cid, values)?;
        state.socket.as_ref().expect("socket initialized")
            .send_to(&packet, addr)
            .map_err(|error| format!("sACN UDP send to {addr} failed: {error}"))?;
        state.sequences.insert(universe, sequence);
        Ok(())
    }
}

#[tauri::command]
pub fn send_sacn_frame(
    engine: State<'_, SacnEngine>,
    target: String,
    universe: u16,
    values: Vec<u8>,
) -> Result<(), String> {
    engine.send_frame(&target, universe, &values)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packet_has_correct_e131_layers_and_slots() {
        let cid = [0x3au8; 16];
        let packet = build_sacn_packet(258, 12, &cid, &[255, 10, 20]).unwrap();
        assert_eq!(packet.len(), 638);
        assert_eq!(&packet[4..16], ACN_IDENTIFIER);
        assert_eq!(u16::from_be_bytes([packet[16], packet[17]]), 0x726e);
        assert_eq!(&packet[18..22], &[0, 0, 0, 4]);
        assert_eq!(&packet[22..38], &cid);
        assert_eq!(u16::from_be_bytes([packet[38], packet[39]]), 0x7258);
        assert_eq!(&packet[40..44], &[0, 0, 0, 2]);
        assert_eq!(packet[108], 100);
        assert_eq!(packet[111], 12);
        assert_eq!(&packet[113..115], &[1, 2]);
        assert_eq!(u16::from_be_bytes([packet[115], packet[116]]), 0x720b);
        assert_eq!(&packet[117..119], &[2, 0xa1]);
        assert_eq!(&packet[123..125], &[2, 1]);
        assert_eq!(&packet[125..129], &[0, 255, 10, 20]);
        assert!(packet[129..].iter().all(|value| *value == 0));
    }

    #[test]
    fn multicast_matches_universe_and_rejects_unsafe_targets() {
        assert_eq!(destination("multicast", 1).unwrap().ip(), &Ipv4Addr::new(239, 255, 0, 1));
        assert_eq!(destination("MULTICAST", 258).unwrap().ip(), &Ipv4Addr::new(239, 255, 1, 2));
        assert_eq!(destination("192.168.1.50", 1).unwrap().port(), 5568);
        assert!(destination("0.0.0.0", 1).is_err());
        assert!(destination("255.255.255.255", 1).is_err());
        assert!(destination("invalid", 1).is_err());
        assert!(destination("multicast", 0).is_err());
        assert!(destination("multicast", 64000).is_err());
    }

    #[test]
    fn rejects_oversized_payload() {
        assert!(build_sacn_packet(1, 1, &[0; 16], &[0; 513]).is_err());
        assert!(build_sacn_packet(0, 1, &[0; 16], &[]).is_err());
    }
}
