import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Skin_AI_Detector.app',
  appName: 'Skin AI Detector',
  // Built web assets that Capacitor will bundle into the native app (offline).
  // Keep this in sync with Vite's `build.outDir`.
  webDir: 'dist',
  server: {
    // Use https://localhost inside the WebView so features like WebRTC/mic permissions
    // run in a secure context on Android.
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'localhost'
  }
};

export default config;
