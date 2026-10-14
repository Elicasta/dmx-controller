import { useEffect, useRef, useState } from 'react';
import { DEFAULT_QLC_URL, QlcWebSocketBridge, type QlcConnection } from '../core/qlc-websocket';

/**
 * Manual integration smoke test. Does not modify native DMX routing or
 * configure physical QLC+ universes.
 */
export default function QlcIntegrationPanel({ nativeOutputConnected }: { nativeOutputConnected: boolean }) {
  const bridge = useRef<QlcWebSocketBridge | null>(null);
  if (!bridge.current) bridge.current = new QlcWebSocketBridge();
  const [status, setStatus] = useState<QlcConnection>('disconnected');
  const [functions, setFunctions] = useState<Array<{id:number;name:string}>>([]);
  const [functionId, setFunctionId] = useState('');
  const [projectLoaded, setProjectLoaded] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => () => bridge.current?.disconnect(), []);

  function connect() {
    if (nativeOutputConnected) { setMessage('Disconnect native uDMX before testing QLC+ to avoid conflicting physical output.'); return; }
    try {
      setMessage('');
      bridge.current!.connect(
        state => { setStatus(state); if (state==='disconnected') setFunctions([]); },
        event => {
          if (event.type === 'functions-list') {
            setFunctions(event.functions);
            setFunctionId(current => event.functions.some(item=>String(item.id)===current) ? current : String(event.functions[0]?.id ?? ''));
          }
          if (event.type === 'project-loaded') setProjectLoaded(event.loaded);
          if (event.type === 'function-status') setMessage(`QLC+ function ${event.id} is ${event.running ? 'running' : 'stopped'}.`);
        },
        DEFAULT_QLC_URL,
      );
    } catch (error) { setMessage(String(error)); setStatus('disconnected'); }
  }

  function disconnect() {
    bridge.current?.disconnect();
    setStatus('disconnected');
    setFunctions([]);
    setProjectLoaded(null);
    setMessage('QLC+ disconnected.');
  }

  function run(running: boolean) {
    try {
      const id = Number(functionId);
      bridge.current!.send({type:'function',id,running});
      setMessage(`Sent ${running?'START':'STOP'} to QLC+ function ${id}. Confirm in QLC+ before using live.`);
    } catch (error) { setMessage(String(error)); }
  }

  const canRun = status==='connected' && !nativeOutputConnected && functions.some(item=>String(item.id)===functionId);
  return <section className="console-panel connection-console qlc-integration-console">
    <header><div><span>EXPERIMENTAL · EXTERNAL ENGINE</span><h2>QLC+ 5 Bridge</h2></div><b className={status==='connected' ? 'healthy' : ''}>{status}</b></header>
    <p>Connects to QLC+ running on this computer. This is a control test, not an automatic output-engine switch. Native LumaRig remains the lighting engine.</p>
    <div className="artnet-health-grid">
      <div><span>ENDPOINT</span><strong>{DEFAULT_QLC_URL}</strong></div>
      <div><span>PROJECT</span><strong>{projectLoaded===null?'Unknown':projectLoaded?'Loaded':'Not loaded'}</strong></div>
      <div><span>FUNCTIONS</span><strong>{functions.length}</strong></div>
    </div>
    {nativeOutputConnected && <p className="relay-error">Native physical uDMX is connected. Disconnect it before testing external QLC+ commands.</p>}
    <div className="settings-actions">
      {status==='disconnected' ? <button className="console-primary" disabled={nativeOutputConnected} onClick={connect}>Connect local QLC+</button> :
       <button onClick={disconnect}>Disconnect QLC+</button>}
    </div>
    {status==='connected' && <>
      <label><span>Discovered QLC+ function</span><select value={functionId} onChange={event=>setFunctionId(event.target.value)}>
        {functions.length===0 && <option value="">No QLC+ functions found</option>}
        {functions.map(item=><option key={item.id} value={String(item.id)}>{item.name} · #{item.id}</option>)}
      </select></label>
      <div className="settings-actions">
        <button disabled={!canRun} className="console-primary" onClick={()=>run(true)}>Start selected</button>
        <button disabled={!canRun} onClick={()=>run(false)}>Stop selected</button>
      </div>
    </>}
    {message && <p role="status" className="relay-error">{message}</p>}
    <small>Test with QLC+'s virtual output first. Do not control the same fixture from two engines. Launch QLC+ with its web interface enabled (-w).</small>
  </section>;
}
