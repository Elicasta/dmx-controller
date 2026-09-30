import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import StageMonitor from './components/StageMonitor';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has('stage-monitor') ? <StageMonitor/> : <App/>}
  </React.StrictMode>
);
