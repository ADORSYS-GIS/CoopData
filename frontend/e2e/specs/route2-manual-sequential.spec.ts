import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import { approveAsApex, approveAsFederation, approveAsMinistry } from "../fixtures/helpers/approval";

/**
 * Route 2: Manual Entry Method - Sequential Flow Tests
 *
 * Tests the full workflow in sequential order:
 * 1. Cooperative creates submission and selects Manual Entry
 * 2. Cooperative clicks "Enter Data Manually", uses "Populate Test Data", and submits Financial
 * 3. Cooperative goes to Non-Financial, clicks "Enter Data Manually", uses "Populate Test Data", and submits
 * 4. Cooperative reviews and submits to FSFASA
 * 5. Apex approves
 * 6. Federation approves
 * 7. Ministry gives final approval
 */

test.describe.serial("Route 2: Manual Entry Method - Sequential Flow", () => {
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
    const newSubBtn = page.locator('button:has-text("New Submission"), button:has-text("Create Submission")').first();
    await newSubBtn.click();

    // Select "Yearly (Annual)" frequency
    await page.click('button:has-text("Yearly (Annual)")');

    // Select "2024" period 
    await page.click('button:has-text("2024")');

    // Click Create Submission / Continue
    const createBtn = page.locator('button:has-text("Create Submission"), button:has-text("Continue")').first();
    await createBtn.click();

    // Wait for submission detail page to load
    await page.waitForURL(/\/app\/submissions\/[a-f0-9-]+/, { timeout: 60000 });
    
    // Get submission ID from URL
    submissionId = page.url().split('/').pop()!;
    console.log(`Created submission: ${submissionId}`);
    
    console.log("✓ STEP 1 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Fill Financial Data via Populate Test Data
  // ═══════════════════════════════════════════════════════════════
  test("Step 2: Fill Financial Data via Populate Test Data", async ({ page }) => {
    test.setTimeout(120000);
    console.log("=== STEP 2: Fill Financial Data ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Select submission method if modal appears
    const useManualBtn = page.locator('button:has-text("Use Manual Entry")');
    if (await useManualBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("Selecting 'Use Manual Entry' method...");
      await useManualBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Click "Enter Data Manually" in the Financial Statement section
    console.log("Clicking 'Enter Data Manually' button...");
    await page.locator('button:has-text("Enter Data Manually")').first().click();
    await page.waitForTimeout(2000);

    // Use "Populate Test Data" to auto-fill the grid
    console.log("Clicking 'Populate Test Data' button...");
    const populateBtn = page.locator('button:has-text("Populate Test Data")');
    if (await populateBtn.isVisible().catch(() => false)) {
      await populateBtn.click();
      console.log("Test data populated.");
      await page.waitForTimeout(2000);
    } else {
      console.log("WARNING: Populate Test Data button not found, you might need to adjust the locator.");
    }

    // Proceed to Next / Review
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Review")').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }

    // Submit Financial Statement & Finish (From the review screen)
    const submitFinBtn = page.locator('button:has-text("Submit Financial Statement & Finish")');
    if (await submitFinBtn.isVisible().catch(() => false)) {
      await submitFinBtn.click();
      console.log("Financial Statement submitted and finished.");
    }
    
    await page.waitForTimeout(3000);
    await page.waitForLoadState("domcontentloaded");

    // Mark the financial section as ready on the submission details page
    console.log("Marking section as ready...");
    const markReadyBtn = page.locator('button:has-text("Mark Section Ready")').first();
    if (await markReadyBtn.isVisible().catch(() => false)) {
      await markReadyBtn.click();
      await page.waitForTimeout(2000);
    }
    
    console.log("✓ STEP 2 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Fill Non-Financial Data via Populate Test Data
  // ═══════════════════════════════════════════════════════════════
  test("Step 3: Fill Non-Financial Data via Populate Test Data", async ({ page }) => {
    test.setTimeout(120000);
    console.log("=== STEP 3: Fill Non-Financial Data ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    
    // Switch to Non-Financial Information tab if it exists, otherwise just proceed
    const nonFinTab = page.locator('button[role="tab"]:has-text("Non-Financial Information"), button[role="tab"]:has-text("Non-Financial")').first();
    if (await nonFinTab.isVisible().catch(() => false)) {
      await nonFinTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Click "Enter Member Data Manually" (or similar for non-financial)
    console.log("Clicking 'Enter Data Manually' button for Non-Financial...");
    const enterManualBtn = page.locator('button:has-text("Enter Data Manually"), button:has-text("Enter Member Data Manually")').first();
    if (await enterManualBtn.isVisible().catch(() => false)) {
      await enterManualBtn.click();
      await page.waitForTimeout(3000);
    }

    // Use "Populate Test Databases" to auto-fill the grid
    console.log("Clicking 'Populate Test Databases' button...");
    const populateBtn = page.locator('button:has-text("Populate Test Databases"), button:has-text("Populate Test Data")').first();
    if (await populateBtn.isVisible().catch(() => false)) {
      await populateBtn.click();
      console.log("Test data populated.");
      await page.waitForTimeout(2000);
    }

    // Proceed to Next / Review
    console.log("Clicking 'Review' tab...");
    const reviewTab = page.getByText("Review", { exact: true }).last();
    await reviewTab.waitFor({ state: "visible", timeout: 5000 });
    await reviewTab.click();
    await page.waitForTimeout(2000);
    
    // Submit Non-Financial Statement & Finish
    console.log("Submitting Non-Financial Databases...");
    const submitNfBtn = page.locator('button:has-text("Submit Non-Financial Databases & Finish")');
    await submitNfBtn.waitFor({ state: "visible", timeout: 10000 });
    await submitNfBtn.click();
    console.log("Non-Financial data submitted and finished.");
    
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
    const submitBtn = page.locator('button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex"), button:has-text("Submit")').first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      if (isEnabled) {
        await submitBtn.click({ force: true });
        console.log("Clicked Submit button");
        await page.waitForTimeout(2000);

        const confirmSubmit = page.locator('button:has-text("Submit"), button:has-text("Confirm")').first();
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
    await approveAsApex(page, submissionId, "Data verified manually");
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
