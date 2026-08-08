import { expect, test } from "@playwright/test";

test("shows the Project Nexus foundation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Project Nexus" }),
  ).toBeVisible();
});
