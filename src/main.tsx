import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import StageMonitor from './components/StageMonitor';
import MediaOutputWindow from './components/MediaOutputWindow';
import './styles.css';
import './operator-cleanup.css';

const params = new URLSearchParams(window.location.search);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {params.has('stage-monitor')
      ? <StageMonitor/>
      : params.has('media-output')
        ? <MediaOutputWindow/>
        : <App/>}
  </React.StrictMode>
);
