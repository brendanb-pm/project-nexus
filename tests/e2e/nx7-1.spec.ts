import { expect, test } from "@playwright/test";

test("authenticates a Guard through the request boundary and revokes local session on logout", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(
    page.getByRole("navigation", { name: "Guard navigation" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out of local demo" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "nexus_dev_session" && cookie.value,
    ),
  ).toBe(false);
});

test("does not expose the local identity endpoint to a cross-origin request", async ({
  request,
}) => {
  const response = await request.post("/api/dev-auth/guard-a", {
    headers: { Origin: "https://attacker.example" },
  });
  expect(response.status()).toBe(404);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
