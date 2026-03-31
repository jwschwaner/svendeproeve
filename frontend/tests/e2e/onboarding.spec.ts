import { test, expect } from "@playwright/test";
import { generateTestUser } from "../helpers/auth";

test.describe("Onboarding Flow", () => {
  const testUser = generateTestUser("onboarding");

  test.beforeEach(async ({ page }) => {
    const email = `onboarding-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page
      .getByPlaceholder("••••••••••••••••")
      .first()
      .fill(testUser.password);
    await page
      .getByPlaceholder("••••••••••••••••")
      .last()
      .fill(testUser.password);
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });
  });

  test("should create organization successfully", async ({ page }) => {
    await page.getByPlaceholder("My Company").fill(testUser.orgName!);
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should show validation error when organization name is too short", async ({
    page,
  }) => {
    await page.getByPlaceholder("My Company").fill("A");
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(
      page.getByText("Organization name must be at least 2 characters"),
    ).toBeVisible();
  });

  test("should show error when organization name is empty", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page.getByText("Organization name is required")).toBeVisible();
  });
});
