import { test, expect } from "@playwright/test";
import { generateTestUser } from "../helpers/auth";
import { getInviteToken } from "../helpers/db";

const API_URL = process.env.API_URL || "http://localhost:8001";

async function setupInvite(
  request: any,
  prefix: string,
): Promise<{
  owner: ReturnType<typeof generateTestUser>;
  member: ReturnType<typeof generateTestUser>;
  ownerToken: string;
  memberToken: string;
  orgId: string;
  inviteToken: string;
}> {
  const owner = generateTestUser(`${prefix}-owner`);
  const member = generateTestUser(`${prefix}-member`);

  const ownerRes = await request.post(`${API_URL}/auth/signup`, {
    data: { email: owner.email, password: owner.password, full_name: owner.fullName },
  });
  const { access_token: ownerToken } = await ownerRes.json();

  const orgRes = await request.post(`${API_URL}/organizations`, {
    data: { name: owner.orgName! },
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const { id: orgId } = await orgRes.json();

  const memberRes = await request.post(`${API_URL}/auth/signup`, {
    data: { email: member.email, password: member.password, full_name: member.fullName },
  });
  const { access_token: memberToken } = await memberRes.json();

  await request.post(`${API_URL}/organizations/${orgId}/members/invite`, {
    data: { email: member.email, role: "member" },
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  const inviteToken = await getInviteToken(member.email);
  if (!inviteToken) throw new Error("Invite token not found in DB");

  return { owner, member, ownerToken, memberToken, orgId, inviteToken };
}

test.describe("Invite page - unauthenticated", () => {
  test("shows org name and invited-by with login button", async ({
    page,
    request,
  }) => {
    const { owner, inviteToken } = await setupInvite(request, "inv-unauth");

    await page.goto(`/invite/${inviteToken}`);

    await expect(page.getByText(/you've been invited to/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(owner.orgName!)).toBeVisible();
    await expect(page.getByText(`Invited by ${owner.email}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /log in to respond/i })).toBeVisible();
    await expect(page.getByTestId("invite-accept-button")).not.toBeVisible();
    await expect(page.getByTestId("invite-decline-button")).not.toBeVisible();
  });

  test("login button links to /login with redirect param", async ({
    page,
    request,
  }) => {
    const { inviteToken } = await setupInvite(request, "inv-login-link");

    await page.goto(`/invite/${inviteToken}`);

    const btn = page.getByRole("link", { name: /log in to respond/i });
    await expect(btn).toHaveAttribute(
      "href",
      `/login?redirect=/invite/${inviteToken}`,
    );
  });

  test("shows error for unknown token", async ({ page }) => {
    await page.goto("/invite/this-token-does-not-exist");

    const alert = page.locator(".MuiAlert-root");
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/invite not found/i);
  });

  test("shows already-responded message after invite is accepted", async ({
    page,
    request,
  }) => {
    const { memberToken, inviteToken } = await setupInvite(request, "inv-already");

    await request.post(`${API_URL}/invites/${inviteToken}/accept`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    await page.goto(`/invite/${inviteToken}`);
    const alert = page.locator(".MuiAlert-root");
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/already been responded/i);
  });
});

test.describe("Invite page - authenticated", () => {
  test("shows accept and decline buttons when logged in", async ({
    page,
    request,
  }) => {
    const { member, inviteToken } = await setupInvite(request, "inv-auth-btns");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(member.email);
    await page.getByTestId("login-password-input").fill(member.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto(`/invite/${inviteToken}`);

    await expect(page.getByTestId("invite-accept-button")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("invite-decline-button")).toBeVisible();
  });

  test("accepting invite adds org to the user's list and redirects to onboarding", async ({
    page,
    request,
  }) => {
    const { member, owner, inviteToken } = await setupInvite(request, "inv-accept");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(member.email);
    await page.getByTestId("login-password-input").fill(member.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto(`/invite/${inviteToken}`);
    await page.getByTestId("invite-accept-button").click();

    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });
    await expect(page.getByText(owner.orgName!)).toBeVisible({ timeout: 10000 });
  });

  test("declining invite removes membership and redirects to onboarding", async ({
    page,
    request,
  }) => {
    const { member, owner, inviteToken } = await setupInvite(request, "inv-decline");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(member.email);
    await page.getByTestId("login-password-input").fill(member.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto(`/invite/${inviteToken}`);
    await page.getByTestId("invite-decline-button").click();

    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });
    await expect(page.getByText(owner.orgName!)).not.toBeVisible({ timeout: 5000 });
  });

  test("declining invite shows declined snackbar", async ({
    page,
    request,
  }) => {
    const { member, inviteToken } = await setupInvite(request, "inv-decline-snack");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(member.email);
    await page.getByTestId("login-password-input").fill(member.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto(`/invite/${inviteToken}`);
    await page.getByTestId("invite-decline-button").click();

    const snackbar = page.locator(".MuiSnackbar-root");
    await expect(snackbar).toBeVisible({ timeout: 10000 });
    await expect(snackbar.locator(".MuiAlert-message")).toContainText(/declined/i);
  });
});

test.describe("Login redirect from invite link", () => {
  test("after login, user is redirected back to the invite page", async ({
    page,
    request,
  }) => {
    const { member, inviteToken } = await setupInvite(request, "inv-redirect");

    await page.goto(`/invite/${inviteToken}`);
    await page.getByRole("link", { name: /log in to respond/i }).click();

    await expect(page).toHaveURL(`/login?redirect=/invite/${inviteToken}`, {
      timeout: 5000,
    });

    await page.getByTestId("login-email-input").fill(member.email);
    await page.getByTestId("login-password-input").fill(member.password);
    await page.getByTestId("login-submit-button").click();

    await expect(page).toHaveURL(`/invite/${inviteToken}`, { timeout: 10000 });
    await expect(page.getByTestId("invite-accept-button")).toBeVisible({ timeout: 10000 });
  });
});
