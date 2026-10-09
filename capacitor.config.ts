import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bizpilot.app',
  appName: 'BizPilot',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
