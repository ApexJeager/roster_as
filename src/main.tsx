import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error overlay for in-iframe debugging of "Script error"
window.addEventListener('error', (event) => {
  console.error("Global captured error:", event.error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background: #0f172a; color: #fecdd3; padding: 24px; font-family: monospace; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 4px solid #ef4444;">
        <div style="max-width: 600px; width: 100%; bg: #1e293b; padding: 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
          <h1 style="color: #ef4444; margin-top: 0; font-size: 20px;">🚨 Erreur fatale de l'application</h1>
          <p style="color: #94a3b8; font-size: 14px;">Un problème critique est survenu lors du chargement :</p>
          <pre style="background: #020617; padding: 16px; border-radius: 8px; font-size: 13px; color: #f43f5e; overflow-x: auto; white-space: pre-wrap; border: 1px solid #334155;">${event.error ? (event.error.stack || event.error.message || event.error) : event.message}</pre>
          <button onclick="window.location.reload()" style="margin-top: 16px; background: #e11d48; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Actualiser la cabine</button>
        </div>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("Global captured unhandled promise rejection:", event.reason);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background: #0f172a; color: #fecdd3; padding: 24px; font-family: monospace; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 4px solid #f59e0b;">
        <div style="max-width: 600px; width: 100%; bg: #1e293b; padding: 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
          <h1 style="color: #f59e0b; margin-top: 0; font-size: 20px;">⚠️ Rejection Promise non gérée</h1>
          <p style="color: #94a3b8; font-size: 14px;">Une opération asynchrone a échoué en arrière-plan :</p>
          <pre style="background: #020617; padding: 16px; border-radius: 8px; font-size: 13px; color: #fbbf24; overflow-x: auto; white-space: pre-wrap; border: 1px solid #334155;">${event.reason ? (event.reason.stack || event.reason.message || JSON.stringify(event.reason)) : 'Rejection inconnue'}</pre>
          <button onclick="window.location.reload()" style="margin-top: 16px; background: #d97706; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Actualiser la cabine</button>
        </div>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
