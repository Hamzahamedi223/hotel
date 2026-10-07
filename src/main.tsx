import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getPreferredTheme } from './lib/theme';
import { installApi } from './lib/api';
import './index.css';

installApi();
applyTheme(getPreferredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
