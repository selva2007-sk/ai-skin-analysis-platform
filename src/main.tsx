import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import RootApp from './RootApp.tsx';
import { AppErrorBoundary } from './app/AppErrorBoundary.tsx';
import { AppSettingsProvider } from './app/settings.tsx';
import './index.css';

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppSettingsProvider>
        <Router>
          <RootApp />
        </Router>
      </AppSettingsProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
