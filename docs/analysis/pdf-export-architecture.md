# Deep Dive: Report Export Flow Code Explanation

Here is a step-by-step technical breakdown of exactly how the application generates those beautifully formatted PDF reports, with full code explanations tracing from the moment a submission is approved, to the background AI generation, down to the Gotenberg browser rendering.

---

## 1. Background Trigger (On Apex Final Approval)

When the Apex tier finally approves a submission, we don't want the user to wait forever when they eventually click "Download PDF". So, we proactively start generating the reports in the background.

**File:** `backend/src/api/handlers/submission.rs`

```rust
// Inside the `approve_submission` handler:

// Phase A: Trigger background export generation for the cooperative, Apex, Federation, and Ministry.
// All 4 tiers are triggered simultaneously and run in parallel.
let state_clone = state.clone();
let cooperative_id = updated.cooperative_id;
let reporting_year = updated.reporting_year;

// 1. Immediately trigger the cooperative-level PDF generation
crate::services::export_generator::ExportGenerator::trigger_cooperative_export(
    state_clone.clone(),
    id, // submission ID
);

if let Some(c) = &coop {
    // 2. Trigger the Apex-level PDF generation (Runs in parallel)
    crate::services::export_generator::ExportGenerator::trigger_apex_export(
        state_clone.clone(),
        c.apex_id,
        reporting_year,
    );
}

if let Some(a) = &apex {
    // 3. Trigger Federation export (Runs in parallel)
    crate::services::export_generator::ExportGenerator::trigger_federation_export(
        state_clone.clone(),
        a.federation_id,
        reporting_year,
    );
}

// 4. Trigger Ministry export (Runs in parallel)
crate::services::export_generator::ExportGenerator::trigger_ministry_export(
    state_clone.clone(),
    reporting_year,
);
```

**Explanation:**
- The handler immediately triggers all 4 PDF exports directly using `tokio::spawn` internally. The HTTP response for the "Approve" action returns instantly.
- **Optimization Note:** We used to have 65-second `tokio::time::sleep` delays here to avoid AI rate limits. We completely removed them! The system now spawns all tasks in full parallel and relies entirely on a global `ai_semaphore` (max 18 concurrent requests) and `gotenberg_semaphore` (max 2 concurrent renders) to safely throttle the massive load.

---

## 2. Generating the AI Narratives

Inside `trigger_cooperative_export`, the system gathers data to feed to the LLM to write the Executive Summary.

**File:** `backend/src/services/export_generator.rs`

```rust
pub(crate) async fn generate_cooperative_pdf(state: &AppState, submission_id: Uuid) -> AppResult<Vec<u8>> {
    
    // 1. Generate the AI narratives
    let narrative_params = match Self::generate_cooperative_narratives(state, submission_id).await {
        Ok(result) => {
            // 2. Persist the AI output to the submission metadata in the Database
            state.submission_repo.update_metadata(
                submission_id,
                serde_json::json!({ "ai_narratives": result }),
            ).await;
            
            // 3. URL-encode the narratives so they can be passed to the Frontend
            report_narrative::encode_cooperative_narrative_params(&result)
        }
        Err(e) => String::new() // Fallback to empty if AI fails
    };

    // 4. Build a hidden URL pointing to the React Frontend
    let token = state.keycloak.get_admin_token().await?;
    let print_url = format!(
        "{}/print/cooperative/{}?token={}{}",
        state.config.gotenberg_frontend_url, submission_id, token, narrative_params
    );

    // 5. Send this URL to the Headless Browser
    Self::generate_pdf_via_gotenberg(state, &print_url).await
}
```

**Explanation:**
- **`generate_cooperative_narratives`:** This function fetches all KPIs, Financial Line Items, and Non-Financial stats (Savings/Loans/Members) from the DB. It passes them to the `narrative_generator` (LangChain/Gemini integration) to write the text.
- **Persistence:** We save `ai_narratives` into the submission's JSONB metadata column. This allows the frontend to retrieve the exact same text later without re-running the AI.
- **`print_url`:** The backend actually commands Gotenberg (the headless browser) to open a hidden route in the *React application* (e.g., `http://frontend:3000/print/cooperative/1234`).

---

## 3. The React Print Layout (Frontend)

When Gotenberg opens that `print_url`, it hits the React router and mounts `CooperativeReportPrint.tsx`.

**File:** `frontend/src/pages/shared/CooperativeReportPrint.tsx`

