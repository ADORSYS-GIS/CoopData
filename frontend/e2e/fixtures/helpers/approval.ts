import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { loginAs } from "./login";

/**
 * Clears all browser storage to ensure clean session between user logins
 */
async function clearBrowserStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore errors
    }
  });
}

/**
 * Logs in as Apex, finds submission, approves it
 *
 * Flow:
 * 1. Login as Apex
 * 2. Navigate to /app/submissions (shows cooperative grid)
 * 3. Click on the cooperative card (e.g., "saccocoop")
 * 4. Click on the specific submission row
 * 5. Click "Approve" button
 * 6. Fill comments (optional)
 * 7. Click "Confirm Approval"
 * 8. Logout
 */
export async function approveAsApex(
  page: Page,
  submissionId: string,
  comment = "Data verified and accurate",
) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);

  await loginAs(page, "apex");

  // Step 1: Navigate to submissions page (shows cooperative grid)
  console.log("[E2E] Apex: Navigating to submissions page...");
  await page.goto("/app/submissions");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Step 2: Try direct URL first (might work if Apex has access)
  console.log(`[E2E] Apex: Trying direct URL: /app/submissions/${submissionId}`);
  await page.goto(`/app/submissions/${submissionId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Check if we're on the submission detail page
  const approveBtn = page.locator('button:has-text("Approve")');
  const isOnDetailPage = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isOnDetailPage) {
    console.log("[E2E] Apex: Direct URL failed, navigating via cooperative grid...");

    // Step 3: Go back to submissions page (cooperative grid)
    await page.goto("/app/submissions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Step 4: Click on the first cooperative card
    // The cooperative cards are buttons with the cooperative name
    const coopCards = page.locator("button:has(p.text-sm.font-bold)");
    const cardCount = await coopCards.count().catch(() => 0);
    console.log(`[E2E] Apex: Found ${cardCount} cooperative card(s)`);

    if (cardCount > 0) {
      // Click the first cooperative card
      await coopCards.first().click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Apex: Clicked first cooperative card");
    } else {
      throw new Error("No cooperative cards found on submissions page");
    }

    // Step 5: Click on the specific submission row
    // The submission rows are in a table - click the row containing the submission ID
    const submissionRow = page
      .locator(`tr:has-text("${submissionId}"), tr:has(a[href*="${submissionId}"])`)
      .first();
    const rowVisible = await submissionRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (rowVisible) {
      await submissionRow.click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Apex: Clicked submission row");
    } else {
      throw new Error(`Submission row not found in table for ID: ${submissionId}`);
    }
  }

  // Step 6: Wait for Approve button to be visible
  console.log("[E2E] Apex: Waiting for Approve button...");
  await approveBtn.waitFor({ state: "visible", timeout: 30000 });

  // Step 7: Click Approve button
  await approveBtn.click({ force: true });
  await page.waitForTimeout(2000);
  console.log("[E2E] Apex: Clicked Approve button");

  // Step 8: Fill comments (optional)
  const commentsArea = page
    .locator('textarea[name="comments"], textarea[placeholder*="comment" i], textarea')
    .first();
  if (await commentsArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await commentsArea.fill(comment);
    console.log("[E2E] Apex: Filled comments");
  }

  // Step 9: Click Confirm Approval
  const confirmBtn = page
    .locator('button:has-text("Confirm Approval"), button:has-text("Confirm")')
    .first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click({ force: true });
    console.log("[E2E] Apex: Clicked Confirm Approval");
  }

  // Step 10: Wait for approval to complete
  await page.waitForTimeout(3000);

  // Step 11: Logout (or clear storage if logout button not found)
  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutBtn.click({ force: true });
    console.log("[E2E] Apex: Clicked logout button");
  } else {
    console.log("[E2E] Apex: Logout button not found, clearing storage instead");
    await clearBrowserStorage(page);
  }
}

/**
 * Logs in as Federation, finds submission, approves it
 *
 * Flow:
 * 1. Login as Federation
 * 2. Navigate to /app/submissions (shows cooperative grid)
 * 3. Click on the cooperative card
 * 4. Click on the specific submission row
 * 5. Click "Approve" button
 * 6. Click "Confirm Approval"
 * 7. Logout (or clear storage)
 */
export async function approveAsFederation(page: Page, submissionId: string) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);

  await loginAs(page, "federation");

  // Step 1: Navigate to submissions page (shows cooperative grid)
  console.log("[E2E] Federation: Navigating to submissions page...");
  await page.goto("/app/submissions");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Step 2: Try direct URL first
  console.log(`[E2E] Federation: Trying direct URL: /app/submissions/${submissionId}`);
  await page.goto(`/app/submissions/${submissionId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Check if we're on the submission detail page
  const approveBtn = page.locator('button:has-text("Approve")');
  const isOnDetailPage = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isOnDetailPage) {
    console.log("[E2E] Federation: Direct URL failed, navigating via cooperative grid...");

    // Step 3: Go back to submissions page (cooperative grid)
    await page.goto("/app/submissions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Step 4: Click on the first cooperative card
    const coopCards = page.locator("button:has(p.text-sm.font-bold)");
    const cardCount = await coopCards.count().catch(() => 0);
    console.log(`[E2E] Federation: Found ${cardCount} cooperative card(s)`);

    if (cardCount > 0) {
      await coopCards.first().click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Federation: Clicked first cooperative card");
    } else {
      throw new Error("No cooperative cards found on submissions page");
    }

    // Step 5: Click on the specific submission row
    const submissionRow = page
      .locator(`tr:has-text("${submissionId}"), tr:has(a[href*="${submissionId}"])`)
      .first();
    const rowVisible = await submissionRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (rowVisible) {
      await submissionRow.click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Federation: Clicked submission row");
    } else {
      throw new Error(`Submission row not found in table for ID: ${submissionId}`);
    }
  }

  // Step 6: Wait for Approve button to be visible
  console.log("[E2E] Federation: Waiting for Approve button...");
  await approveBtn.waitFor({ state: "visible", timeout: 30000 });

  // Step 7: Click Approve button
  await approveBtn.click({ force: true });
  await page.waitForTimeout(2000);
  console.log("[E2E] Federation: Clicked Approve button");

  // Step 8: Click Confirm Approval
  const confirmBtn = page
    .locator('button:has-text("Confirm Approval"), button:has-text("Confirm")')
    .first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click({ force: true });
    console.log("[E2E] Federation: Clicked Confirm Approval");
  }

  // Step 9: Wait for approval to complete
  await page.waitForTimeout(3000);

  // Step 10: Logout (or clear storage if logout button not found)
  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutBtn.click({ force: true });
    console.log("[E2E] Federation: Clicked logout button");
  } else {
    console.log("[E2E] Federation: Logout button not found, clearing storage instead");
    await clearBrowserStorage(page);
  }
}

