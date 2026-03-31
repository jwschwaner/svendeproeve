import { test, expect } from "@playwright/test";
import { generateTestUser } from "../helpers/auth";

test.describe("Route Guards", () => {
  const testUser = generateTestUser("guards");
  let authenticatedEmail: string;

  test.beforeEach(async ({ page }) => {
    authenticatedEmail = `guard-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByPlaceholder("you@example.com").fill(authenticatedEmail);
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

    await page.getByPlaceholder("My Company").fill(testUser.orgName!);
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should redirect authenticated user from landing to dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should redirect authenticated user from login to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should redirect authenticated user from register to dashboard", async ({
    page,
  }) => {
    await page.goto("/register");
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should redirect to onboarding if no organization exists", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    });

    const newEmail = `no-org-${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByPlaceholder("you@example.com").fill(newEmail);
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

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login", { timeout: 10000 });
  });

  test("should redirect from onboarding to dashboard if organization exists", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });
});
