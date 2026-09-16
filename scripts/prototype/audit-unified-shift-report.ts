import { chromium } from "@playwright/test";

const baseUrl = process.env.NEXUS_PROTOTYPE_URL ?? "http://127.0.0.1:3100";

const screens = [
  ["active-shift", 390, 844],
  ["add-activity", 390, 844],
  ["timeline-incident", 390, 844],
  ["closeout-passdown", 390, 844],
  ["closeout-review", 390, 844],
  ["incoming-passdown", 390, 844],
  ["incident-form", 390, 844],
  ["participant-management", 390, 844],
  ["draft-restored", 390, 844],
  ["network-failure", 390, 844],
  ["correction-requested", 390, 844],
  ["corrected-revision", 390, 844],
  ["exception-queue", 1440, 900],
  ["review-dossier", 1440, 900],
  ["desktop-correction", 1440, 900],
  ["revision-comparison", 1440, 900],
  ["missing-late", 1440, 900],
  ["empty-resolved", 1440, 900],
  ["tablet-queue", 768, 1024],
  ["tablet-dossier", 768, 1024],
  ["tablet-correction", 768, 1024],
  ["tablet-revisions", 768, 1024],
  ["responsive-split", 1024, 768],
  ["state-gallery", 1440, 900],
] as const;

const browser = await chromium.launch({ headless: true });
const failures: string[] = [];

try {
  for (const [route, width, height] of screens) {
    const page = await browser.newPage({
      viewport: { width, height },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.goto(`${baseUrl}/prototype/unified-shift-report/${route}`, {
      waitUntil: "networkidle",
    });

    const audit = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, a[href], input, select, textarea",
        ),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      const unlabeled = controls.filter((element) => {
        if (element instanceof HTMLInputElement && element.type === "hidden") {
          return false;
        }
        if (
          element instanceof HTMLButtonElement ||
          element instanceof HTMLAnchorElement
        ) {
          return !(
            element.textContent?.trim() ||
            element.getAttribute("aria-label") ||
            element.getAttribute("aria-labelledby")
          );
        }
        const field = element as HTMLInputElement;
        return !(
          field.labels?.length ||
          field.getAttribute("aria-label") ||
          field.getAttribute("aria-labelledby")
        );
      });
      const headingElements = Array.from(
        document.querySelectorAll("h1, h2, h3"),
      );
      const headings = headingElements.map((heading) =>
        Number(heading.tagName.slice(1)),
      );
      const headingJump = headings.some(
        (level, index) => index > 0 && level > headings[index - 1] + 1,
      );
      const undersizedTouchTargets =
        window.innerWidth <= 390
          ? controls.filter((element) => {
              const target =
                element instanceof HTMLInputElement &&
                ["checkbox", "radio"].includes(element.type) &&
                element.closest("label")
                  ? element.closest("label")!
                  : element;
              const { width, height } = target.getBoundingClientRect();
              return width > 0 && height > 0 && (width < 44 || height < 44);
            })
          : [];

      return {
        horizontalOverflow:
          Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth,
          ) > window.innerWidth,
        unlabeled: unlabeled.length,
        headingJump: headingJump
          ? headingElements
              .map(
                (heading) =>
                  `${heading.tagName}:${heading.textContent?.trim() ?? ""}`,
              )
              .join(" > ")
          : "",
        undersizedTouchTargets: undersizedTouchTargets.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return `${element.tagName}:${element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("name") || "unnamed"} (${Math.round(width)}x${Math.round(height)})`;
        }),
      };
    });

    const issues = [
      audit.horizontalOverflow && "horizontal overflow",
      audit.unlabeled > 0 && `${audit.unlabeled} unlabeled controls`,
      audit.headingJump && `heading-level jump [${audit.headingJump}]`,
      audit.undersizedTouchTargets.length > 0 &&
        `touch targets below 44px [${audit.undersizedTouchTargets.join(", ")}]`,
      runtimeErrors.length > 0 && `${runtimeErrors.length} runtime errors`,
    ].filter(Boolean);

    if (issues.length > 0) failures.push(`${route}: ${issues.join(", ")}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  throw new Error(`Prototype audit failed:\n${failures.join("\n")}`);
}

console.log(`Audited ${screens.length} prototype screens with no violations.`);
