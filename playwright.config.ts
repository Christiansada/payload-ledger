import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: process.platform === 'win32' ? 'msedge' : 'chromium',
  },
  webServer: {
    command: 'npm run preview -- --port 4175',
    port: 4175,
    reuseExistingServer: !process.env.CI,
  },
});