/**
 * Logs in as Ministry, finds submission, gives final approval
 *
 * Flow:
 * 1. Login as Ministry
 * 2. Navigate to /app/submissions (shows cooperative grid)
 * 3. Click on the cooperative card
 * 4. Click on the specific submission row
 * 5. Click "Approve" button
 * 6. Click "Confirm Approval"
 * 7. Logout (or clear storage)
 */
export async function approveAsMinistry(page: Page, submissionId: string) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);

  await loginAs(page, "ministry");

  // Step 1: Navigate to submissions page (shows cooperative grid)
  console.log("[E2E] Ministry: Navigating to submissions page...");
  await page.goto("/app/submissions");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Step 2: Try direct URL first
  console.log(`[E2E] Ministry: Trying direct URL: /app/submissions/${submissionId}`);
  await page.goto(`/app/submissions/${submissionId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  // Check if we're on the submission detail page
  const approveBtn = page.locator('button:has-text("Approve")');
  const isOnDetailPage = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isOnDetailPage) {
    console.log("[E2E] Ministry: Direct URL failed, navigating via cooperative grid...");

    // Step 3: Go back to submissions page (cooperative grid)
    await page.goto("/app/submissions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Step 4: Click on the first cooperative card
    const coopCards = page.locator("button:has(p.text-sm.font-bold)");
    const cardCount = await coopCards.count().catch(() => 0);
    console.log(`[E2E] Ministry: Found ${cardCount} cooperative card(s)`);

    if (cardCount > 0) {
      await coopCards.first().click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Ministry: Clicked first cooperative card");
    } else {
      throw new Error("No cooperative cards found on submissions page");
    }

    // Step 5: Click on the specific submission row
    const submissionRow = page
      .locator(`tr:has-text("${submissionId}"), tr:has(a[href*="${submissionId}"])`)
      .first();
    const rowVisible = await submissionRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (rowVisible) {
      await submissionRow.click({ force: true });
      await page.waitForTimeout(3000);
      console.log("[E2E] Ministry: Clicked submission row");
    } else {
      throw new Error(`Submission row not found in table for ID: ${submissionId}`);
    }
  }

  // Step 6: Wait for Approve button to be visible
  console.log("[E2E] Ministry: Waiting for Approve button...");
  await approveBtn.waitFor({ state: "visible", timeout: 30000 });

  // Step 7: Click Approve button
  await approveBtn.click({ force: true });
  await page.waitForTimeout(2000);
  console.log("[E2E] Ministry: Clicked Approve button");

  // Step 8: Click Confirm Approval
  const confirmBtn = page
    .locator('button:has-text("Confirm Approval"), button:has-text("Confirm")')
    .first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click({ force: true });
    console.log("[E2E] Ministry: Clicked Confirm Approval");
  }

  // Step 9: Wait for approval to complete
  await page.waitForTimeout(3000);

  // Step 10: Logout (or clear storage if logout button not found)
  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutBtn.click({ force: true });
    console.log("[E2E] Ministry: Clicked logout button");
  } else {
    console.log("[E2E] Ministry: Logout button not found, clearing storage instead");
    await clearBrowserStorage(page);
  }
}

/**
 * Complete approval: Apex is the final level of approval.
 * Once the Apex approves, the submission is fully approved — Federation and
 * Ministry no longer take any action to finalize it.
 */
export async function fullApprovalChain(page: Page, submissionId: string) {
  await approveAsApex(page, submissionId, "Data verified and accurate");
}
