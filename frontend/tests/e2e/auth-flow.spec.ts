import { test, expect } from "@playwright/test";

const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: "testpassword123",
  orgName: `Test Org ${Date.now()}`,
};

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display landing page when not authenticated", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Sortr" })).toBeVisible();
    await expect(
      page.getByText("Smart email management powered by AI"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Started" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("should complete full signup flow", async ({ page }) => {
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

    await page.getByPlaceholder("My Company").fill(testUser.orgName);
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    await expect(page.getByText("Goodmorning, John Doe!")).toBeVisible();
    await expect(page.getByText("Weekly Statistics")).toBeVisible();
  });

  test("should show validation errors on signup", async ({ page }) => {
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

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    const signupEmail = `login-test-${Date.now()}@example.com`;

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

    await page.getByPlaceholder("My Company").fill(testUser.orgName);
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    await page.evaluate(() => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    });

    await page.goto("/");
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/login");

    const signupEmail = await page.evaluate(() => {
      const storedUser = localStorage.getItem("auth_user");
      return storedUser ? JSON.parse(storedUser).email : null;
    });

    await page
      .getByPlaceholder("you@example.com")
      .fill(signupEmail || testUser.email);
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

test.describe("Route Guards", () => {
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

    await page.getByPlaceholder("My Company").fill(testUser.orgName);
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

test.describe("Onboarding Flow", () => {
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
    await page.getByPlaceholder("My Company").fill(testUser.orgName);
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
