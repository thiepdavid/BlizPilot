import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thiepdavidthiep.blizpilot',
  appName: 'BizPilot',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
