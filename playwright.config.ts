import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (!process.env.DATABASE_URL && existsSync(".env.local"))
  process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname localhost",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "desktop-chrome",
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-390x844",
      dependencies: ["desktop-chrome"],
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
