import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Only disposable TEST_DATABASE_URL enables saved-workspace browser tests.
// Keep one schema across the config process, web server and browser workers.
if (process.env.TEST_DATABASE_URL) {
  process.env.NEXUS_E2E_SCHEMA ??= `nexus_browser_${randomUUID().replaceAll("-", "")}`;
  const database = new URL(process.env.TEST_DATABASE_URL);
  database.searchParams.set("options", `-c search_path=${process.env.NEXUS_E2E_SCHEMA}`);
  process.env.DATABASE_URL = database.toString();
}
process.env.NEXUS_APP_ORIGIN = "http://localhost:3180";

export default defineConfig({
  ...(process.env.TEST_DATABASE_URL ? { globalSetup: "./web/e2e/database-setup.ts" } : {}),
  testDir: "./web/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:3180", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run web:build && npm run web:start -- -p 3180",
    url: "http://localhost:3180",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
