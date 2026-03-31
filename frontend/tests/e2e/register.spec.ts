import { test, expect } from "@playwright/test";
import { generateTestUser } from "../helpers/auth";

test.describe("Registration Flow", () => {
  test("should complete full signup flow", async ({ page }) => {
    const testUser = generateTestUser("signup");

    await page.goto("/");
    await page.getByRole("button", { name: "Get Started" }).click();

    await expect(page).toHaveURL("/register");
    await expect(page.getByRole("heading", { name: "Sortr" })).toBeVisible();

    await page.getByPlaceholder("you@example.com").fill(testUser.email);
    await page
      .getByPlaceholder("••••••••••••••••")
      .first()
      .fill(testUser.password);
    await page
      .getByPlaceholder("••••••••••••••••")
      .last()
      .fill(testUser.password);

    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL("/onboarding", { timeout: 15000 });
    await expect(page.getByText("Welcome to Sortr")).toBeVisible();
    await expect(
      page.getByText("Let's create your first organization"),
    ).toBeVisible();

    await page.getByPlaceholder("My Company").fill(testUser.orgName!);
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    await expect(page.getByText("Goodmorning, John Doe!")).toBeVisible();
    await expect(page.getByText("Weekly Statistics")).toBeVisible();
  });

  test("should show validation errors on signup", async ({ page }) => {
    const testUser = generateTestUser("validation");

    await page.goto("/register");

    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("All fields are required")).toBeVisible();

    await page.getByPlaceholder("you@example.com").fill(testUser.email);
    await page.getByPlaceholder("••••••••••••••••").first().fill("short");
    await page.getByPlaceholder("••••••••••••••••").last().fill("short");
    await page.getByRole("button", { name: "Register" }).click();

    await expect(
      page.getByText("Password must be at least 8 characters"),
    ).toBeVisible();

    await page.getByPlaceholder("••••••••••••••••").first().fill("password123");
    await page.getByPlaceholder("••••••••••••••••").last().fill("different123");
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });
});
