import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { BrandingProvider } from './context/BrandingContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </ErrorBoundary>
  </StrictMode>,
);