```tsx
export const CooperativeReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  // 1. Fetch data from backend using TanStack Query
  const { data: submission, isLoading: subLoading } = useSubmission(submissionId, undefined, tokenOverride);
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId, tokenOverride);
  const { data: lineItemsData, isLoading: lineItemsLoading } = useSubmissionLineItems(submissionId, tokenOverride);
  
  // 2. Track loading states
  const criticalLoading = subLoading || kpisLoading || lineItemsLoading;
  const allLoading = criticalLoading || portfolioLoading || membershipLoading;

  // 3. THE OPTIMIZATION: Tell Gotenberg when the page is fully rendered
  React.useEffect(() => {
    if (!allLoading) {
      setTimeout(() => {
        // We set this global variable to let Gotenberg know it can take the screenshot
        (window as unknown as { isReady: boolean }).isReady = true;
      }, 1000); // 1 second buffer for charts to animate
    }
  }, [allLoading]);

  // 4. Show spinner while loading
  if (allLoading) {
    return <Spinner size="xl" />
  }

  // 5. Render the actual printable pages (Tailwind print utilities are used inside these)
  return (
    <div className="print-report bg-white text-slate-900 font-sans print:w-[210mm]">
      <ReportCoverPage {...reportData} />
      <ReportExecutiveSummary {...reportData} />
      <ReportNonFinancial {...reportData} />
      <ReportFinancialPosition {...reportData} />
      <ReportPortfolioQuality {...reportData} />
    </div>
  );
};
```

**Explanation:**
- The page functions just like a normal web app. It fetches data and displays a loading spinner.
- The `window.isReady = true` script is our "trigger". Without this, Gotenberg wouldn't know when the React app finished fetching data and rendering the DOM.

---

## 4. Gotenberg PDF Conversion (The Headless Browser)

Back in the backend, the request to Gotenberg is dispatched.

**File:** `backend/src/services/export_generator.rs`

```rust
pub(crate) async fn generate_pdf_via_gotenberg(state: &AppState, print_url: &str) -> AppResult<Vec<u8>> {
    let client = reqwest::Client::new();
    
    // Build the multipart form instruction for Gotenberg
    let form_clone = reqwest::multipart::Form::new()
        .text("url", print_url.to_string())
        
        // 🚨 THIS IS THE OPTIMIZATION WE JUST ADDED
        // Gotenberg will evaluate this JS expression repeatedly. The millisecond it
        // returns true, Gotenberg captures the PDF.
        .text("waitForExpression", "window.isReady === true")
        
        // Setup paper sizes and margins
        .text("paperWidth", "8.27") // A4 size
        .text("paperHeight", "11.69")
        .text("marginTop", "0.5")
        // ... (headers/footers injected as HTML parts)

    // Send the request to the Gotenberg microservice (Docker container)
    let response = client
        .post(format!("{}/forms/chromium/convert/url", state.config.gotenberg_url))
        .multipart(form_clone)
        .send()
        .await;

    // Return the bytes of the PDF!
    let bytes = response.bytes().await?;
    return Ok(bytes.to_vec());
}
```

**Explanation:**
- We use the `chromium/convert/url` route of Gotenberg.
- We pass our `waitForExpression` logic. Gotenberg will inject a script into the headless Chromium instance and poll `window.isReady === true`.
- Once captured, Gotenberg returns the raw PDF bytes.

---

## 5. Serving the File (The Cache Layer)

Finally, when the user clicks the "Download PDF" button on the UI, the frontend makes a `GET` request.

**File:** `backend/src/api/handlers/export.rs`

```rust
pub async fn export_single_submission(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    
    let pdf_key = format!("exports/individual/{}/submission_{}.pdf", id, id);

    // If the user didn't explicitly ask for a regeneration, check the MinIO/S3 Cache!
    if !query.regenerate {
        // Because of the background generation we did in Step 1, this file 
        // ALREADY EXISTS 99% of the time!
        if let Ok(bytes) = state.storage.get_object(&pdf_key).await {
            tracing::info!(... "Serving cached PDF");
            return Ok(generate_pdf_response(bytes));
        }
    }

    // Only falls back to generating it right now if the cache was missed
    let pdf_bytes = crate::services::export_generator::ExportGenerator::generate_cooperative_pdf(
        &state, id,
    ).await?;
    
    // Save it to cache for next time
    state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

    Ok(generate_pdf_response(pdf_bytes))
}
```

**Explanation:**
- This ties everything together beautifully. Because of the **Background Trigger** (Step 1), the PDF is almost always sitting in the object storage bucket (`state.storage.get_object`).
- When the user requests the file, they get a near-instant response because we bypass the LLM and Headless Browser completely and just serve the cached file.
