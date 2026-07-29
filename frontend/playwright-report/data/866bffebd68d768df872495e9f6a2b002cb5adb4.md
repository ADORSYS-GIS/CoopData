# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug_save.spec.ts >> debug questionnaire saving and network requests
- Location: e2e/debug_save.spec.ts:4:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Edit Fields")').first() to be visible
    - waiting for" http://localhost:5173/app/questionnaire-templates?no-silent-sso=true?code=test-code-1785342360631&state=a7b14604-713a-44e3-a58e-eaf5e2b48b02" navigation to finish...
    - navigated to "http://localhost:5173/app/questionnaire-templates?no-silent-sso=true?code=test-code-1785342360631&state=a7b14604-713a-44e3-a58e-eaf5e2b48b02"
    3 × waiting for" http://localhost:5173/app/questionnaire-templates?no-silent-sso=true?code=test-code-1785342360631&state=a7b14604-713a-44e3-a58e-eaf5e2b48b02?code=test-code-1785342361580&state=86ca5377-febc-4f00-856d…" navigation to finish...
      - navigated to "http://localhost:5173/app/questionnaire-templates?no-silent-sso=true?code=test-code-1785342360631&state=a7b14604-713a-44e3-a58e-eaf5e2b48b02?code=test-code-1785342361580&state=86ca5377-febc-4f00-856d…"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { mockKeycloakAuthenticated } from "./fixtures/auth";
  3  | 
  4  | test("debug questionnaire saving and network requests", async ({ page }) => {
  5  |   // Listen to console logs
  6  |   page.on("console", (msg) => {
  7  |     console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  8  |   });
  9  | 
  10 |   // Listen to network requests
  11 |   page.on("request", (req) => {
  12 |     if (req.url().includes("questionnaire-templates")) {
  13 |       console.log(`[NETWORK REQ] ${req.method()} ${req.url()}`);
  14 |       if (req.method() === "PUT") {
  15 |         console.log(`[NETWORK REQ PAYLOAD]`, req.postData());
  16 |       }
  17 |     }
  18 |   });
  19 | 
  20 |   page.on("response", (res) => {
  21 |     if (res.url().includes("questionnaire-templates")) {
  22 |       console.log(`[NETWORK RES] ${res.status()} ${res.url()}`);
  23 |     }
  24 |   });
  25 | 
  26 |   // Authenticate as ministry user
  27 |   console.log("Mocking Keycloak auth...");
  28 |   await mockKeycloakAuthenticated(page, "ministry");
  29 | 
  30 |   // Go directly to dashboard
  31 |   console.log("Navigating to dashboard...");
  32 |   await page.goto("http://localhost:5173/app/dashboard?no-silent-sso=true");
  33 |   await page.waitForURL("**/app/dashboard**");
  34 | 
  35 |   // Go to questionnaire templates
  36 |   console.log("Navigating to templates page...");
  37 |   await page.goto("http://localhost:5173/app/questionnaire-templates?no-silent-sso=true");
  38 | 
  39 |   // Wait for Edit Fields button
  40 |   console.log("Clicking Edit Fields...");
  41 |   const editButton = page.locator('button:has-text("Edit Fields")').first();
> 42 |   await editButton.waitFor();
     |                    ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  43 |   await editButton.click();
  44 | 
  45 |   // Add Question
  46 |   console.log("Clicking Add Question...");
  47 |   const addQuestionBtn = page.locator('button:has-text("Add Question")');
  48 |   await addQuestionBtn.waitFor();
  49 |   await addQuestionBtn.click();
  50 | 
  51 |   // Fill Modal
  52 |   console.log("Filling modal details...");
  53 |   await page.getByPlaceholder("e.g. Total Registered Members").fill("Test Dynamic Field");
  54 |   await page.getByPlaceholder("Optional guidance text for cooperatives...").fill("This is a playwright test question");
  55 |   
  56 |   // Click Apply Field (or Save Question in modal)
  57 |   const applyBtn = page.getByRole("button", { name: "Apply Field" });
  58 |   await applyBtn.click();
  59 | 
  60 |   // Wait for modal to close
  61 |   await page.waitForTimeout(500);
  62 | 
  63 |   // Click Save Changes
  64 |   console.log("Clicking Save Changes...");
  65 |   const saveChangesBtn = page.locator('button:has-text("Save Changes")');
  66 |   await saveChangesBtn.click();
  67 | 
  68 |   // Wait for a second toast or response
  69 |   console.log("Waiting for network response to complete...");
  70 |   await page.waitForTimeout(3000);
  71 |   
  72 |   console.log("Done.");
  73 | });
  74 | 
```