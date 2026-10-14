import { useState } from 'react';
import { DEFAULT_QLC_URL, type QlcConnection } from '../core/qlc-websocket';

type Props = {
  nativeOutputConnected: boolean;
  connection: QlcConnection;
  armed: boolean;
  projectLoaded: boolean | null;
  functions: Array<{id:number;name:string}>;
  message: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onArm: () => void;
  onDisarm: () => void;
  onFunction: (id:number,running:boolean) => void;
};

/**
 * QLC+ transport panel is controlled by App so navigating away cannot close
 * the WebSocket or accidentally stop a show.
 */
export default function QlcIntegrationPanel(props: Props) {
  const [functionId,setFunctionId] = useState('');
  const {
    nativeOutputConnected, connection, armed, projectLoaded, functions,
    message, onConnect, onDisconnect, onArm, onDisarm, onFunction,
  } = props;
  const selectedId = functions.some(item=>String(item.id)===functionId) ? functionId : String(functions[0]?.id ?? '');
  const available = connection==='connected' && projectLoaded===true && !nativeOutputConnected;
  return <section className="console-panel connection-console qlc-integration-console">
    <header><div><span>EXTERNAL DMX ENGINE · MANUAL ARMING</span><h2>QLC+ 5 Output</h2></div>
      <b className={armed ? 'healthy' : ''}>{armed?'ARMED':connection.toUpperCase()}</b></header>
    <p>QLC+ can output LumaRig's programmed DMX through its own configured USB/Art-Net interface. LumaRig remains the cue/FX engine and the Supabase PWA continues controlling it.</p>
    <div className="artnet-health-grid">
      <div><span>ENDPOINT</span><strong>{DEFAULT_QLC_URL}</strong></div>
      <div><span>PROJECT</span><strong>{projectLoaded===null?'Unknown':projectLoaded?'Loaded':'No project'}</strong></div>
      <div><span>QLC+ FUNCTIONS</span><strong>{functions.length}</strong></div>
      <div><span>OUTPUT OWNER</span><strong>{armed?'QLC+':'LumaRig native / virtual'}</strong></div>
    </div>
    <div className="settings-actions">
      {connection==='disconnected' ? <button disabled={nativeOutputConnected} onClick={onConnect} className="console-primary">Connect local QLC+</button> :
        <button onClick={onDisconnect}>Disconnect QLC+</button>}
      {armed ? <button onClick={onDisarm}>Disarm + QLC Blackout</button> :
        <button className="console-primary" disabled={!available} onClick={onArm}>Arm QLC+ Output</button>}
    </div>
    {nativeOutputConnected && <p className="relay-error">Disconnect native uDMX before arming QLC+. Both programs must not drive the same universe.</p>}
    {connection==='connected' && !armed && <details>
      <summary>Independent QLC+ function test (before arming output)</summary>
      <label><span>Function</span><select value={selectedId} onChange={event=>setFunctionId(event.target.value)}>
        {functions.length===0 && <option value="">No discovered functions</option>}
        {functions.map(item=><option key={item.id} value={String(item.id)}>{item.name} · #{item.id}</option>)}
      </select></label>
      <div className="settings-actions">
        <button disabled={!selectedId || nativeOutputConnected} onClick={()=>onFunction(Number(selectedId),true)}>Start</button>
        <button disabled={!selectedId || nativeOutputConnected} onClick={()=>onFunction(Number(selectedId),false)}>Stop</button>
      </div>
    </details>}
    {message && <p role="status" className="relay-error">{message}</p>}
    <small>QLC+ must be running with web access (-w) and a configured project. Initial sync sends a full 512-channel frame while QLC+ Grand Master is muted. On network loss, LumaRig disarms output; fixtures might retain their last values. A physical test is required before performance use.</small>
  </section>;
}
