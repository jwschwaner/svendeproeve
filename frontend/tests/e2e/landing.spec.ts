import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display landing page when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sortr" })).toBeVisible();
    await expect(
      page.getByText("Smart email management powered by AI"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Started" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("should navigate to register from Get Started button", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get Started" }).click();

    await expect(page).toHaveURL("/register");
  });

  test("should navigate to login from Login button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/login");
  });
});
