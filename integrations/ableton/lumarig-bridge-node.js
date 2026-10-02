const maxApi = require("max-api");
const WebSocket = require("ws");

const BRIDGE_URL = process.env.LUMARIG_BRIDGE_URL || "ws://127.0.0.1:47777/studio";
let socket = null;
let reconnectTimer = null;
let sequence = 0;
let manualDisconnect = false;
let latestSnapshotCommand = null;
let latestTransportCommand = null;

function status(kind, message) {
  maxApi.outlet("status", kind, message);
}

function scheduleReconnect() {
  if (manualDisconnect || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 1000);
}

function sendCommand(command) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect();
    return false;
  }

  try {
    socket.send(JSON.stringify({
      id: `ableton-${Date.now()}-${++sequence}`,
      command
    }));
    return true;
  } catch (error) {
    status("error", error.message || String(error));
    scheduleReconnect();
    return false;
  }
}

function flushLatestState() {
  if (latestSnapshotCommand) sendCommand(latestSnapshotCommand);
  if (latestTransportCommand) sendCommand(latestTransportCommand);
}

function connect() {
  manualDisconnect = false;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  socket = new WebSocket(BRIDGE_URL);
  socket.on("open", () => {
    status("connected", BRIDGE_URL);
    sendCommand({ type: "hello", protocol: 1, clientName: "LumaRig Ableton Bridge" });
    flushLatestState();
  });
  socket.on("message", (data) => {
    try {
      const response = JSON.parse(data.toString());
      if (!response.ok) status("error", response.error || "LumaRig rejected a bridge message.");
    } catch {
      // Replies are acknowledgements only. Ignore malformed diagnostics.
    }
  });
  socket.on("close", () => {
    socket = null;
    if (!manualDisconnect) {
      status("waiting", "LumaRig bridge disconnected");
      scheduleReconnect();
    }
  });
  socket.on("error", (error) => {
    status("error", error.message || String(error));
  });
}

function decodePayload(encoded) {
  return JSON.parse(decodeURIComponent(String(encoded)));
}

maxApi.addHandler("lumarig_snapshot", (encoded) => {
  try {
    latestSnapshotCommand = { type: "ableton.snapshot", snapshot: decodePayload(encoded) };
    sendCommand(latestSnapshotCommand);
  } catch (error) {
    status("error", `Invalid locator snapshot: ${error.message || error}`);
  }
});

maxApi.addHandler("lumarig_transport", (encoded) => {
  try {
    const transport = decodePayload(encoded);
    latestTransportCommand = { type: "ableton.transport", ...transport };
    sendCommand(latestTransportCommand);
  } catch (error) {
    status("error", `Invalid transport update: ${error.message || error}`);
  }
});

maxApi.addHandler("connect", connect);
maxApi.addHandler("disconnect", () => {
  manualDisconnect = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) socket.close();
  socket = null;
  status("off", "LumaRig bridge disconnected by operator");
});
maxApi.addHandler("bang", connect);

connect();
