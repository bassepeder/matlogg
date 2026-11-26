import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initKeyboardAvoidance } from './lib/keyboard';
import { initRouter } from './lib/router';
import { applyTheme, watchSystemTheme } from './lib/theme';
import './styles.css';

applyTheme();
watchSystemTheme();
initRouter();
initKeyboardAvoidance();
registerSW({ immediate: true });

navigator.storage?.persisted?.().then((p) => !p && navigator.storage.persist?.());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
