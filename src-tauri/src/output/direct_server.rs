use serde::Serialize;
use std::{
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tungstenite::{accept_hdr_with_config, protocol::WebSocketConfig, handshake::server::{Request, Response}, Message, WebSocket};

const DIRECT_PORT: u16 = 9460;
const MAX_CLIENTS: usize = 8;
const MESSAGES_PER_POLL: usize = 4;
const MAX_TOTAL_MESSAGES: usize = 16;
const MAX_BYTES_PER_POLL: usize = 2 * 1024 * 1024;

pub use super::fixture_frame::DirectFixtureFrame;

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
    incoming: Vec<String>,
}

#[derive(Clone, Default)]
pub struct LumaVizDirectEngine {
    started: Arc<AtomicBool>,
    listening: Arc<AtomicBool>,
    frames_sent: Arc<AtomicU64>,
    shared: Arc<Mutex<Shared>>,
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
                    if engine.shared.lock().map(|s| s.clients.len() >= MAX_CLIENTS).unwrap_or(true) { continue; }
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
                    let _ = stream.set_write_timeout(Some(Duration::from_millis(800)));
                    let mut config = WebSocketConfig::default();
                    config.max_message_size = Some(1024 * 1024);
                    config.max_frame_size = Some(1024 * 1024);
                    config.max_write_buffer_size = 2 * 1024 * 1024;
                    let accepted_path = Arc::new(AtomicBool::new(false));
                    let accepted_path_flag = accepted_path.clone();
                    match accept_hdr_with_config(stream, move |request: &Request, response: Response| {
                        accepted_path_flag.store(request.uri().path() == "/lumaviz", Ordering::SeqCst);
                        Ok(response)
                    }, Some(config)) {
                        Ok(mut socket) if accepted_path.load(Ordering::SeqCst) => {
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

    pub fn broadcast_message(&self, payload: String) -> Result<(), String> {
        if let Ok(mut shared) = self.shared.lock() {
            shared.clients.retain_mut(|socket| socket.send(Message::Text(payload.clone().into())).is_ok());
        }
        Ok(())
    }

    pub fn poll_incoming(&self) -> Vec<String> {
        let mut messages = Vec::new();
        if let Ok(mut shared) = self.shared.lock() {
            let mut received = Vec::new();
            let mut bytes = 0usize;
            shared.clients.retain_mut(|socket| {
              for _ in 0..MESSAGES_PER_POLL {
                if received.len() >= MAX_TOTAL_MESSAGES || bytes >= MAX_BYTES_PER_POLL { break; }
                match socket.read() {
                    Ok(Message::Text(text)) => { bytes += text.len(); received.push(text.to_string()); continue; }
                    Ok(Message::Close(_)) => return false,
                    Ok(_) => continue,
                    Err(tungstenite::Error::Io(error)) if error.kind() == std::io::ErrorKind::WouldBlock => return true,
                    Err(_) => return false,
                }
              }
              true
            });
            shared.incoming.extend(received);
            messages.append(&mut shared.incoming);
        }
        messages
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

#[cfg(test)]
mod tests {
    use super::{valid_hello, LumaVizDirectEngine, WebSocketConfig, accept_hdr_with_config, Request, Response, Message};

    #[test]
    fn accepts_v1_fixture_frame_client() {
        assert!(valid_hello(r#"{"type":"lumaviz.hello","protocolVersion":1,"capabilities":["fixture-frame-v1"]}"#));
    }

    #[test]
    fn accepts_a_compressed_preview_sized_message_without_unbounded_poll() {
        use std::{net::{TcpListener, TcpStream}, sync::mpsc, thread, time::{Duration, Instant}};
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut config = WebSocketConfig::default();
            config.max_message_size = Some(1024 * 1024);
            config.max_frame_size = Some(1024 * 1024);
            let socket = accept_hdr_with_config(stream, |_: &Request, response: Response| Ok(response), Some(config)).unwrap();
            socket.get_ref().set_nonblocking(true).unwrap();
            sender.send(socket).unwrap();
        });
        let stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let (mut client, _) = tungstenite::client(format!("ws://127.0.0.1:{port}/lumaviz"), stream).unwrap();
        let engine = LumaVizDirectEngine::default();
        engine.shared.lock().unwrap().clients.push(receiver.recv_timeout(Duration::from_secs(1)).unwrap());
        let payload = "x".repeat(130_000);
        client.send(Message::Text(payload.clone().into())).unwrap();
        let start = Instant::now();
        let received = loop {
            let messages = engine.poll_incoming();
            if !messages.is_empty() { break messages; }
            assert!(start.elapsed() < Duration::from_secs(1), "preview not received");
            thread::sleep(Duration::from_millis(10));
        };
        assert_eq!(received, vec![payload]);
        assert_eq!(engine.status().clients, 1);
    }

    #[test]
    fn rejects_wrong_protocol() {
        assert!(!valid_hello(r#"{"type":"lumaviz.hello","protocolVersion":2,"capabilities":["fixture-frame-v1"]}"#));
    }
}
