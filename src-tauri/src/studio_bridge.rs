use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tungstenite::{accept, Message};

pub const STUDIO_BRIDGE_PORT: u16 = 47777;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeEnvelope {
    pub id: String,
    pub command: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeResponse {
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBridgeStatus {
    pub listening: bool,
    pub port: u16,
    pub connected_clients: usize,
    pub last_error: Option<String>,
}

struct BridgeRequest {
    envelope: StudioBridgeEnvelope,
    reply: Sender<StudioBridgeResponse>,
}

pub struct StudioBridge {
    running: Arc<AtomicBool>,
    connected_clients: Arc<Mutex<usize>>,
    last_error: Arc<Mutex<Option<String>>>,
    requests_rx: Mutex<Receiver<BridgeRequest>>,
    pending: Mutex<HashMap<String, Sender<StudioBridgeResponse>>>,
}

impl StudioBridge {
    pub fn new() -> Self {
        let (requests_tx, requests_rx) = mpsc::channel();
        let running = Arc::new(AtomicBool::new(false));
        let connected_clients = Arc::new(Mutex::new(0));
        let last_error = Arc::new(Mutex::new(None));

        let run_flag = Arc::clone(&running);
        let clients = Arc::clone(&connected_clients);
        let error = Arc::clone(&last_error);
        thread::spawn(move || match TcpListener::bind(("0.0.0.0", STUDIO_BRIDGE_PORT)) {
            Ok(listener) => {
                run_flag.store(true, Ordering::SeqCst);
                if let Err(err) = listener.set_nonblocking(true) {
                    *error.lock().unwrap() = Some(err.to_string());
                    return;
                }
                while run_flag.load(Ordering::SeqCst) {
                    match listener.accept() {
                        Ok((stream, _)) => {
                            let tx = requests_tx.clone();
                            let count = Arc::clone(&clients);
                            thread::spawn(move || handle_client(stream, tx, count));
                        }
                        Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(25)),
                        Err(err) => {
                            *error.lock().unwrap() = Some(err.to_string());
                            thread::sleep(Duration::from_millis(250));
                        }
                    }
                }
            }
            Err(err) => *error.lock().unwrap() = Some(err.to_string()),
        });

        Self { running, connected_clients, last_error, requests_rx: Mutex::new(requests_rx), pending: Mutex::new(HashMap::new()) }
    }

    pub fn status(&self) -> StudioBridgeStatus {
        StudioBridgeStatus {
            listening: self.running.load(Ordering::SeqCst),
            port: STUDIO_BRIDGE_PORT,
            connected_clients: *self.connected_clients.lock().unwrap(),
            last_error: self.last_error.lock().unwrap().clone(),
        }
    }

    pub fn drain(&self) -> Vec<StudioBridgeEnvelope> {
        let rx = self.requests_rx.lock().unwrap();
        let mut requests = Vec::new();
        while let Ok(request) = rx.try_recv() {
            self.pending.lock().unwrap().insert(request.envelope.id.clone(), request.reply);
            requests.push(request.envelope);
        }
        requests
    }

    pub fn reply(&self, response: StudioBridgeResponse) -> Result<(), String> {
        let reply = self.pending.lock().unwrap().remove(&response.id)
            .ok_or_else(|| "Studio bridge request is no longer pending.".to_string())?;
        reply.send(response).map_err(|err| err.to_string())
    }
}

fn handle_client(stream: TcpStream, requests: Sender<BridgeRequest>, clients: Arc<Mutex<usize>>) {
    let mut socket = match accept(stream) {
        Ok(socket) => socket,
        Err(_) => return,
    };
    *clients.lock().unwrap() += 1;

    while let Ok(message) = socket.read() {
        if message.is_close() { break; }
        let Message::Text(text) = message else { continue };
        let envelope: StudioBridgeEnvelope = match serde_json::from_str(text.as_ref()) {
            Ok(value) => value,
            Err(err) => {
                let response = StudioBridgeResponse { id: String::new(), ok: false, error: Some(format!("Invalid Studio command: {err}")), payload: None };
                let _ = socket.send(Message::Text(serde_json::to_string(&response).unwrap().into()));
                continue;
            }
        };
        let (reply_tx, reply_rx) = mpsc::channel();
        if requests.send(BridgeRequest { envelope, reply: reply_tx }).is_err() { break; }
        match reply_rx.recv_timeout(Duration::from_secs(3)) {
            Ok(response) => {
                if socket.send(Message::Text(serde_json::to_string(&response).unwrap().into())).is_err() { break; }
            }
            Err(_) => {
                let response = StudioBridgeResponse { id: String::new(), ok: false, error: Some("LumaRig UI did not acknowledge the Studio command.".into()), payload: None };
                let _ = socket.send(Message::Text(serde_json::to_string(&response).unwrap().into()));
            }
        }
    }
    *clients.lock().unwrap() = clients.lock().unwrap().saturating_sub(1);
}
