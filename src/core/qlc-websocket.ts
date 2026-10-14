/**
 * Optional QLC+ 5 external-control adapter.
 *
 * This does not replace LumaRig's current DMX engine and it is never activated
 * automatically. QLC+ must be running with its web server enabled (-w).
 * The documented API is a text protocol over /qlcplusWS, not JSON.
 * https://docs.qlcplus.org/v5/advanced/web-interface/web-api
 */
export const DEFAULT_QLC_URL = 'ws://127.0.0.1:9999/qlcplusWS';

export type QlcCommand =
  | { type: 'function'; id: number; running: boolean }
  | { type: 'widget'; id: number; value: number; momentary?: boolean }
  | { type: 'cue-list'; id: number; action: 'PLAY' | 'STOP' | 'NEXT' | 'PREV' }
  | { type: 'grand-master'; value: number }
  | { type: 'query'; target: 'project' | 'functions' | 'widgets' };

export type QlcEvent =
  | { type: 'grand-master'; value: number }
  | { type: 'function-status'; id: number; running: boolean }
  | { type: 'widget-status'; id: number; value: string }
  | { type: 'functions-list'; functions: Array<{id:number;name:string}> }
  | { type: 'project-loaded'; loaded: boolean };

const integer = (n: number, label: string, min: number, max: number) => {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid ${label}.`);
  return n;
};

export function encodeQlcCommand(command: QlcCommand): string {
  switch (command.type) {
    case 'function':
      return `QLC+API|setFunctionStatus|${integer(command.id,'function ID',0,2147483647)}|${command.running ? 1 : 0}`;
    case 'widget':
      return `${integer(command.id,'widget ID',0,2147483647)}|${integer(command.value,'widget value',0,255)}`;
    case 'cue-list':
      return `${integer(command.id,'cue list ID',0,2147483647)}|${command.action}`;
    case 'grand-master':
      return `GM_VALUE|${integer(command.value,'grand master',0,255)}`;
    case 'query': {
      const request = {project:'isProjectLoaded',functions:'getFunctionsList',widgets:'getWidgetsList'}[command.target];
      return `QLC+API|${request}`;
    }
  }
}

export function parseQlcEvent(raw: unknown): QlcEvent | null {
  if (typeof raw !== 'string' || raw.length > 8192) return null;
  const parts = raw.split('|');
  if (parts[0] === 'QLC+API' && parts[1] === 'isProjectLoaded' && (parts[2] === 'true' || parts[2] === 'false'))
    return {type:'project-loaded',loaded:parts[2]==='true'};
  if (parts[0] === 'QLC+API' && parts[1] === 'getFunctionsList') {
    const functions: Array<{id:number;name:string}> = [];
    for (let i=2; i+1<parts.length; i+=2) {
      const id = Number(parts[i]);
      if (Number.isSafeInteger(id) && id>=0 && parts[i+1]) functions.push({id,name:parts[i+1]});
    }
    return {type:'functions-list',functions};
  }
  if (parts[0] === 'GM_VALUE' && parts.length >= 2) {
    const v = Number(parts[1]);
    if (Number.isSafeInteger(v) && v >= 0 && v <= 255) return {type:'grand-master', value:v};
  }
  if (parts[0] === 'QLC+API' && parts[1] === 'getFunctionStatus' && parts.length >= 4) {
    const id = Number(parts[2]);
    if (Number.isSafeInteger(id) && id >= 0 && (parts[3] === 'Running' || parts[3] === 'Stopped'))
      return {type:'function-status', id, running:parts[3] === 'Running'};
  }
  if (parts[0] === 'QLC+API' && parts[1] === 'getWidgetStatus' && parts.length >= 4) {
    const id = Number(parts[2]);
    if (Number.isSafeInteger(id) && id >= 0) return {type:'widget-status', id, value:parts.slice(3).join('|')};
  }
  return null;
}

export type QlcConnection = 'disconnected' | 'connecting' | 'connected';

/** Connect only to the local machine. A future secured native bridge can enable LAN remotes. */
export function validateQlcUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a valid QLC+ WebSocket URL.'); }
  if (url.protocol !== 'ws:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
      url.pathname !== '/qlcplusWS' || url.username || url.password || url.search || url.hash)
    throw new Error('QLC+ must be connected through a local WebSocket on this computer.');
  return url.href;
}

export class QlcWebSocketBridge {
  private socket: WebSocket | null = null;
  private heldWidgets = new Set<number>();
  private state: QlcConnection = 'disconnected';

  constructor(private readonly socketFactory: (url: string) => WebSocket = url => new WebSocket(url)) {}

  get status(): QlcConnection { return this.state; }

  connect(
    onStatus: (status: QlcConnection) => void,
    onEvent: (event: QlcEvent) => void,
    url = DEFAULT_QLC_URL,
  ): void {
    const endpoint = validateQlcUrl(url);
    // Preserve pending hold releases when reconnecting after an unexpected socket loss.
    if (this.socket) this.disconnect();
    this.state = 'connecting';
    onStatus(this.state);
    let socket: WebSocket;
    try { socket = this.socketFactory(endpoint); }
    catch (error) { this.state = 'disconnected'; onStatus(this.state); throw error; }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.state = 'connected';
      // Never replay a stuck flash/hold after a reconnect.
      for (const id of this.heldWidgets) socket.send(`${id}|0`);
      this.heldWidgets.clear();
      onStatus(this.state);
      socket.send(encodeQlcCommand({type:'query',target:'project'}));
      socket.send(encodeQlcCommand({type:'query',target:'functions'}));
    });
    socket.addEventListener('message', (message: MessageEvent) => {
      if (this.socket !== socket) return;
      const parsed = parseQlcEvent(message.data);
      if (parsed) onEvent(parsed);
    });
    const lost = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.state = 'disconnected';
      onStatus(this.state);
    };
    socket.addEventListener('close', lost);
    socket.addEventListener('error', lost);
  }

  send(command: QlcCommand): void {
    if (this.state !== 'connected' || !this.socket || this.socket.readyState !== 1)
      throw new Error('QLC+ is disconnected. Lighting command was not sent.');
    const message = encodeQlcCommand(command);
    this.socket.send(message);
    if (command.type === 'widget' && command.momentary) {
      if (command.value === 0) this.heldWidgets.delete(command.id);
      else this.heldWidgets.add(command.id);
    }
  }

  disconnect(): void {
    if (this.socket && this.socket.readyState === 1) {
      // Release held buttons before a planned disconnect.
      for (const id of this.heldWidgets) this.socket.send(`${id}|0`);
    }
    this.socket?.close();
    this.socket = null;
    this.state = 'disconnected';
    // Explicit disconnect releases holds. Unexpected socket loss keeps IDs for reconnect.
    this.heldWidgets.clear();
  }
}
