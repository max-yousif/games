// Eerst: de testversie van een voorstel krijgt haar eigen opslag, vóór iets anders die leest.
import './lib/voorstel';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
