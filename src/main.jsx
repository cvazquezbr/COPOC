import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Existing Providers
import { TemplateProvider } from './context/TemplateContext.jsx';

// New Auth Provider for Application Users
import { UserAuthContextProvider } from './context/UserAuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';

import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UserAuthContextProvider>
        <SettingsProvider>
          <TemplateProvider>
            <App />
          </TemplateProvider>
        </SettingsProvider>
      </UserAuthContextProvider>
    </BrowserRouter>
  </StrictMode>
);

