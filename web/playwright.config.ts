import { defineConfig } from '@playwright/test';

const PORT = 4173;
// Build with dummy Google identifiers so the Drive flow can be exercised
// against mocked Google endpoints.
const env = 'VITE_GOOGLE_CLIENT_ID=e2e-client VITE_GOOGLE_API_KEY=e2e-key VITE_GOOGLE_APP_ID=123456';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'de-DE',
    acceptDownloads: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: `${env} npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
