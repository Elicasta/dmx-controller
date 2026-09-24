use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    net::{TcpListener, TcpStream},
    sync::{atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering}, mpsc::{self, Receiver, Sender, SyncSender}, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tungstenite::{accept_with_config, protocol::WebSocketConfig, Message};

pub const STUDIO_BRIDGE_PORT: u16 = 47777;
const MAX_CLIENTS: usize = 8;
const MAX_REQUESTS: usize = 64;
const MAX_DRAIN: usize = 32;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeEnvelope { pub id: String, pub command: Value }
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeResponse {
    pub id: String, pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")] pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub payload: Option<Value>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeStatus {
    pub listening: bool, pub port: u16, pub connected_clients: usize,
    pub pending_requests: usize, pub last_error: Option<String>,
}
struct PendingRequest {
    original_id: String,
    deadline: Instant,
    reply: Sender<StudioBridgeResponse>,
}
type Pending = Arc<Mutex<HashMap<String, PendingRequest>>>;

pub struct StudioBridge {
    running: Arc<AtomicBool>,
    connected_clients: Arc<AtomicUsize>,
    last_error: Arc<Mutex<Option<String>>>,
    requests_rx: Mutex<Receiver<StudioBridgeEnvelope>>,
    pending: Pending,
    port: u16,
}

// A permit is released on every exit, including failed upgrades and panics.
// Never acquire the same non-reentrant mutex twice to update a client count.
struct ClientPermit(Arc<AtomicUsize>);
impl Drop for ClientPermit { fn drop(&mut self) { self.0.fetch_sub(1, Ordering::SeqCst); } }

