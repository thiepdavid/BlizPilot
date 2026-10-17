import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thiepdavidthiep.blizpilot',
  appName: 'BlizPilot',
  webDir: 'frontend/dist',
  server: {
    // Use a secure local origin so Android WebView treats the app as a secure context.
    androidScheme: 'https',
  },
};

export default config;
