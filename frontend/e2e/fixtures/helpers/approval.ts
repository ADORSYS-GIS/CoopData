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
 */
export async function approveAsApex(
  page: Page,
  submissionId: string,
  comment = "Data verified and accurate",
) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);
  
  await loginAs(page, "apex");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.fill('textarea[name="comments"]', comment);
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Federation Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

/**
 * Logs in as Federation, finds submission, approves it
 */
export async function approveAsFederation(page: Page, submissionId: string) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);
  
  await loginAs(page, "federation");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Ministry Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

/**
 * Logs in as Ministry, finds submission, gives final approval
 */
export async function approveAsMinistry(page: Page, submissionId: string) {
  // Clear storage before logging in as new user
  await clearBrowserStorage(page);
  
  await loginAs(page, "ministry");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: APPROVED")).toBeVisible();
  await expect(page.getByText("Final Approval Granted")).toBeVisible();
}

/**
 * Complete approval chain: Apex → Federation → Ministry
 */
export async function fullApprovalChain(page: Page, submissionId: string) {
  await approveAsApex(page, submissionId, "Data verified and accurate");
  await approveAsFederation(page, submissionId);
  await approveAsMinistry(page, submissionId);
}