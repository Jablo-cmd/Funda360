import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element with id "root" was not found.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`); });
}
