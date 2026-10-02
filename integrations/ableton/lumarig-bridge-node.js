const maxApi = require("max-api");
const WebSocket = require("ws");

const BRIDGE_URL = process.env.LUMARIG_BRIDGE_URL || "ws://127.0.0.1:47777";
let socket = null;
let reconnectTimer = null;
let sequence = 0;

function status(kind, message) {
  maxApi.outlet("status", kind, message);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 1000);
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  socket = new WebSocket(BRIDGE_URL);
  socket.on("open", () => status("connected", BRIDGE_URL));
  socket.on("message", (data) => {
    try {
      const response = JSON.parse(data.toString());
      if (!response.ok) status("error", response.error || "LumaRig rejected a bridge message.");
    } catch {
      // Replies are acknowledgements only. Ignore malformed diagnostics.
    }
  });
  socket.on("close", () => {
    status("waiting", "LumaRig bridge disconnected");
    scheduleReconnect();
  });
  socket.on("error", (error) => {
    status("error", error.message || String(error));
  });
}

function decodePayload(encoded) {
  return JSON.parse(decodeURIComponent(String(encoded)));
}

function sendCommand(command) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect();
    return false;
  }

  socket.send(JSON.stringify({
    id: `ableton-${Date.now()}-${++sequence}`,
    command
  }));
  return true;
}

maxApi.addHandler("lumarig_snapshot", (encoded) => {
  try {
    sendCommand({ type: "ableton.snapshot", snapshot: decodePayload(encoded) });
  } catch (error) {
    status("error", `Invalid locator snapshot: ${error.message || error}`);
  }
});

maxApi.addHandler("lumarig_transport", (encoded) => {
  try {
    const transport = decodePayload(encoded);
    sendCommand({ type: "ableton.transport", ...transport });
  } catch (error) {
    status("error", `Invalid transport update: ${error.message || error}`);
  }
});

maxApi.addHandler("connect", connect);
maxApi.addHandler("disconnect", () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) socket.close();
  socket = null;
});
maxApi.addHandler("bang", connect);

connect();
