# Test Plan — Newsela Assignment Creation Workflow

**Author:** Gerardo Rico
**Scope:** E2E automation of the assignment creation flow at `https://everwrite.app.newsela.com/assignments`
**Framework:** Playwright + TypeScript, Page Object Model
**Approach:** Risk-based. Happy path automated end-to-end; required-field gates validated per step; deep scenario analysis on Step 3 (student prompt) as requested.

---

## 1. Objective & Strategy

Validate that a teacher can create an assignment end-to-end and receives a shareable assignment link. The automation prioritizes:

1. **The critical business flow** (login → create → 5-step modal → save → confirmation + link) — this is the revenue path; if it breaks, teachers cannot assign work.
2. **Step gates** — each modal step's required inputs must block/allow progression correctly. A user silently advancing with invalid data is a data-quality defect downstream.
3. **Step 3 (student prompt)** — the highest-risk input in the flow: free text, authored by teachers, rendered to students. It concentrates validation, security, i18n, and persistence risk (detailed analysis in section 4).

**Explicitly out of scope** (time-boxed assessment): cross-browser matrix beyond Chromium, visual regression, accessibility audit, performance, negative login scenarios beyond a smoke check, API-level testing. These are noted in section 7 as natural next steps.

## 2. Test Environment & Data

| Item | Value |
|------|-------|
| App under test | `https://everwrite.app.newsela.com/assignments` |
| Browser | Chromium (Playwright bundled), headless in CI |
| Credentials | Provided demo teacher account — injected via environment variables (`.env` locally, GitHub Secrets in CI). **Never committed.** |
| Test data | Prompt text fixtures defined in `fixtures/prompts.ts` (valid, boundary, special-character, injection payloads) |

**Data caveat:** this is a shared demo account. Tests are written to be independent of pre-existing state (no assertions on assignment counts; each run creates its own assignment). Cleanup is not automated because the assessment scope doesn't include deletion — noted as a follow-up.

## 3. Test Scenarios

### 3.1 Happy Path — automated E2E (the deliverable's core)

**TC-01 — Create assignment end-to-end** *(Priority: Critical)*
1. Login with valid teacher credentials → lands on assignments dashboard
2. Click "+ Create Assignment" → creation modal opens on Step 1
3. Complete Steps 1–5, clicking "Next" through each (filling required inputs per step)
4. Click "Save Assignment" on the final step
5. **Assert** "Your assignment is ready" confirmation modal appears
6. Capture the assignment link from the modal, **assert** it is a well-formed URL, and print it to stdout

### 3.2 Step-gate validations *(Priority: High)*

For each modal step (1–5):

**TC-02 — Required inputs gate progression.** With required inputs empty, "Next" (or "Save Assignment" on Step 5) either is disabled or triggers a visible validation message; the modal does **not** advance.

**TC-03 — State persists across navigation.** Data entered in a step is preserved when navigating Back and returning (spot-checked on Step 3, where data loss hurts most — a teacher losing a carefully written prompt is a churn-level bug).

**TC-04 — Modal dismissal.** Closing the modal mid-flow (X / Esc) does not create a partial assignment; reopening starts a clean flow (or restores a draft — behavior to confirm exploratorily and pin with an assertion).

### 3.3 Login smoke *(Priority: Medium)*

**TC-05 — Valid login succeeds** (implicitly covered by TC-01 setup, kept as an explicit fast smoke).
**TC-06 — Invalid password shows an error and does not authenticate** (single negative case; full auth testing is out of scope).

## 4. Deep Dive — Step 3: The AI-Generated Student Prompt ("Luna")

Step 3 is not a blank input — it is an **AI feature**. Luna pre-fills a suggested prompt based on the assignment details, presented in a rich-text editor (bold/italic/headings/lists/quote, undo/redo, clear formatting), with a "Regenerate prompt" action and the guardrail disclaimer *"While Luna is smart, they aren't perfect: please review the leveled content..."*. That changes both the risk model and the assertion model.

