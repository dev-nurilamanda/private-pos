import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Immediate & robust Service Worker registration for PWA installability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('PWA Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('PWA Service Worker registration failed:', error);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerServiceWorker();
  } else {
    window.addEventListener('DOMContentLoaded', registerServiceWorker);
    window.addEventListener('load', registerServiceWorker);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
