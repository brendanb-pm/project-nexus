import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.NEXUS_PROTOTYPE_URL ?? "http://127.0.0.1:3100";
const outputRoot = join(
  process.cwd(),
  "artifacts",
  "prototype",
  "nx8-unified-shift-report",
);

const captures = [
  ["mobile", "01-active-shift", "active-shift", 390, 844],
  ["mobile", "02-add-activity", "add-activity", 390, 844],
  ["mobile", "03-timeline-incident", "timeline-incident", 390, 844],
  ["mobile", "04-closeout-passdown", "closeout-passdown", 390, 844],
  ["mobile", "05-closeout-review", "closeout-review", 390, 844],
  ["mobile", "06-incoming-passdown", "incoming-passdown", 390, 844],
  ["mobile", "07-incident-form", "incident-form", 390, 844],
  ["mobile", "08-participant-management", "participant-management", 390, 844],
  ["mobile", "09-draft-restored", "draft-restored", 390, 844],
  ["mobile", "10-network-failure", "network-failure", 390, 844],
  ["mobile", "11-correction-requested", "correction-requested", 390, 844],
  ["mobile", "12-corrected-revision", "corrected-revision", 390, 844],
  ["desktop", "13-exception-queue", "exception-queue", 1440, 900],
  ["desktop", "14-review-dossier", "review-dossier", 1440, 900],
  ["desktop", "15-correction-request", "desktop-correction", 1440, 900],
  ["desktop", "16-revision-comparison", "revision-comparison", 1440, 900],
  ["desktop", "17-missing-late", "missing-late", 1440, 900],
  ["desktop", "18-empty-resolved", "empty-resolved", 1440, 900],
  ["tablet", "19-review-queue", "tablet-queue", 768, 1024],
  ["tablet", "20-shift-report-dossier", "tablet-dossier", 768, 1024],
  ["tablet", "21-correction-request", "tablet-correction", 768, 1024],
  ["tablet", "22-revision-comparison", "tablet-revisions", 768, 1024],
  ["responsive", "23-stacked-to-split", "responsive-split", 1024, 768],
  ["states", "24-state-gallery", "state-gallery", 1440, 900],
] as const;

const browser = await chromium.launch({ headless: true });
try {
  for (const [group, fileName, route, width, height] of captures) {
    const directory = join(outputRoot, group);
    await mkdir(directory, { recursive: true });
    const page = await browser.newPage({
      viewport: { width, height },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    await page.goto(`${baseUrl}/prototype/unified-shift-report/${route}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await page.locator("h1").first().waitFor();
    await page.locator("nextjs-portal").evaluateAll((portals) => {
      portals.forEach((portal) => portal.remove());
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(directory, `${fileName}.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: join(directory, `${fileName}-full-page.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Captured ${captures.length} prototype renders in ${outputRoot}`);
