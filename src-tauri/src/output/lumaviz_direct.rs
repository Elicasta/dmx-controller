use serde::{Deserialize, Serialize};
use std::{
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tungstenite::{accept_hdr, handshake::server::{Request, Response}, Message, WebSocket};

const DIRECT_PORT: u16 = 9460;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectFixtureState {
    pub id: String,
    pub intensity: Option<f64>,
    pub color: Option<String>,
    pub pan: Option<f64>,
    pub tilt: Option<f64>,
    pub beam_angle: Option<f64>,
    pub strobe_hz: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectFixtureFrame {
    pub version: u8,
    pub show_id: Option<String>,
    pub sequence: u64,
    pub timestamp: u64,
    pub fixtures: Vec<DirectFixtureState>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectStatus {
    pub listening: bool,
    pub port: u16,
    pub clients: u64,
    pub frames_sent: u64,
    pub last_error: Option<String>,
}

#[derive(Default)]
struct Shared {
    clients: Vec<WebSocket<TcpStream>>,
    last_error: Option<String>,
}

#[derive(Clone, Default)]
pub struct LumaVizDirectEngine {
    started: Arc<AtomicBool>,
    listening: Arc<AtomicBool>,
    frames_sent: Arc<AtomicU64>,
    shared: Arc<Mutex<Shared>>,
    incoming: Arc<Mutex<Vec<serde_json::Value>>>,
}

impl LumaVizDirectEngine {
    pub fn start(&self) -> Result<(), String> {
        if self.started.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let listener = match TcpListener::bind(("127.0.0.1", DIRECT_PORT)) {
            Ok(listener) => listener,
            Err(error) => {
                self.started.store(false, Ordering::SeqCst);
                self.set_error(format!("Could not bind LumaRig Direct on 127.0.0.1:{DIRECT_PORT}: {error}"));
                return Err(error.to_string());
            }
        };
        listener.set_nonblocking(true).map_err(|error| error.to_string())?;
        self.listening.store(true, Ordering::SeqCst);
        let engine = self.clone();
        thread::spawn(move || loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let mut accepted_path = false;
                    match accept_hdr(stream, |request: &Request, response: Response| {
                        accepted_path = request.uri().path() == "/lumaviz";
                        Ok(response)
                    }) {
                        Ok(mut socket) if accepted_path => {
                            let _ = socket.get_mut().set_read_timeout(Some(Duration::from_millis(800)));
                            match socket.read() {
                                Ok(Message::Text(text)) if valid_hello(text.as_str()) => {
                                    let _ = socket.get_mut().set_read_timeout(None);
                                    let _ = socket.get_mut().set_nonblocking(true);
                                    if let Ok(mut shared) = engine.shared.lock() {
                                        shared.last_error = None;
                                        shared.clients.push(socket);
                                    }
                                }
                                Ok(_) => engine.set_error("LumaViz Direct rejected a client without a valid lumaviz.hello.".into()),
                                Err(error) => engine.set_error(format!("LumaViz Direct handshake failed: {error}")),
                            }
                        }
                        Ok(_) => engine.set_error("LumaViz Direct rejected a WebSocket path other than /lumaviz.".into()),
                        Err(error) => engine.set_error(format!("LumaViz Direct WebSocket upgrade failed: {error}")),
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                Err(error) => {
                    engine.set_error(format!("LumaViz Direct listener error: {error}"));
                    thread::sleep(Duration::from_millis(100));
                }
            }
        });
        Ok(())
    }

    pub fn broadcast(&self, frame: DirectFixtureFrame) -> Result<(), String> {
        if !self.listening.load(Ordering::SeqCst) {
            return Ok(());
        }
        let payload = serde_json::to_string(&serde_json::json!({"type":"fixture-frame","frame":frame}))
            .map_err(|error| error.to_string())?;
        let mut sent = 0u64;
        if let Ok(mut shared) = self.shared.lock() {
            shared.clients.retain_mut(|socket| match socket.send(Message::Text(payload.clone().into())) {
                Ok(_) => { sent += 1; true }
                Err(tungstenite::Error::Io(error)) if error.kind() == std::io::ErrorKind::WouldBlock => true,
                Err(_) => false,
            });
        }
        if sent > 0 {
            self.frames_sent.fetch_add(sent, Ordering::Relaxed);
        }
        Ok(())
    }

    pub fn poll_incoming(&self) {
        if let Ok(mut shared) = self.shared.lock() {
            let incoming = self.incoming.clone();
            shared.clients.retain_mut(|socket| {
                loop {
                    match socket.read() {
                        Ok(Message::Text(text)) => {
                            if let Ok(value) = serde_json::from_str::<serde_json::Value>(text.as_str()) {
                                if value.get("type").and_then(|v| v.as_str()) == Some("stage-change") {
                                    if let Ok(mut queue) = incoming.lock() { queue.push(value); }
                                }
                            }
                        }
                        Ok(Message::Ping(payload)) => { let _ = socket.send(Message::Pong(payload)); }
                        Ok(Message::Close(_)) => return false,
                        Ok(_) => {}
                        Err(tungstenite::Error::Io(error)) if error.kind() == std::io::ErrorKind::WouldBlock => break,
                        Err(_) => return false,
                    }
                }
                true
            });
        }
    }

    pub fn drain_stage_changes(&self) -> Vec<serde_json::Value> {
        self.poll_incoming();
        self.incoming.lock().map(|mut queue| std::mem::take(&mut *queue)).unwrap_or_default()
    }

    pub fn broadcast_stage_change(&self, change: serde_json::Value) -> Result<(), String> {
        if !self.listening.load(Ordering::SeqCst) { return Ok(()); }
        let payload = serde_json::to_string(&serde_json::json!({"type":"stage-change","change":change})).map_err(|error| error.to_string())?;
        if let Ok(mut shared) = self.shared.lock() {
            shared.clients.retain_mut(|socket| match socket.send(Message::Text(payload.clone().into())) {
                Ok(_) => true,
                Err(tungstenite::Error::Io(error)) if error.kind() == std::io::ErrorKind::WouldBlock => true,
                Err(_) => false,
            });
        }
        Ok(())
    }

    pub fn status(&self) -> DirectStatus {
        let (clients, last_error) = self.shared.lock()
            .map(|shared| (shared.clients.len() as u64, shared.last_error.clone()))
            .unwrap_or((0, Some("LumaRig Direct state lock failed.".into())));
        DirectStatus {
            listening: self.listening.load(Ordering::SeqCst),
            port: DIRECT_PORT,
            clients,
            frames_sent: self.frames_sent.load(Ordering::Relaxed),
            last_error,
        }
    }

    fn set_error(&self, message: String) {
        if let Ok(mut shared) = self.shared.lock() {
            shared.last_error = Some(message);
        }
    }
}

fn valid_hello(text: &str) -> bool {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else { return false; };
    value.get("type").and_then(|v| v.as_str()) == Some("lumaviz.hello")
        && value.get("protocolVersion").and_then(|v| v.as_u64()) == Some(1)
        && value.get("capabilities").and_then(|v| v.as_array())
            .map(|items| items.iter().any(|item| item.as_str() == Some("fixture-frame-v1")))
            .unwrap_or(false)
}

#[tauri::command]
pub fn start_lumaviz_direct(engine: tauri::State<'_, LumaVizDirectEngine>) -> Result<DirectStatus, String> {
    engine.start()?;
    Ok(engine.status())
}

#[tauri::command]
pub fn lumaviz_direct_status(engine: tauri::State<'_, LumaVizDirectEngine>) -> DirectStatus {
    engine.status()
}

#[tauri::command]
pub fn send_lumaviz_fixture_frame(
    engine: tauri::State<'_, LumaVizDirectEngine>,
    frame: DirectFixtureFrame,
) -> Result<(), String> {
    engine.broadcast(frame)
}

#[tauri::command]
pub fn drain_lumaviz_stage_changes(engine: tauri::State<'_, LumaVizDirectEngine>) -> Vec<serde_json::Value> {
    engine.drain_stage_changes()
}

#[tauri::command]
pub fn send_lumaviz_stage_change(engine: tauri::State<'_, LumaVizDirectEngine>, change: serde_json::Value) -> Result<(), String> {
    engine.broadcast_stage_change(change)
}

#[cfg(test)]
mod tests {
    use super::valid_hello;

    #[test]
    fn accepts_v1_fixture_frame_client() {
        assert!(valid_hello(r#"{"type":"lumaviz.hello","protocolVersion":1,"capabilities":["fixture-frame-v1"]}"#));
    }

    #[test]
    fn rejects_wrong_protocol() {
        assert!(!valid_hello(r#"{"type":"lumaviz.hello","protocolVersion":2,"capabilities":["fixture-frame-v1"]}"#));
    }
}
