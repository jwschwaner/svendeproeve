import { test, expect } from "@playwright/test";
import { generateTestUser, completeOnboarding, logout } from "../helpers/auth";

test.describe("Login Flow", () => {
  let userEmail: string;
  const testUser = generateTestUser("login");

  test.beforeEach(async ({ page }) => {
    const signupEmail = `login-test-${Date.now()}@example.com`;
    userEmail = signupEmail;

    await page.goto("/register");
    await page.getByPlaceholder("you@example.com").fill(signupEmail);
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

    await logout(page);
    await page.goto("/");
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/login");

    await page.getByPlaceholder("you@example.com").fill(userEmail);
    await page.getByPlaceholder("••••••••••••••••").fill(testUser.password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    await expect(page.getByText("Weekly Statistics")).toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("you@example.com").fill("wrong@example.com");
    await page.getByPlaceholder("••••••••••••••••").fill("wrongpassword");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
  });

  test("should show validation error when fields are empty", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("All fields are required")).toBeVisible();
  });
});
