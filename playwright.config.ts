import { defineConfig, devices } from "@playwright/test";
import fs from "fs";

const PORT = 3955;
const baseURL = `http://127.0.0.1:${PORT}`;

// Prefer a pre-installed Chromium when present (e.g. CI images that ship one),
// otherwise fall back to Playwright's own managed browser.
const chromeCandidate =
  process.env.PMS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = fs.existsSync(chromeCandidate) ? chromeCandidate : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use a pre-installed Chromium when available, else Playwright's own.
        launchOptions: { executablePath },
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
