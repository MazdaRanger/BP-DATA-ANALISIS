import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e: any) {
  document.getElementById('root')!.innerHTML = `<div style="color:red; background:black; padding:20px;"><pre>${e.stack || e.message}</pre></div>`;
}
