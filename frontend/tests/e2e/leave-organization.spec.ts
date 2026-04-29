import { test, expect } from "@playwright/test";
import { generateTestUser } from "../helpers/auth";
import { getInviteToken } from "../helpers/db";

const API_URL = process.env.API_URL || "http://localhost:8001";

/**
 * Creates an owner org and an invited+accepted member.
 * Returns both users' credentials and the org.
 */
async function setupMemberInOrg(
  request: any,
  prefix: string,
): Promise<{
  owner: ReturnType<typeof generateTestUser>;
  member: ReturnType<typeof generateTestUser>;
  orgId: string;
  memberToken: string;
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

  await request.post(`${API_URL}/invites/${inviteToken}/accept`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });

  return { owner, member, orgId, memberToken };
}

/** Log in as a user who has no stored org and arrive at /onboarding. */
async function loginToOnboarding(page: any, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(user.email);
  await page.getByTestId("login-password-input").fill(user.password);
  await page.getByTestId("login-submit-button").click();
  await expect(page).toHaveURL("/onboarding", { timeout: 10000 });
}

test.describe("Leave Organization - Onboarding page", () => {
  test("Leave button is visible for a non-owned org", async ({
    page,
    request,
  }) => {
    const { member, owner } = await setupMemberInOrg(request, "leave-visible");

    await loginToOnboarding(page, member);

    await expect(page.getByText(owner.orgName!)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
  });

  test("Leave button is NOT visible for an owned org", async ({
    page,
    request,
  }) => {
    const { owner, orgId } = await setupMemberInOrg(request, "leave-owner-hidden");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(owner.email);
    await page.getByTestId("login-password-input").fill(owner.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto("/onboarding?switch=true");
    await expect(page.getByTestId(`select-org-${orgId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Leave" })).toHaveCount(0);
  });

  test("clicking Leave opens a confirmation dialog with the org name", async ({
    page,
    request,
  }) => {
    const { member, owner } = await setupMemberInOrg(request, "leave-dialog");

    await loginToOnboarding(page, member);
    await page.getByRole("button", { name: "Leave" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Leave organization?");
    await expect(dialog).toContainText(owner.orgName!);
  });

  test("cancelling the dialog keeps the org in the list", async ({
    page,
    request,
  }) => {
    const { member, owner } = await setupMemberInOrg(request, "leave-cancel");

    await loginToOnboarding(page, member);
    await page.getByRole("button", { name: "Leave" }).click();

    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(owner.orgName!)).toBeVisible();
  });

  test("confirming leave removes the org from the list", async ({
    page,
    request,
  }) => {
    const { member, owner } = await setupMemberInOrg(request, "leave-confirm");

    await loginToOnboarding(page, member);
    await page.getByRole("button", { name: "Leave" }).click();
    await page.getByTestId("confirm-leave-org-button").click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(owner.orgName!)).not.toBeVisible({ timeout: 10000 });
  });

  test("confirming leave shows a success snackbar", async ({
    page,
    request,
  }) => {
    const { member, owner } = await setupMemberInOrg(request, "leave-snackbar");

    await loginToOnboarding(page, member);
    await page.getByRole("button", { name: "Leave" }).click();
    await page.getByTestId("confirm-leave-org-button").click();

    const snackbar = page.locator(".MuiSnackbar-root");
    await expect(snackbar).toBeVisible({ timeout: 10000 });
    await expect(snackbar.locator(".MuiAlert-message")).toContainText(
      `Left ${owner.orgName!}`,
    );
  });
});

test.describe("Leave Organization - Account Settings", () => {
  test("Organizations section shows owner chip for owned org", async ({
    page,
    request,
  }) => {
    const owner = generateTestUser("leave-settings-owner");

    const ownerRes = await request.post(`${API_URL}/auth/signup`, {
      data: { email: owner.email, password: owner.password, full_name: owner.fullName },
    });
    const { access_token: ownerToken } = await ownerRes.json();

    const orgRes = await request.post(`${API_URL}/organizations`, {
      data: { name: owner.orgName! },
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const { id: orgId } = await orgRes.json();

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(owner.email);
    await page.getByTestId("login-password-input").fill(owner.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL("/onboarding", { timeout: 10000 });

    await page.goto("/onboarding?switch=true");
    await expect(page.getByTestId(`select-org-${orgId}`)).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`select-org-${orgId}`).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    await page.goto("/account-settings");
    await page.getByRole("button", { name: "Organizations" }).click();

    const section = page.getByTestId("organizations-section");
    await expect(
      page.getByRole("heading", { name: "Organizations" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(section.getByText(owner.orgName!)).toBeVisible();
    await expect(
      section.locator(".MuiChip-root").filter({ hasText: "Owner" }),
    ).toBeVisible();
    await expect(section.getByRole("button", { name: "Leave" })).not.toBeVisible();
  });

  test("Organizations section shows Leave button for non-owned org", async ({
    page,
    request,
  }) => {
    const { member, owner, orgId } = await setupMemberInOrg(
      request,
      "leave-settings-member",
    );

    // Log in and select the org so we can reach account-settings
    await loginToOnboarding(page, member);
    await page.getByTestId(`select-org-${orgId}`).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    await page.goto("/account-settings");
    await page.getByRole("button", { name: "Organizations" }).click();

    const section = page.getByTestId("organizations-section");
    await expect(section.getByText(owner.orgName!)).toBeVisible({ timeout: 10000 });
    await expect(
      section.locator(".MuiChip-root").filter({ hasText: "Member" }),
    ).toBeVisible();
    await expect(section.getByRole("button", { name: "Leave" })).toBeVisible();
  });

  test("leaving from account settings removes the org and shows snackbar", async ({
    page,
    request,
  }) => {
    const { member, owner, orgId } = await setupMemberInOrg(
      request,
      "leave-settings-confirm",
    );

    await loginToOnboarding(page, member);
    await page.getByTestId(`select-org-${orgId}`).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    await page.goto("/account-settings");
    await page.getByRole("button", { name: "Organizations" }).click();

    const section = page.getByTestId("organizations-section");
    await expect(section.getByText(owner.orgName!)).toBeVisible({ timeout: 10000 });
    await section.getByRole("button", { name: "Leave" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(owner.orgName!);

    await dialog.getByRole("button", { name: "Leave" }).click();

    const snackbar = page.locator(".MuiSnackbar-root");
    await expect(snackbar).toBeVisible({ timeout: 10000 });
    await expect(snackbar.locator(".MuiAlert-message")).toContainText(
      `Left ${owner.orgName!}`,
    );
    await expect(section.getByText(owner.orgName!)).not.toBeVisible({ timeout: 10000 });
  });
});
