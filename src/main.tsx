import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MediaOutput from './components/MediaOutput';
import StageMonitor from './components/StageMonitor';
import './styles.css';
import './operator-cleanup.css';
import './song-bank.css';
import './p0-refinement.css';
import './media-library.css';
import './cloud-account.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has('media-output') ? <MediaOutput/> : new URLSearchParams(window.location.search).has('stage-monitor') ? <StageMonitor/> : <App/>}
  </React.StrictMode>
);
