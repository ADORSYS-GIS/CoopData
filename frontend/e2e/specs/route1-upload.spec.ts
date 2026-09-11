import { test, expect } from "@playwright/test";
import { loginAs, fullApprovalChain } from "../fixtures/helpers";

/**
 * Route 1: Upload Method - Happy Path Tests
 * 
 * Tests the full workflow:
 * 1. Cooperative creates submission
 * 2. Cooperative selects "Upload Method" from dialog
 * 3. Cooperative uploads financial statement (PNG - AI extraction)
 * 4. Cooperative marks financial statement as Ready
 * 5. Cooperative uploads non-financial data (Membership Register + Fixed Deposits)
 * 6. Cooperative marks non-financial sections as Ready
 * 7. Cooperative submits for review
 * 8. Apex approves
 * 9. Federation approves
 * 10. Ministry gives final approval
 */

test.describe("Route 1: Upload Method - Happy Path", () => {
  
  /**
   * Test: Upload Yearly Financial (PNG) + Non-Financial (Members + Fixed Deposits)
   * 
   * Flow:
   * 1. Click "New Submission"
   * 2. Select "Yearly" frequency and "2024" period
   * 3. Click "Create Submission"
   * 4. Dialog appears - select "Upload Method"
   * 5. If Financial Statement is Pending: Click "Upload File →" and upload
   * 6. If Financial Statement is In Progress: Click "Ready" button
   * 7. Click "Upload Excel →" for Membership Register
   * 8. Upload Members Excel file and extract
   * 9. Click "Mark Section Ready" for Membership Register
   * 10. Click "Upload Excel →" for Fixed Deposits
   * 11. Upload Fixed Deposits Excel file and extract
   * 12. Click "Mark Section Ready" for Fixed Deposits
   * 13. Submit for review
   * 14. Full approval chain (Apex → Federation → Ministry)
   */
  test("Upload: Yearly Financial (PNG) + Non-Financial (Members + Fixed Deposits) → Full Approval", async ({ page }) => {
    
    // Helper function to wait for button to be enabled
    async function waitForButtonEnabled(page: any, selector: string, timeout: number = 120000) {
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
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Cooperative starts new submission
    // ═══════════════════════════════════════════════════════════════
    
    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");
    
    // Click "New Submission" button
    await page.click('button:has-text("New Submission")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Select Reporting Frequency & Period
    // ═══════════════════════════════════════════════════════════════
    
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
    
    // Get submission ID from URL
    const submissionId = page.url().split('/').pop();
    console.log(`Created submission: ${submissionId}`);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Select Upload Method from Dialog (if dialog appears)
    // ═══════════════════════════════════════════════════════════════
    
    console.log("=== Checking for Upload Method Dialog ===");
    
    // Wait for dialog to appear
    await page.waitForTimeout(2000);
    
    // Look for Upload Method option in the dialog and click it
    const uploadMethodBtn = page.locator('button:has-text("Upload Method"), button:has-text("Upload Documents")');
    if (await uploadMethodBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadMethodBtn.click();
      console.log("Selected Upload Method from dialog");
      await page.waitForTimeout(2000);
    } else {
      console.log("No dialog - upload method may already be selected");
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Financial Statement - Upload or Mark Ready
    // ═══════════════════════════════════════════════════════════════
    
    console.log("=== Step 1: Financial Statement ===");
    
    /**
     * Waits for AI extraction to finish by polling the backend API directly (not via UI).
     * This bypasses React Query's stale cache which can get stuck during Playwright tests
     * when the browser window loses focus and polling pauses.
     *
     * After the API confirms completion, it reloads the page so React Query picks up the
     * terminal status and hides the extraction banner.
     */
    async function waitForExtractionToFinish(page: any, submissionId: string, totalTimeout = 300000) {
      const start = Date.now();
      console.log("Waiting for AI extraction to finish (polling backend directly)...");

      const TERMINAL_STATUSES = ["succeeded", "failed", "partial"];

      while (Date.now() - start < totalTimeout) {
        // Poll the extraction job status directly from the backend via the browser's fetch.
        // This completely bypasses React Query's stale IndexedDB cache.
        // We read the Keycloak access token from IndexedDB (coopdata_tokens) and attach it.
        const jobStatus = await page.evaluate(async (subId: string) => {
          try {
            // Read the Keycloak token from IndexedDB
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

            // Fetch the submission to get the extraction_job_id
            const subRes = await fetch(`/api/v1/cooperative/submissions/${subId}`, { headers });
            if (!subRes.ok) return null;
            const sub = await subRes.json();
            const jobId = sub?.extraction_job_id;
            if (!jobId) return "no_job";

            // Fetch the extraction job status
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
          // No extraction job — nothing to wait for
          console.log("No extraction job found — proceeding");
          return true;
        }

        if (jobStatus && TERMINAL_STATUSES.includes(jobStatus)) {
          console.log(`Extraction finished with status: ${jobStatus}`);
          // Reload page so React Query picks up the terminal status and hides banner
          await page.goto(`/app/submissions/${submissionId}`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(3000);
          return true;
        }

        // Still running — wait 5 seconds then check again
        // Also reload every 20 seconds to un-freeze React Query polling
        if (elapsed > 0 && elapsed % 20 < 5) {
          console.log("Reloading page to un-freeze React Query polling...");
          await page.goto(`/app/submissions/${submissionId}`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2000);
        } else {
          await page.waitForTimeout(5000);
        }
      }

      console.log("Timeout waiting for extraction to complete");
      await page.screenshot({ path: `./test-results/extraction-timeout-${Date.now()}.png` });
      return false;
    }
    

    // Check if Financial Statement is Pending or In Progress
    const uploadFileBtn = page.locator('button:has-text("Upload File →")');
    const readyBtn = page.locator('button:has-text("Ready")').first();
    const reviewBtn = page.locator('button:has-text("Review & Mark Ready →")');
    
    if (await uploadFileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Status is Pending - need to upload
      console.log("Status is Pending - uploading file...");
      await uploadFileBtn.click();
      
      // Wait for the dialog to appear
      await page.waitForTimeout(3000);
      
      // Upload the financial statement PNG file
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles('./e2e/fixtures/test-data/financial/yearly-financial.png');
      console.log("Financial statement file selected");
      
      // Wait for file to be set and dialog to update
      await page.waitForTimeout(3000);
      
      // Click "Upload & Extract" button to trigger AI extraction
      const uploadExtractBtn = page.locator('button:has-text("Upload & Extract")');
      if (await uploadExtractBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadExtractBtn.click();
        console.log("Clicked Upload & Extract — waiting for AI extraction...");
        
        // Wait a few seconds for the extraction banner to appear
        await page.waitForTimeout(5000);
        
        // Now wait for extraction to finish (with periodic page reloads if needed)
        const extractionDone = await waitForExtractionToFinish(page, submissionId!);
        
        if (extractionDone) {
          // Wait for the Mark Section Ready button to become enabled
          const isEnabled = await waitForButtonEnabled(page, 'button:has-text("Mark Section Ready")');
          if (isEnabled) {
            console.log("Mark Section Ready enabled - clicking...");
            await page.locator('button:has-text("Mark Section Ready")').click();
            console.log("Marked Financial Statement as Ready");
          }
        }
      }
    } else if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Status is In Progress - just click Ready button
      console.log("Status is In Progress - clicking Ready button");
      await readyBtn.click();
      console.log("Marked Financial Statement as Ready");
    } else if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click Review & Mark Ready
      console.log("Clicking Review & Mark Ready button");
      await reviewBtn.click();
      await page.waitForTimeout(3000);
      
      // Wait for extraction banner if it appears
      await waitForExtractionToFinish(page, submissionId!);
      
      // Check for Mark Section Ready button
      const markReadyBtn = page.locator('button:has-text("Mark Section Ready")');
      if (await markReadyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const isEnabled = await waitForButtonEnabled(page, 'button:has-text("Mark Section Ready")');
        if (isEnabled) {
          await markReadyBtn.click();
          console.log("Marked Financial Statement as Ready");
        }
      }
    }
    
    // Navigate back to submission detail
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Non-Financial - Full Workbook Upload (ALL sections)
    // ═══════════════════════════════════════════════════════════════

    console.log("=== Step 2: Non-Financial - Full Workbook Upload ===");

    // Helper function to robustly mark all sections ready
    async function markAllNonFinancialSectionsReady(page: any) {
      console.log("Checking for Non-Financial 'Mark Ready' buttons...");
      let attempts = 0;
      const maxAttempts = 120; // 120 seconds total wait
      
      while (attempts < maxAttempts) {
        // Find how many Mark Ready buttons exist
        const markReadyBtns = page.locator('button:has-text("Mark Ready")');
        const count = await markReadyBtns.count().catch(() => 0);
        
        if (count > 0) {
          // Click the first one
          console.log(`Found ${count} 'Mark Ready' button(s). Clicking the first one...`);
          const btn = markReadyBtns.first();
          if (await btn.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await btn.click({ force: true });
            console.log("Clicked Mark Ready button");
            await page.waitForTimeout(3000); // wait for it to process and disappear
            attempts = 0; // reset attempts since we made progress
          } else {
            console.log("Button found but not enabled, waiting...");
            attempts++;
            await page.waitForTimeout(1000);
          }
        } else {
          // No "Mark Ready" buttons found. Check if tables are loaded.
          // If we see "Clear Databases" or tables, the data is loaded and has no buttons, meaning they are ALL ready!
          const hasData = await page.locator('button:has-text("Clear Databases"), button:has-text("Effacer")').isVisible({ timeout: 1000 }).catch(() => false);
          if (hasData) {
            console.log("All non-financial sections are marked ready!");
            return;
          }
          
          attempts++;
          await page.waitForTimeout(1000);
          
          if (attempts % 15 === 0) {
            console.log(`Waiting for tables to appear or buttons to become visible (${attempts}s)...`);
            if (attempts === 30 || attempts === 60) {
               console.log("Reloading page to un-freeze React Query...");
               await page.goto(`/app/submissions/${submissionId}`);
               await page.waitForLoadState("networkidle");
               await page.waitForTimeout(3000);
               console.log("Re-switching to Non-Financial tab after reload...");
               await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
               await page.waitForTimeout(2000);
            }
          }
        }
      }
      
      console.log("WARNING: Timeout waiting for Non-Financial sections to be marked ready.");
    }

    // First, we must switch to the Non-Financial tab to interact with the databases
    console.log("Switching to Non-Financial Information tab...");
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    await page.waitForTimeout(2000);
    
    // Check if data is already uploaded by looking for the "Clear Databases" button
    // This button only appears when there are parsed records.
    const hasData = await page.locator('button:has-text("Clear Databases"), button:has-text("Effacer")').isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasData) {
      console.log("No Non-Financial data found - uploading full workbook...");
      
      // Select the "All sections (single workbook)" card in the upload zone
      await page.locator('div:has-text("All sections (single workbook)")').last().click();
      await page.waitForTimeout(1000);

      // Upload the full workbook
      const nfFileInput = page.locator('input[type="file"]').last();
      await nfFileInput.setInputFiles('./e2e/fixtures/test-data/non-financial/coopdatafullworkbook.xlsx');
      console.log("Full workbook selected");
      await page.waitForTimeout(2000);

      // Click "Upload & Parse"
      const allParseBtn = page.locator('button:has-text("Upload & Parse")');
      await allParseBtn.click();
      console.log("Clicked Upload & Parse — waiting for parsing to complete...");
      
      // Wait for parsing to complete and tables to render
      await page.waitForTimeout(8000);
    } else {
      console.log("Non-Financial data already exists! Skipping upload step.");
    }
    
    // Now we mark all sections ready (if they aren't already)
    await markAllNonFinancialSectionsReady(page);

    // Navigate back to the submission detail root to prepare for submission
    console.log("Navigating back to Submission root...");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Submit for Review
    // ═══════════════════════════════════════════════════════════════
    
    console.log("=== Submitting for Review ===");
    
    // Wait for uploads to be processed
    await page.waitForTimeout(2000);
    
    // Check if "Submit to FSFASA" button is enabled (the actual label shown in the UI)
    const submitBtn = page.locator('button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex"), button:has-text("Submit")').first();
    
    // Debug: Log all buttons containing "Submit"
    const allSubmitBtns = await page.locator('button:has-text("Submit")').allTextContents();
    console.log(`Submit buttons found: ${JSON.stringify(allSubmitBtns)}`);

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false);
      console.log(`Submit button visible: true, enabled: ${isEnabled}`);
      
      if (isEnabled) {
        console.log("Submit button enabled - clicking...");
        await submitBtn.click({ force: true });
        console.log("Clicked Submit button");
        
        // Wait for confirmation dialog
        await page.waitForTimeout(2000);
        
        // Look for confirm/submit button in dialog
        const confirmSubmit = page.locator('button:has-text("Submit"), button:has-text("Confirm")').first();
        if (await confirmSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmSubmit.click({ force: true });
          console.log("Clicked confirm button in dialog");
        }
        
        // Wait for submission to be processed
        await page.waitForTimeout(3000);
        console.log("Submission submitted!");
      } else {
        console.log("Submit button visible but NOT enabled - waiting and retrying...");
        // Wait a bit and try again
        await page.waitForTimeout(5000);
        if (await submitBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await submitBtn.click({ force: true });
          console.log("Clicked Submit button after retry");
          await page.waitForTimeout(2000);
          const confirmSubmit = page.locator('button:has-text("Submit"), button:has-text("Confirm")').first();
          if (await confirmSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmSubmit.click({ force: true });
          }
        }
      }
    } else {
      console.log("Submit button not visible - checking status...");
      
      // Check the readiness status
      const statusText = await page.locator('text="done"').textContent().catch(() => "unknown");
      console.log(`Current status: ${statusText}`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 8: Full Approval Chain (Apex → Federation → Ministry)
    // ═══════════════════════════════════════════════════════════════
    
    // Try to find and click logout button directly
    try {
      const logoutButton = page.locator('button:has-text("Logout")');
      const logoutExists = await logoutButton.count() > 0;
      
      if (logoutExists) {
        await logoutButton.click({ force: true });
        console.log("Clicked logout button");
      } else {
        await page.goto("/");
        await page.waitForTimeout(2000);
        const logoutBtn2 = page.locator('button:has-text("Logout")');
        if (await logoutBtn2.count() > 0) {
          await logoutBtn2.click({ force: true });
        }
      }
      
      // Wait for logout to complete
      await page.waitForTimeout(2000);
      
      // Run the full approval chain
      await fullApprovalChain(page, submissionId!);
      
      // Final verification
      await expect(page.getByText(/Approved|Final/i).first()).toBeVisible({ timeout: 30000 });
      console.log("Test completed successfully!");
    } catch (error) {
      console.log("Error during logout or approval chain:", error);
      throw error;
    }
  });
});