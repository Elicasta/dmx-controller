use midir::{Ignore, MidiInput, MidiInputConnection};
use serde::Serialize;
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

const MAX_QUEUED_EVENTS: usize = 512;

#[derive(Clone, Debug, Serialize)]
pub struct MidiInputInfo {
    pub id: usize,
    pub name: String,
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct MidiStatus {
    pub connected: bool,
    pub input_name: Option<String>,
    pub messages_received: u64,
    pub last_event: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MidiEventKind {
    NoteOn,
    NoteOff,
    ControlChange,
    Clock,
    Start,
    Continue,
    Stop,
    SongPosition,
}

#[derive(Clone, Debug, Serialize)]
pub struct MidiEvent {
    pub kind: MidiEventKind,
    pub channel: Option<u8>,
    pub number: Option<u8>,
    pub value: Option<u8>,
    pub song_position: Option<u16>,
    pub timestamp: u64,
}

pub struct MidiEngine {
    connection: Mutex<Option<MidiInputConnection<()>>>,
    status: Arc<Mutex<MidiStatus>>,
    events: Arc<Mutex<VecDeque<MidiEvent>>>,
}

impl MidiEngine {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
            status: Arc::new(Mutex::new(MidiStatus::default())),
            events: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    pub fn list_inputs(&self) -> Result<Vec<MidiInputInfo>, String> {
        let input = MidiInput::new("DMX Controller MIDI scan")
            .map_err(|error| format!("Could not open CoreMIDI: {error}"))?;
        input
            .ports()
            .iter()
            .enumerate()
            .map(|(id, port)| {
                input
                    .port_name(port)
                    .map(|name| MidiInputInfo { id, name })
                    .map_err(|error| format!("Could not read MIDI input name: {error}"))
            })
            .collect()
    }

    pub fn connect(&self, input_id: usize) -> Result<(), String> {
        self.disconnect()?;

        let mut input = MidiInput::new("DMX Controller MIDI input")
            .map_err(|error| format!("Could not open CoreMIDI: {error}"))?;
        input.ignore(Ignore::None);
        let ports = input.ports();
        let port = ports
            .get(input_id)
            .ok_or_else(|| "That MIDI input is no longer available. Scan again.".to_string())?;
        let name = input
            .port_name(port)
            .map_err(|error| format!("Could not read MIDI input name: {error}"))?;

        let status = Arc::clone(&self.status);
        let events = Arc::clone(&self.events);
        let connection = input
            .connect(
                port,
                "dmx-controller-midi-in",
                move |timestamp, message, _| {
                    let Some(event) = parse_midi_event(timestamp, message) else {
                        return;
                    };
                    let summary = describe_event(&event);
                    if let Ok(mut queue) = events.lock() {
                        if queue.len() >= MAX_QUEUED_EVENTS {
                            queue.pop_front();
                        }
                        queue.push_back(event);
                    }
                    if let Ok(mut current) = status.lock() {
                        current.messages_received = current.messages_received.saturating_add(1);
                        current.last_event = Some(summary);
                        current.last_error = None;
                    }
                },
                (),
            )
            .map_err(|error| format!("Could not connect MIDI input: {error}"))?;

        let mut active = self.connection.lock().map_err(|_| "MIDI connection lock failed.".to_string())?;
        *active = Some(connection);
        if let Ok(mut current) = self.status.lock() {
            current.connected = true;
            current.input_name = Some(name);
            current.last_error = None;
        }
        Ok(())
    }

    pub fn disconnect(&self) -> Result<(), String> {
        let mut active = self.connection.lock().map_err(|_| "MIDI connection lock failed.".to_string())?;
        active.take();
        if let Ok(mut current) = self.status.lock() {
            current.connected = false;
            current.input_name = None;
        }
        Ok(())
    }

    pub fn status(&self) -> MidiStatus {
        self.status.lock().map(|status| status.clone()).unwrap_or_else(|_| MidiStatus {
            last_error: Some("MIDI status lock failed.".to_string()),
            ..Default::default()
        })
    }

    pub fn drain_events(&self) -> Vec<MidiEvent> {
        self.events
            .lock()
            .map(|mut events| events.drain(..).collect())
            .unwrap_or_default()
    }
}

fn parse_midi_event(timestamp: u64, message: &[u8]) -> Option<MidiEvent> {
    let status = *message.first()?;
    let channel = (status & 0x0f) + 1;
    let data_one = message.get(1).copied();
    let data_two = message.get(2).copied();
    let (kind, event_channel, number, value, song_position) = match status & 0xf0 {
        0x80 => (MidiEventKind::NoteOff, Some(channel), data_one, data_two, None),
        0x90 if data_two == Some(0) => (MidiEventKind::NoteOff, Some(channel), data_one, data_two, None),
        0x90 => (MidiEventKind::NoteOn, Some(channel), data_one, data_two, None),
        0xb0 => (MidiEventKind::ControlChange, Some(channel), data_one, data_two, None),
        0xf0 => match status {
            0xf2 if message.len() >= 3 => (
                MidiEventKind::SongPosition,
                None,
                None,
                None,
                Some((message[1] as u16) | ((message[2] as u16) << 7)),
            ),
            0xf8 => (MidiEventKind::Clock, None, None, None, None),
            0xfa => (MidiEventKind::Start, None, None, None, None),
            0xfb => (MidiEventKind::Continue, None, None, None, None),
            0xfc => (MidiEventKind::Stop, None, None, None, None),
            _ => return None,
        },
        _ => return None,
    };

    Some(MidiEvent {
        kind,
        channel: event_channel,
        number,
        value,
        song_position,
        timestamp,
    })
}

fn describe_event(event: &MidiEvent) -> String {
    match event.kind {
        MidiEventKind::NoteOn => format!(
            "Note {} · Ch {} · Vel {}",
            event.number.unwrap_or_default(),
            event.channel.unwrap_or_default(),
            event.value.unwrap_or_default()
        ),
        MidiEventKind::NoteOff => format!(
            "Note {} off · Ch {}",
            event.number.unwrap_or_default(),
            event.channel.unwrap_or_default()
        ),
        MidiEventKind::ControlChange => format!(
            "CC {} · Ch {} · {}",
            event.number.unwrap_or_default(),
            event.channel.unwrap_or_default(),
            event.value.unwrap_or_default()
        ),
        MidiEventKind::Clock => "MIDI clock".to_string(),
        MidiEventKind::Start => "Transport start".to_string(),
        MidiEventKind::Continue => "Transport continue".to_string(),
        MidiEventKind::Stop => "Transport stop".to_string(),
        MidiEventKind::SongPosition => format!("Song position {}", event.song_position.unwrap_or_default()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_notes_cc_and_transport() {
        let note = parse_midi_event(1, &[0x92, 36, 100]).unwrap();
        assert!(matches!(note.kind, MidiEventKind::NoteOn));
        assert_eq!(note.channel, Some(3));
        assert_eq!(note.number, Some(36));

        let cc = parse_midi_event(2, &[0xb0, 7, 64]).unwrap();
        assert!(matches!(cc.kind, MidiEventKind::ControlChange));
        assert_eq!(cc.value, Some(64));

        assert!(matches!(parse_midi_event(3, &[0xfa]).unwrap().kind, MidiEventKind::Start));
        assert_eq!(parse_midi_event(4, &[0xf2, 1, 2]).unwrap().song_position, Some(257));
    }
}

