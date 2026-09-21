import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import {
  approveAsApex,
  approveAsFederation,
  approveAsMinistry,
} from "../fixtures/helpers/approval";

/**
 * Route 3: Questionnaire Method - Sequential Flow Tests
 *
 * Tests the full workflow in sequential order:
 * 1. Cooperative creates submission (Yearly 2023)
 * 2. Financial: Click "Edit Answers", "Populate Test Data", go to "Financial Performance", "Complete Questionnaire"
 * 3. Non-Financial: Click "Edit Answers", "Populate Test Data", go to "New Section", "Complete Questionnaire"
 * 4. Cooperative reviews and submits to FSFASA / Apex
 * 5. Apex approves
 * 6. Federation approves
 * 7. Ministry gives final approval
 *
 * NOTE: These tests require a real backend + Keycloak instance.
 * They are skipped in CI (where only mock-based smoke tests run).
 * Run locally with: npm run test:e2e:route3
 */

test.describe.serial("Route 3: Questionnaire Method - Sequential Flow", () => {
  test.skip(!!process.env.CI, "Sequential tests require real backend + Keycloak - skipped in CI");

  let submissionId: string;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Create submission
  // ═══════════════════════════════════════════════════════════════
  test("Step 1: Create submission", async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    console.log("=== STEP 1: Create submission ===");

    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");

    // Click "New Submission" or "Create Submission"
    const newSubBtn = page
      .locator('button:has-text("New Submission"), button:has-text("Create Submission")')
      .first();
    await newSubBtn.click();

    // Select "Yearly (Annual)" frequency
    await page.click('button:has-text("Yearly (Annual)")');

    // Select "2023" period
    await page.click('button:has-text("2023")');

    // Click Create Submission / Continue
    const createBtn = page
      .locator('button:has-text("Create Submission"), button:has-text("Continue")')
      .first();
    await createBtn.click();

    // Wait for submission detail page to load
    await page.waitForURL(/\/app\/submissions\/[a-f0-9-]+/, { timeout: 60000 });

    // Get submission ID from URL
    submissionId = page.url().split("/").pop()!;
    console.log(`Created submission: ${submissionId}`);

    console.log("✓ STEP 1 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Fill Financial Data
  // ═══════════════════════════════════════════════════════════════
  test("Step 2: Fill Financial Data", async ({ page }) => {
    test.setTimeout(120000);
    console.log("=== STEP 2: Fill Financial Data ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Select submission method if modal appears
    const useMethodBtn = page
      .locator('button:has-text("Use Questionnaire"), button:has-text("Questionnaire")')
      .first();
    if (await useMethodBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("Selecting 'Use Questionnaire' method...");
      await useMethodBtn.click();
      await page.waitForTimeout(2000);
    }

    // Ensure we are on the Financial Statement tab
    const finTab = page.locator('button[role="tab"]:has-text("Financial Statement")').first();
    if (await finTab.isVisible().catch(() => false)) {
      await finTab.click();
      await page.waitForTimeout(1000);
    }

    // Click "Edit Answers"
    console.log("Clicking 'Edit Answers' button...");
    const editBtn = page.locator('button:has-text("Edit Answers")').first();
    await editBtn.waitFor({ state: "visible", timeout: 10000 });
    await editBtn.click();
    await page.waitForTimeout(3000);

    // Use "Populate Test Data"
    console.log("Clicking 'Populate Test Data' button...");
    const populateBtn = page.locator('button:has-text("Populate Test Data")').first();
    if (await populateBtn.isVisible().catch(() => false)) {
      await populateBtn.click();
      console.log("Test data populated.");
      await page.waitForTimeout(2000);
    }

    // Go to "Financial Performance" tab
    console.log("Clicking 'Financial Performance' tab...");
    const finPerfTab = page.getByText("Financial Performance", { exact: true }).last();
    await finPerfTab.waitFor({ state: "visible", timeout: 5000 });
    await finPerfTab.click();
    await page.waitForTimeout(2000);

    // Click "Complete Questionnaire"
    console.log("Clicking 'Complete Questionnaire'...");
    const completeBtn = page.locator('button:has-text("Complete Questionnaire")').first();
    await completeBtn.waitFor({ state: "visible", timeout: 10000 });
    await completeBtn.click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState("domcontentloaded");

    console.log("✓ STEP 2 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Fill Non-Financial Data
  // ═══════════════════════════════════════════════════════════════
  test("Step 3: Fill Non-Financial Data", async ({ page }) => {
    test.setTimeout(120000);
    console.log("=== STEP 3: Fill Non-Financial Data ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Switch to Non-Financial Information tab
    console.log("Switching to Non-Financial Information tab...");
    const nonFinTab = page
      .locator(
        'button[role="tab"]:has-text("Non-Financial Information"), button[role="tab"]:has-text("Non-Financial")',
      )
      .first();
    if (await nonFinTab.isVisible().catch(() => false)) {
      await nonFinTab.click();
      await page.waitForTimeout(2000);
    }

    // Click "Edit Answers"
    console.log("Clicking 'Edit Answers' button for Non-Financial...");
    const editBtn = page.locator('button:has-text("Edit Answers")').first();
    await editBtn.waitFor({ state: "visible", timeout: 10000 });
    await editBtn.click();
    await page.waitForTimeout(3000);

    // Use "Populate Test Data"
    console.log("Clicking 'Populate Test Data' button...");
    const populateBtn = page.locator('button:has-text("Populate Test Data")').first();
    if (await populateBtn.isVisible().catch(() => false)) {
      await populateBtn.click();
      console.log("Test data populated.");
      await page.waitForTimeout(2000);
    }

    // Go to "New Section" tab
    console.log("Clicking 'New Section' tab...");
    const newSectionTab = page.getByText("New Section", { exact: true }).last();
    if (await newSectionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newSectionTab.click();
    } else {
      const altNewSection = page.locator(':has-text("New Section")').last();
      if (await altNewSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await altNewSection.click();
      }
    }
    await page.waitForTimeout(2000);

    // Click "Complete Questionnaire"
    console.log("Clicking 'Complete Questionnaire'...");
    const completeBtn = page.locator('button:has-text("Complete Questionnaire")').first();
    await completeBtn.waitFor({ state: "visible", timeout: 10000 });
    await completeBtn.click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState("domcontentloaded");

    console.log("✓ STEP 3 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Submit for review
  // ═══════════════════════════════════════════════════════════════
  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000);
    console.log("=== STEP 4: Submit for review ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Submit submission to Apex
    const submitBtn = page
      .locator(
        'button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex"), button:has-text("Submit to Apex Officer"), button:has-text("Submit to apx")',
      )
      .first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      if (isEnabled) {
        await submitBtn.click({ force: true });
        console.log("Clicked Submit button");
        await page.waitForTimeout(2000);

        const confirmSubmit = page
          .locator('button:has-text("Submit"), button:has-text("Confirm")')
          .first();
        if (await confirmSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmSubmit.click({ force: true });
          console.log("Confirmed submission dialog");
        }
        await page.waitForTimeout(3000);
      } else {
        throw new Error("Submit button is visible but NOT enabled");
      }
    } else {
      throw new Error("Submit button not visible");
    }

    console.log("✓ STEP 4 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Apex approval
  // ═══════════════════════════════════════════════════════════════
  test("Step 5: Apex approval", async ({ page }) => {
    test.setTimeout(180000);
    console.log("=== STEP 5: Apex approval ===");
    await approveAsApex(page, submissionId, "Data verified via questionnaire");
    console.log("✓ STEP 5 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Federation approval
  // ═══════════════════════════════════════════════════════════════
  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000);
    console.log("=== STEP 6: Federation approval ===");
    await approveAsFederation(page, submissionId);
    console.log("✓ STEP 6 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Ministry final approval
  // ═══════════════════════════════════════════════════════════════
  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000);
    console.log("=== STEP 7: Ministry final approval ===");
    await approveAsMinistry(page, submissionId);
    console.log("✓ STEP 7 COMPLETED - All tests passed!");
  });
});
