import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import YUiOS from '../yuios-prototype';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <YUiOS />
  </StrictMode>
);
