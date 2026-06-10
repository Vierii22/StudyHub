import React from 'react';
import ReactDOM from 'react-dom/client';
import { App, AppErrorBoundary } from './app/app.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
