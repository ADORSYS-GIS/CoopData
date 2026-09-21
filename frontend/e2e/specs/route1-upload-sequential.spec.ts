import { test, expect, Page } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import {
  approveAsApex,
  approveAsFederation,
  approveAsMinistry,
} from "../fixtures/helpers/approval";

/**
 * Route 1: Upload Method - Sequential Flow Tests
 *
 * Tests the full workflow in sequential order:
 * 1. Cooperative creates submission + uploads financial statement
 * 2. Cooperative uploads non-financial data
 * 3. Cooperative marks all sections ready
 * 4. Cooperative submits for review
 * 5. Apex approves
 * 6. Federation approves
 * 7. Ministry gives final approval
 *
 * Uses describe.serial() to ensure tests run in order and stop if one fails.
 * This makes debugging easier - when a test fails, we know exactly which step failed.
 *
 * NOTE: These tests require a real backend + Keycloak instance.
 * They are skipped in CI (where only mock-based smoke tests run).
 * Run locally with: npm run test:e2e:route1
 */

test.describe.serial("Route 1: Upload Method - Sequential Flow", () => {
  test.skip(!!process.env.CI, "Sequential tests require real backend + Keycloak - skipped in CI");

  let submissionId: string;

  /**
   * Helper function to wait for button to be enabled
   */
  async function waitForButtonEnabled(page: Page, selector: string, timeout: number = 120000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const btn = page.locator(selector);
      const isVisible = await btn.isVisible().catch(() => false);
      const isEnabled = await btn.isEnabled().catch(() => false);
      if (isVisible && isEnabled) {
        return true;
      }
      await page.waitForTimeout(1000);
    }
    return false;
  }

  /**
   * Waits for AI extraction to finish by polling the backend API directly.
   */
  async function waitForExtractionToFinish(
    page: Page,
    submissionId: string,
    totalTimeout = 300000,
  ) {
    const start = Date.now();
    console.log("Waiting for AI extraction to finish (polling backend directly)...");

    const TERMINAL_STATUSES = ["succeeded", "failed", "partial"];

    while (Date.now() - start < totalTimeout) {
      const jobStatus = await page.evaluate(async (subId: string) => {
        try {
          const getToken = (): Promise<string | null> => {
            return new Promise((resolve) => {
              const req = indexedDB.open("keyval-store");
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction("keyval", "readonly");
                const store = tx.objectStore("keyval");
                const getReq = store.get("coopdata_tokens");
                getReq.onsuccess = () => resolve(getReq.result?.token ?? null);
                getReq.onerror = () => resolve(null);
              };
              req.onerror = () => resolve(null);
            });
          };

          const token = await getToken();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const subRes = await fetch(`/api/v1/cooperative/submissions/${subId}`, { headers });
          if (!subRes.ok) return null;
          const sub = await subRes.json();
          const jobId = sub?.extraction_job_id;
          if (!jobId) return "no_job";

          const jobRes = await fetch(`/api/v1/cooperative/extraction-jobs/${jobId}`, { headers });
          if (!jobRes.ok) return null;
          const job = await jobRes.json();
          return job?.status ?? null;
        } catch {
          return null;
        }
      }, submissionId);

      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`Extraction status (${elapsed}s): ${jobStatus}`);

      if (jobStatus === "no_job") {
        console.log("No extraction job found — proceeding");
        return true;
      }

      if (jobStatus && TERMINAL_STATUSES.includes(jobStatus)) {
        console.log(`Extraction finished with status: ${jobStatus}`);
        await page.goto(`/app/submissions/${submissionId}`);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3000);
        return true;
      }

      if (elapsed > 0 && elapsed % 20 < 5) {
        console.log("Reloading page to un-freeze React Query polling...");
        await page.goto(`/app/submissions/${submissionId}`);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);
      } else {
        await page.waitForTimeout(5000);
      }
    }

    console.log("Timeout waiting for extraction to complete");
    await page.screenshot({ path: `./test-results/extraction-timeout-${Date.now()}.png` });
    return false;
  }

  /**
   * Helper function to mark all non-financial sections ready
   */
  async function markAllNonFinancialSectionsReady(page: Page) {
    console.log("Checking for Non-Financial 'Mark Ready' buttons...");
    let attempts = 0;
    const maxAttempts = 60; // Reduced from 120 to 60 seconds

    while (attempts < maxAttempts) {
      const markReadyBtns = page.locator('button:has-text("Mark Ready")');
      const count = await markReadyBtns.count().catch(() => 0);

      if (count > 0) {
        console.log(`Found ${count} 'Mark Ready' button(s). Clicking the first one...`);
        const btn = markReadyBtns.first();
        if (await btn.isEnabled({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log("Clicked Mark Ready button");
          await page.waitForTimeout(1500); // Reduced from 3000 to 1500
          attempts = 0;
        } else {
          console.log("Button found but not enabled, waiting...");
          attempts++;
          await page.waitForTimeout(1000);
        }
      } else {
        const hasData = await page
          .locator(
            'button:has-text("Clear Databases"), button:has-text("Effacer"), :text("Upload Results"), :text("Résultats d\'importation")',
          )
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (hasData) {
          console.log("All non-financial sections are marked ready!");
          return;
        }

        attempts++;
        await page.waitForTimeout(1000);

        if (attempts % 10 === 0) {
          // Changed from 15 to 10
          console.log(
            `Waiting for tables to appear or buttons to become visible (${attempts}s)...`,
          );
          if (attempts === 20) {
            // Only reload once at 20s instead of 30 and 60
            console.log("Reloading page to un-freeze React Query...");
            await page.goto(`/app/submissions/${submissionId}`);
            await page.waitForLoadState("domcontentloaded");
            await page.waitForTimeout(2000); // Reduced from 3000
            console.log("Re-switching to Non-Financial tab after reload...");
            await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
            await page.waitForTimeout(1500); // Reduced from 2000
          }
        }
      }
    }

    console.log("WARNING: Timeout waiting for Non-Financial sections to be marked ready.");
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Create submission + Upload financial statement
  // ═══════════════════════════════════════════════════════════════
  test("Step 1: Create submission and upload financial statement", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes
    console.log("=== STEP 1: Create submission and upload financial statement ===");

    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");

    // Click "New Submission" button
    await page.click('button:has-text("New Submission")');

    // Select "Yearly (Annual)" frequency
    await page.click('button:has-text("Yearly (Annual)")');

    // Select "2025" period
    await page.click('button:has-text("2025")');

    // Click Create Submission
    await page.click('button:has-text("Create Submission")');

    // Wait for submission detail page to load
    await page.waitForURL(/\/app\/submissions\/[a-f0-9-]+/, { timeout: 60000 });

    // Verify we're on the submission detail page
    await expect(page.getByText("Submission Detail")).toBeVisible();

    // Get submission ID from URL and store it for next tests
    submissionId = page.url().split("/").pop()!;
    console.log(`Created submission: ${submissionId}`);

    // Check for Upload Method Dialog
    await page.waitForTimeout(2000);
    const uploadMethodBtn = page.locator(
      'button:has-text("Upload Method"), button:has-text("Upload Documents")',
    );
    if (await uploadMethodBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadMethodBtn.click();
      console.log("Selected Upload Method from dialog");
      await page.waitForTimeout(2000);
    }

    // Upload Financial Statement
    console.log("Uploading financial statement...");
    const uploadFileBtn = page.locator('button:has-text("Upload File →")');
    const readyBtn = page.locator('button:has-text("Ready")').first();
    const reviewBtn = page.locator('button:has-text("Review & Mark Ready →")');

    if (await uploadFileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Status is Pending - uploading file...");
      await uploadFileBtn.click({ force: true });
      await page.waitForTimeout(3000);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles("./e2e/fixtures/test-data/financial/yearly-financial.png");
      console.log("Financial statement file selected");
      await page.waitForTimeout(3000);

      const uploadExtractBtn = page.locator('button:has-text("Upload & Extract")');
      if (await uploadExtractBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadExtractBtn.click({ force: true });
        console.log("Clicked Upload & Extract — waiting for AI extraction...");
        await page.waitForTimeout(5000);

        const extractionDone = await waitForExtractionToFinish(page, submissionId);

        if (extractionDone) {
          const isEnabled = await waitForButtonEnabled(
            page,
            'button:has-text("Mark Section Ready")',
          );
          if (isEnabled) {
            console.log("Mark Section Ready enabled - clicking...");
            await page.locator('button:has-text("Mark Section Ready")').click({ force: true });
            console.log("Marked Financial Statement as Ready");
          }
        }
      }
    } else if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Status is In Progress - clicking Ready button");
      await readyBtn.click({ force: true });
      console.log("Marked Financial Statement as Ready");
    } else if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Clicking Review & Mark Ready button");
      await reviewBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForExtractionToFinish(page, submissionId);

      const markReadyBtn = page.locator('button:has-text("Mark Section Ready")');
      if (await markReadyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const isEnabled = await waitForButtonEnabled(page, 'button:has-text("Mark Section Ready")');
        if (isEnabled) {
          await markReadyBtn.click({ force: true });
          console.log("Marked Financial Statement as Ready");
        }
      }
    }

    console.log("✓ STEP 1 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Upload non-financial data
  // ═══════════════════════════════════════════════════════════════
  test("Step 2: Upload non-financial data", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes
    console.log("=== STEP 2: Upload non-financial data ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Switch to Non-Financial tab
    console.log("Switching to Non-Financial Information tab...");
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    await page.waitForTimeout(2000);

    // Check if data is already uploaded
    const hasData = await page
      .locator(
        'button:has-text("Clear Databases"), button:has-text("Effacer"), :text("Upload Results"), :text("Résultats d\'importation")',
      )
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasData) {
      console.log("No Non-Financial data found - uploading full workbook...");

      // Select "All sections (single workbook)" card
      await page.locator('div:has-text("All sections (single workbook)")').last().click();
      await page.waitForTimeout(1000);

      // Upload the full workbook
      const nfFileInput = page.locator('input[type="file"]').last();
      await nfFileInput.setInputFiles(
        "./e2e/fixtures/test-data/non-financial/coopdatafullworkbook.xlsx",
      );
      console.log("Full workbook selected");
      await page.waitForTimeout(2000);

      // Click "Upload & Parse"
      const allParseBtn = page.locator('button:has-text("Upload & Parse")');
      await allParseBtn.click();
      console.log("Clicked Upload & Parse — waiting for parsing to complete...");

      // Wait for parsing to complete (can take 30-60s if AI mapping is invoked)
      await expect(
        page
          .locator(
            'button:has-text("Clear Databases"), button:has-text("Effacer"), :text("Upload Results"), :text("Résultats d\'importation")',
          )
          .first(),
      ).toBeVisible({ timeout: 120000 });
      console.log("Parsing completed and data is ready!");
    } else {
      console.log("Non-Financial data already exists! Skipping upload step.");
    }

    console.log("✓ STEP 2 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Mark all sections ready
  // ═══════════════════════════════════════════════════════════════
  test("Step 3: Mark all sections ready", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes
    console.log("=== STEP 3: Mark all sections ready ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Switch to Non-Financial tab
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    await page.waitForTimeout(2000);

    // Mark all sections ready
    await markAllNonFinancialSectionsReady(page);

    console.log("✓ STEP 3 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Submit for review
  // ═══════════════════════════════════════════════════════════════
  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes
    console.log("=== STEP 4: Submit for review ===");
    console.log(`Using submission: ${submissionId}`);

    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Wait for uploads to be processed
    await page.waitForTimeout(2000);

    // Check if Submit button is enabled
    const submitBtn = page
      .locator(
        'button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex"), button:has-text("Submit")',
      )
      .first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      console.log(`Submit button visible: true, enabled: ${isEnabled}`);

      if (isEnabled) {
        console.log("Submit button enabled - clicking...");
        await submitBtn.click({ force: true });
        console.log("Clicked Submit button");

        await page.waitForTimeout(2000);

        const confirmSubmit = page
          .locator('button:has-text("Submit"), button:has-text("Confirm")')
          .first();
        if (await confirmSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmSubmit.click({ force: true });
          console.log("Clicked confirm button in dialog");
        }

        await page.waitForTimeout(3000);
        console.log("Submission submitted!");
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
    test.setTimeout(180000); // 3 minutes
    console.log("=== STEP 5: Apex approval ===");
    console.log(`Using submission: ${submissionId}`);

    await approveAsApex(page, submissionId, "Data verified and accurate");

    console.log("✓ STEP 5 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Federation approval
  // ═══════════════════════════════════════════════════════════════
  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes
    console.log("=== STEP 6: Federation approval ===");
    console.log(`Using submission: ${submissionId}`);

    await approveAsFederation(page, submissionId);

    console.log("✓ STEP 6 COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Ministry final approval
  // ═══════════════════════════════════════════════════════════════
  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes
    console.log("=== STEP 7: Ministry final approval ===");
    console.log(`Using submission: ${submissionId}`);

    await approveAsMinistry(page, submissionId);

    console.log("✓ STEP 7 COMPLETED - All tests passed!");
  });
});