impl StudioBridge {
    pub fn new() -> Self { Self::bind(STUDIO_BRIDGE_PORT) }
    fn bind(port: u16) -> Self {
        let (requests_tx, requests_rx) = mpsc::sync_channel(MAX_REQUESTS);
        let running = Arc::new(AtomicBool::new(false));
        let connected_clients = Arc::new(AtomicUsize::new(0));
        let last_error = Arc::new(Mutex::new(None));
        let pending = Arc::new(Mutex::new(HashMap::new()));
        let mut bridge = Self { running: running.clone(), connected_clients: connected_clients.clone(), last_error: last_error.clone(), requests_rx: Mutex::new(requests_rx), pending: pending.clone(), port };
        // LAN control must wait for explicit pairing/authentication. Same-machine
        // Studio discovery remains available without a separate bridge process.
        let listener = match TcpListener::bind(("127.0.0.1", port)) {
            Ok(listener) => listener,
            Err(err) => { *last_error.lock().unwrap() = Some(err.to_string()); return bridge; }
        };
        bridge.port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
        if let Err(err) = listener.set_nonblocking(true) {
            *last_error.lock().unwrap() = Some(err.to_string()); return bridge;
        }
        running.store(true, Ordering::SeqCst);
        let request_serial = Arc::new(AtomicU64::new(1));
        thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        if connected_clients.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| (n < MAX_CLIENTS).then_some(n + 1)).is_err() { continue; }
                        let permit = ClientPermit(connected_clients.clone());
                        let tx = requests_tx.clone(); let entries = pending.clone();
                        let serial = request_serial.clone(); let active = running.clone();
                        let errors = last_error.clone();
                        thread::spawn(move || handle_client(stream, tx, entries, serial, active, errors, permit));
                    }
                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(10)),
                    Err(err) => { *last_error.lock().unwrap() = Some(err.to_string()); thread::sleep(Duration::from_millis(100)); }
                }
            }
        });
        bridge
    }
    pub fn status(&self) -> StudioBridgeStatus {
        StudioBridgeStatus { listening: self.running.load(Ordering::SeqCst), port: self.port,
            connected_clients: self.connected_clients.load(Ordering::SeqCst),
            pending_requests: self.pending.lock().unwrap().len(), last_error: self.last_error.lock().unwrap().clone() }
    }
    pub fn drain(&self) -> Vec<StudioBridgeEnvelope> {
        let rx = self.requests_rx.lock().unwrap();
        let mut pending = self.pending.lock().unwrap();
        let now = Instant::now();
        pending.retain(|_, request| request.deadline > now);
        rx.try_iter().take(MAX_DRAIN).filter(|request| pending.contains_key(&request.id)).collect()
    }
    pub fn reply(&self, mut response: StudioBridgeResponse) -> Result<(), String> {
        let pending = self.pending.lock().unwrap().remove(&response.id);
        // Expired clients are normal. A late reply must not abort the next command.
        if let Some(request) = pending {
            response.id = request.original_id;
            let _ = request.reply.send(response);
        }
        Ok(())
    }
}
impl Drop for StudioBridge {
    fn drop(&mut self) { self.running.store(false, Ordering::SeqCst); self.pending.lock().unwrap().clear(); }
}
fn failure(id: String, error: &str) -> StudioBridgeResponse {
    StudioBridgeResponse { id, ok: false, error: Some(error.into()), payload: None }
}
fn handle_client(stream: TcpStream, requests: SyncSender<StudioBridgeEnvelope>, pending: Pending, serial: Arc<AtomicU64>, running: Arc<AtomicBool>, last_error: Arc<Mutex<Option<String>>>, _permit: ClientPermit) {
    // macOS can inherit the listener's O_NONBLOCK flag on accepted sockets.
    // tungstenite's blocking handshake does not resume an Interrupted/WouldBlock
    // upgrade, so normalize the socket before upgrading it.
    if let Err(error) = stream.set_nonblocking(false) {
        *last_error.lock().unwrap() = Some(format!("Studio socket setup failed: {error}"));
        return;
    }
    // macOS may deliver a partial WebSocket upgrade while the runner is busy.
    // Give the upgrade and initial hello a bounded grace period; subsequent
    // idle reads can poll shutdown at a shorter interval.
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
    let config = WebSocketConfig::default().max_message_size(Some(64 * 1024)).max_frame_size(Some(64 * 1024));
    let mut socket = match accept_with_config(stream, Some(config)) {
        Ok(socket) => socket,
        Err(error) => {
            let reason = format!("Studio WebSocket upgrade failed: {error}");
            *last_error.lock().unwrap() = Some(reason.clone());
            #[cfg(test)] eprintln!("{reason}");
            return;
        }
    };
    let _ = socket.get_mut().set_read_timeout(Some(Duration::from_secs(1)));
    let _ = socket.get_mut().set_write_timeout(Some(Duration::from_secs(1)));
    let mut greeted = false;
    let hello_deadline = Instant::now() + Duration::from_secs(5);
    let mut cache: VecDeque<(String, Value, StudioBridgeResponse)> = VecDeque::new();
    while running.load(Ordering::SeqCst) {
        let message = match socket.read() {
            Ok(message) => message,
            Err(tungstenite::Error::Io(err)) if matches!(err.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut)
                && (greeted || Instant::now() < hello_deadline) => continue,
            Err(_) => break,
        };
        if message.is_close() { break; }
        let Message::Text(text) = message else { let _ = socket.flush(); continue; };
        let envelope: StudioBridgeEnvelope = match serde_json::from_str(text.as_ref()) {
            Ok(value) => value,
            Err(_) => { let _ = socket.send(Message::Text(serde_json::to_string(&failure(String::new(), "Invalid Studio command envelope.")).unwrap().into())); continue; }
        };
        let original_id = envelope.id.clone();
        let response = if original_id.is_empty() || original_id.len() > 128 {
            failure(original_id, "Command ID must contain 1 to 128 bytes.")
        } else if let Some((_, command, result)) = cache.iter().find(|(id, _, _)| id == &original_id) {
            if command == &envelope.command { result.clone() } else { failure(original_id, "Command ID reused with different content.") }
        } else if !greeted && (envelope.command.get("type").and_then(Value::as_str) != Some("hello") || envelope.command.get("protocol").and_then(Value::as_u64) != Some(1)) {
            failure(original_id, "A compatible hello (protocol 1) is required before control.")
        } else {
            let (reply_tx, reply_rx) = mpsc::channel();
            let token = format!("studio-{}", serial.fetch_add(1, Ordering::Relaxed));
            pending.lock().unwrap().insert(token.clone(), PendingRequest { original_id: original_id.clone(), deadline: Instant::now() + REQUEST_TIMEOUT, reply: reply_tx });
            let response = if requests.try_send(StudioBridgeEnvelope { id: token.clone(), command: envelope.command.clone() }).is_err() {
                failure(original_id, "LumaRig control queue is full. Command not accepted.")
            } else {
                reply_rx.recv_timeout(REQUEST_TIMEOUT).unwrap_or_else(|_| failure(original_id, "LumaRig acknowledgement timed out. Outcome unknown; inspect output before retrying."))
            };
            pending.lock().unwrap().remove(&token);
            if response.ok && envelope.command.get("type").and_then(Value::as_str) == Some("hello") { greeted = true; }
            cache.push_back((response.id.clone(), envelope.command, response.clone()));
            if cache.len() > 128 { cache.pop_front(); }
            response
        };
        if socket.send(Message::Text(serde_json::to_string(&response).unwrap().into())).is_err() { break; }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn client(bridge: &StudioBridge) -> tungstenite::WebSocket<TcpStream> {
        let stream = TcpStream::connect(("127.0.0.1", bridge.port)).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        tungstenite::client(format!("ws://127.0.0.1:{}/studio", bridge.port), stream).unwrap().0
    }
    fn wait_for_request(bridge: &StudioBridge) -> StudioBridgeEnvelope {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop { if let Some(request) = bridge.drain().pop() { return request; } assert!(Instant::now() < deadline, "request never arrived"); thread::sleep(Duration::from_millis(2)); }
    }
    fn send(socket: &mut tungstenite::WebSocket<TcpStream>, id: &str, command: Value) {
        socket.send(Message::Text(serde_json::json!({"id":id,"command":command}).to_string().into())).unwrap();
    }
    fn acknowledge(bridge: &StudioBridge, socket: &mut tungstenite::WebSocket<TcpStream>) {
        let request = wait_for_request(bridge);
        bridge.reply(StudioBridgeResponse { id: request.id, ok: true, error: None, payload: None }).unwrap();
        assert!(socket.read().unwrap().to_text().unwrap().contains("\"ok\":true"));
    }
    #[test]
    fn disconnect_releases_client_and_status_stays_responsive() {
        let bridge = StudioBridge::bind(0);
        for _ in 0..20 {
            let mut socket = client(&bridge);
            send(&mut socket, "hello", serde_json::json!({"type":"hello","protocol":1}));
            acknowledge(&bridge, &mut socket);
            socket.close(None).unwrap(); drop(socket);
            let deadline = Instant::now() + Duration::from_secs(2);
            while bridge.status().connected_clients != 0 { assert!(Instant::now() < deadline); thread::sleep(Duration::from_millis(2)); }
        }
    }
    #[test]
    fn timeout_keeps_original_id_and_expired_command_is_not_dispatched() {
        let bridge = StudioBridge::bind(0); let mut socket = client(&bridge);
        send(&mut socket, "timeout-1", serde_json::json!({"type":"hello","protocol":1}));
        let response: Value = serde_json::from_str(socket.read().unwrap().to_text().unwrap()).unwrap();
        assert_eq!(response["id"], "timeout-1"); assert_eq!(response["ok"], false);
        assert!(bridge.drain().is_empty()); assert_eq!(bridge.status().pending_requests, 0);
    }
    #[test]
    fn same_ids_on_different_clients_get_distinct_internal_tokens() {
        let bridge = StudioBridge::bind(0); let mut a = client(&bridge); let mut b = client(&bridge);
        send(&mut a, "same", serde_json::json!({"type":"hello","protocol":1}));
        let first = wait_for_request(&bridge);
        send(&mut b, "same", serde_json::json!({"type":"hello","protocol":1}));
        let second = wait_for_request(&bridge); assert_ne!(first.id, second.id);
        for id in [first.id, second.id] { bridge.reply(StudioBridgeResponse{id,ok:true,error:None,payload:None}).unwrap(); }
        for socket in [&mut a, &mut b] { let r: Value=serde_json::from_str(socket.read().unwrap().to_text().unwrap()).unwrap(); assert_eq!(r["id"], "same"); }
    }
    #[test]
    fn duplicate_commands_are_acknowledged_once_without_reexecution() {
        let bridge = StudioBridge::bind(0); let mut socket = client(&bridge);
        let hello = serde_json::json!({"type":"hello","protocol":1});
        send(&mut socket, "one", hello.clone()); acknowledge(&bridge, &mut socket);
        send(&mut socket, "one", hello); assert!(socket.read().unwrap().to_text().unwrap().contains("\"ok\":true"));
        assert!(bridge.drain().is_empty());
    }
    #[test]
    fn malformed_and_unnegotiated_messages_do_not_reach_ui() {
        let bridge=StudioBridge::bind(0); let mut socket=client(&bridge);
        socket.send(Message::Text("not-json".into())).unwrap(); assert!(socket.read().unwrap().to_text().unwrap().contains("\"ok\":false"));
        send(&mut socket,"unsafe",serde_json::json!({"type":"blackout","enabled":false}));
        assert!(socket.read().unwrap().to_text().unwrap().contains("\"ok\":false")); assert!(bridge.drain().is_empty());
    }
    #[test]
    fn nonblocking_accepted_socket_completes_the_handshake() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let (requests, received) = mpsc::sync_channel(1);
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let running = Arc::new(AtomicBool::new(true));
        let count = Arc::new(AtomicUsize::new(1));
        let worker_pending = pending.clone();
        let worker_running = running.clone();
        let worker_count = count.clone();
        let worker = thread::spawn(move || {
            let (accepted, _) = listener.accept().unwrap();
            accepted.set_nonblocking(true).unwrap();
            handle_client(accepted, requests, worker_pending, Arc::new(AtomicU64::new(1)), worker_running,
                Arc::new(Mutex::new(None)), ClientPermit(worker_count));
        });
        let stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut socket = tungstenite::client(format!("ws://127.0.0.1:{port}/studio"), stream).unwrap().0;
        send(&mut socket, "hello", serde_json::json!({"type":"hello","protocol":1}));
        let request = received.recv_timeout(Duration::from_secs(2)).unwrap();
        let response = pending.lock().unwrap().remove(&request.id).unwrap();
        response.reply.send(StudioBridgeResponse { id: response.original_id, ok: true, error: None, payload: None }).unwrap();
        assert!(socket.read().unwrap().to_text().unwrap().contains("\"ok\":true"));
        socket.close(None).unwrap();
        running.store(false, Ordering::SeqCst);
        worker.join().unwrap();
        assert_eq!(count.load(Ordering::SeqCst), 0);
    }
}