### 4.1 How AI changes the assertion model

AI-generated content is **non-deterministic**: the same assignment details can produce different prompts on every run. Exact-text assertions (`toHaveText`) are therefore meaningless here. This suite asserts **properties** instead:

- The prompt is present and non-empty on arrival (the AI did its job)
- The content is editable and teacher edits win (human-in-the-loop)
- The disclaimer guardrail is visible (the product's own admission that AI review is required)
- Regenerate produces new, non-empty content and the UI survives the async cycle
- Content survives navigation (Back/Next) exactly as last edited

What properties can NOT capture — whether the prompt is *good* — is addressed in 4.4.

### 4.2 Risk framing

Same as before, amplified: this content is **authored by an AI, reviewed by a teacher, consumed by students**. The teacher is the safety net the product itself asks for (the disclaimer). So the highest-risk defects are the ones that break the review loop: losing the teacher's edits, blocking manual authoring when the AI fails, or shipping unreviewed regenerated content.

### 4.3 Scenario matrix

**Layer A — Editor mechanics (deterministic UI testing)**

| ID | Scenario | Expected behavior to verify | Risk |
|----|----------|-----------------------------|------|
| S3-01 | Pre-filled prompt on arrival | Editor contains non-empty AI content when Step 3 loads (with a visible loading state if generation is async) | AI integration baseline |
| S3-02 | Clear all content, attempt Next | Progression blocked or validation shown — a teacher must not assign an empty prompt | Data quality |
| S3-03 | Edit the AI text, navigate Next → Back | The **edited** version persists exactly — not the original AI text | Teacher work loss (churn-level) |
| S3-04 | Apply rich formatting (bold, H1, list) to edited text | Formatting applies, persists across navigation, and "clear formatting" reverts it | Editor fidelity |
| S3-05 | Undo after edits / after regenerate | Undo restores the previous state — can a teacher recover a prompt they liked? | Recoverability |
| S3-06 | Type/paste hostile input into the editor (script payload, 10k chars, Unicode) | Inert as text, no freeze, round-trips intact | Stored XSS (student-facing), robustness |

**Layer B — AI behavior through the UI (property-based, non-determinism-aware)**

| ID | Scenario | Expected behavior to verify | Risk |
|----|----------|-----------------------------|------|
| S3-07 | Regenerate prompt | Loading state shown; button disabled while generating; result is new, non-empty content; editor remains functional | Async UX |
| S3-08 | Regenerate after manual edits | Teacher is warned before their edits are discarded (or edits are preserved) — document actual behavior; silent loss is a defect I would raise | **Data loss — the #1 risk on this page** |
| S3-09 | AI generation fails (network aborted via Playwright route interception) | Graceful error; editor remains usable so the teacher can write manually; retry available | Resilience: AI failure must not block the teacher |
| S3-10 | Disclaimer visibility | The "While Luna is smart..." guardrail is always visible on this step | Legal/trust guardrail — treating it as a requirement, not decoration |

**Layer C — Content quality (where QA defines what the business needs)**

Whether the generated prompt is *good* cannot be asserted with E2E checks — and this is exactly where the QA expert adds value beyond what AI-generated test suites cover:

- **Age/level appropriateness** — Newsela's product is leveled content; a prompt above the students' reading level is a core product failure even if every pixel works
- **Alignment** — does the prompt actually match the assignment details entered in Steps 1–2, or is it generic?
- **Factual sanity** — the sample output references FIFA World Cup 2026; hallucinated facts reach children
- **Consistency across regenerations** — quality shouldn't be a lottery

The right tooling for this layer is an **eval suite, not E2E**: a golden set of assignment-detail inputs, property checks (reading-level score, length bounds, no meta-text like "As an AI..."), and an LLM-as-judge with a calibrated rubric for appropriateness and alignment, sampled against human review. Out of scope for this time-boxed assessment, but it is the layer I would build next — E2E proves Luna *responds*; evals prove Luna is *right*.

**Automation selection:** S3-01, S3-02, S3-03, S3-06 (XSS + Unicode), S3-07 and S3-10 are automated. S3-08 and S3-09 are implemented where the app's behavior/endpoints allow discovery within the time box, otherwise documented as exploratory with the defect-criteria above. S3-04/05 are exploratory (automating editor internals without knowing the intended formatting model pins assumptions).

### 4.4 Technical note — automating a rich-text editor

The toolbar strongly suggests a `contenteditable` editor (ProseMirror/TipTap family), not a `<textarea>`. Implications baked into the page object: `fill()` may not fire the editor's input pipeline, so interactions use click + keyboard (`ControlOrMeta+A`, `Delete`, typed input); reading content uses `innerText`, not `inputValue`. This is documented because selector-level decisions like this are precisely where naive AI-generated tests break.

## 5. Design Decisions (what I want reviewers to see)

1. **POM with zero locators in tests.** All selectors live in page objects; tests read as the workflow's business language. One class per surface: `LoginPage`, `AssignmentsPage`, `CreateAssignmentModal` (steps as methods — the modal is one component with internal state, not five pages), `ConfirmationModal`.
2. **Accessibility-first locators.** `getByRole`/`getByLabel` before test ids; no CSS/XPath. Resilient to styling changes and doubles as a passive a11y smoke.
3. **No sleeps.** Playwright auto-waiting + web-first assertions only. Async transitions (step changes, save) are asserted on state, not time.
4. **Credentials via environment** (`.env` + GitHub Secrets). The submitted repo contains `.env.example` only.
5. **Independent, repeatable tests.** No shared state between tests; each run creates its own data.
6. **AI-assisted, human-designed.** AI was used for scaffolding and boilerplate; scenario selection, risk analysis, and locator strategy are the design work — which is the part being evaluated.
7. **Property-based assertions for AI content.** Step 3's prompt is generated by Luna (non-deterministic), so tests assert properties (present, editable, persistent, guarded by the disclaimer) rather than exact text — and the plan explicitly separates what E2E can prove (the AI responds) from what needs an eval layer (the AI is right). Testing an AI feature with deterministic-era assertions would produce green builds and false confidence.

### 5.1 AI tooling as part of the framework

The role this framework targets calls for AI-assisted practices, so the repo
treats AI as infrastructure rather than as a one-off authoring shortcut. Three
distinct uses, deliberately separated:

- **AI writes tests** (assisted authoring) — scaffolding and boilerplate.
  Scenario selection, risk analysis and locator strategy remain human work.
- **An agent enforces conventions** — `CLAUDE.md` defines the standard;
  `.claude/commands/review-tests.md` defines the review; the same command runs
  locally and in CI, with read-only tool permissions.
- **The product under test is an AI feature** — see §4.

What is deliberately NOT delegated to an agent: executing the verification
itself. The Playwright suite in CI is deterministic, versioned code. An agent
that both writes and executes the check produces an opinion, not a test.

## 6. Execution

- **Local:** `npm test` (headed: `npm run test:headed`; UI mode: `npm run test:ui`)
- **CI:** GitHub Actions on push/PR — see `.github/workflows/e2e.yml`. HTML report + trace uploaded as artifacts; trace-on-first-retry enabled for post-mortem debugging.

## 7. Risks & Follow-ups

| Risk / gap | Mitigation / next step |
|-----------|------------------------|
| Shared demo account → parallel runs may collide | Workers=1 in CI for this assessment; real project: per-worker accounts |
| Created assignments accumulate (no cleanup) | Follow-up: teardown via UI or API once a delete path is confirmed |
| Steps 1–5 required inputs unknown until explored | First exploratory pass with `playwright codegen`; page objects structured so each step's fill logic is one method to adjust |
| Demo environment instability | Retries=1 in CI with trace; failures triaged as env vs product via trace |
