import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/parity",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3002/island/",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
