# Exploration Notes — Create Assignment Flow

Findings from a live walkthrough of `https://everwrite.app.newsela.com/assignments`
(redirects to `writing.app.newsela.com`, with sign-in on `app.newsela.com`) using
Playwright MCP, used to replace the `TODO` locators in `pages/*.ts` with real,
verified ones. See `TEST_PLAN.md` for scenario IDs and `CLAUDE.md` for the
locator/assertion conventions these notes were held to.

## Verified locators

### `LoginPage.ts`

| Field | Old (TODO guess) | Verified | Why it changed |
|---|---|---|---|
| `usernameInput` | `getByRole('textbox', {name:/username\|email/i})` | `getByRole('textbox', {name:'Username Required'})` | No real `<label>` association — the field's accessible name is the visible "Username" text fused with its "Required" badge, not a clean label string. |
| `passwordInput` | `getByLabel(/password/i)` | `getByRole('textbox', {name:'Password Required'})` | Same labeling gap — `getByLabel()` never resolves. |
| `signInButton` | `getByRole('button', {name:/sign in\|log in/i})` | `getByRole('button', {name:'Sign in', exact:true})` | Non-exact regex also matched the unrelated "Sign in through another LMS" accordion toggle (`strict mode violation`, 2 matches). |
| `errorMessage` | `getByRole('alert')` | `getByRole('alert').filter({hasText:/check your username or password/i})` | The page renders an empty top-level `alert` role alongside the one that actually carries the validation copy; unfiltered it's ambiguous. |

The sign-in form also sits behind a **"Your Privacy Choices" cookie-consent
dialog** on a fresh browser profile. Until it's dismissed, the username/password
fields never resolve an accessible name at all, so `goto()` now dismisses it
(bounded `click({timeout: 8000}).catch(() => {})` on the "Close" button — not a
sleep, and a no-op on sessions that already have the consent preference stored).

### `AssignmentsPage.ts`

| Field | Old (TODO guess) | Verified | Why it changed |
|---|---|---|---|
| `createAssignmentButton` | `getByRole('button', {name:/\+?\s*create assignment/i})` | `getByRole('link', {name:'Create Assignment'})` | It's an `<a>` navigating to `/editor?action=createAssignment` — a full page navigation, not a button that opens a modal in place. The 5-step wizard opens as a `dialog` on the resulting page. |

### `CreateAssignmentModal.ts`

| Field | Old (TODO guess) | Verified | Why it changed |
|---|---|---|---|
| `promptEditor` | `getByRole('textbox').or([contenteditable="true"]).first()` | `getByRole('textbox', {name:'Assignment writing prompt'})` | The contenteditable root has a real accessible name — no attribute fallback needed. |
| `backButton` | `getByRole('button', {name:/back/i})` | `getByRole('button', {name:'Back', exact:true})` | `/back/i` substring-matched **"Back‑ground toggle menu"** and **"Show Glows & Grows feed‑back"** on Step 4, once that step's accordion controls were reachable — caused a 4-element strict-mode violation, only surfaced on a full-suite run. |
| `regenerateButton` | `getByRole('button', {name:/regenerate prompt/i})` | unchanged — confirmed exact | — |
| `lunaDisclaimer` | `getByText(/while luna is smart/i)` | unchanged — confirmed exact text | Kept as `getByText` deliberately: this is pinned legal/guardrail copy the product treats as a requirement (TEST_PLAN §4), not "styled content." |
| `nextButton` / `saveAssignmentButton` | `/next/i` / `/save assignment/i` | unchanged — confirmed | Real accessible name is "Next" and "Save assignment" (lowercase 'a'); the case-insensitive regexes already matched correctly. |

### `ConfirmationModal.ts`

| Field | Old (TODO guess) | Verified | Why it changed |
|---|---|---|---|
| `readyHeading` | `getByText(/your assignment is ready/i)` | `getByRole('heading', {name:'Your assignment is ready'})` | Upgraded to a role-based query per CLAUDE.md's locator priority — it is in fact a real `<h2>`. |
| `assignmentLink` | `getByRole('link').or(getByRole('textbox'))` | `getByRole('textbox')` | Confirmed it's **always** a disabled, read-only textbox (`value` attribute) next to a "Copy link" button — never an anchor with `href`. The link-or-textbox fallback chain was dead code. `captureAndPrintAssignmentLink()` simplified to `inputValue()` only (no `getAttribute('href')` branch). |

## Required fields per step (confirmed by clearing fields and clicking Next)

| Step | What's required | What's actually validated |
|---|---|---|
| 1 — Newsela content source | Nothing | Fully optional; "click Next to continue without content" per the step's own copy. |
| 2 — Assignment Structure | **Title only** | Empty title blocks Next with "Please enter a title before continuing." (inline error + `[invalid]` attribute). Word count (defaults 50–250) and genre (defaults to Literary Analysis) arrive pre-filled with valid values — never had to be touched to progress. |
| 3 — Student prompt (Luna) | **Prompt text** | Empty prompt blocks Next with "Please type a prompt before continuing." |
| 4 — Assignment Configurations | Rubric only, and it's pre-filled | Rubric combobox is genuinely required but defaults to "General Purpose Literary Analysis" (valid). **Classes is labeled "Required" in the UI but is not enforced** — progression succeeded with zero classes selected on a demo account with no active classrooms. This is a discovery, not a gate: flag as a mislabeled-field defect in `TEST_PLAN.md`. |
| 5 — Review | — | Review-only step; Save assignment always available once Steps 1–4 are satisfied. |

The blocking mechanism itself (relevant to `TC-02`/`expectCannotAdvance()`) is
consistent across both gated steps: **Next is never disabled**. Clicking it
keeps the modal on the same "Step N of 5" and surfaces an inline validation
message next to the offending field. `expectCannotAdvance()` now asserts the
step counter is unchanged, which is step-agnostic and works for both Step 2
and Step 3.

## Test results

Full suite (`npx playwright test`), most recent clean run: **8/8 passing**
(`TC-01`, `S3-01`, `S3-02`, `S3-03`, `S3-07`, `S3-06`, `S3-06b`, `TC-06`).

Getting there required two rounds of fixes, both against real, reproducible
issues rather than flakiness in my test logic:

1. **Cookie consent + exact-name fixes** (`LoginPage.ts`) — TC-01 hung for the
   full 45s timeout on `usernameInput.fill()` because the consent dialog
   blocked the field's accessible name from ever resolving in a fresh
   Playwright browser context (my manual MCP session never hit this because
   its profile already had the consent preference saved from earlier
   exploration). Second failure was the `signInButton` strict-mode
   violation described above. Both fixed; standalone TC-01 then passed
   reliably.

2. **`backButton` ambiguity** (`CreateAssignmentModal.ts`) — only surfaced
   once the full suite ran S3-03/S3-06/S3-06b, which are the tests that
   click Back from Step 4. Fixed with `exact: true`.

3. **Intermittent login race → credentials in URL** — see the dedicated
   section below. Mitigated, not eliminated, with a `networkidle` wait.

After both rounds of fixes, three consecutive standalone TC-01 runs and one
full-suite run all passed cleanly.

## Behavioral findings

### S3-01 — Luna pre-fills the prompt on arrival (CONFIRMED)

Every fresh entry into Step 3 (three separate runs, both interactive
exploration and automated) landed with the prompt editor already containing
non-empty, well-formed AI content — a multi-paragraph prompt with bolded
key terms and a numbered list — with no blank/loading state ever observed
between arrival and content being present. In one run, the pre-filled text
visibly incorporated the Step 2 title I had typed ("QA Automation Test
Assignment"), confirming Luna draws on the assignment details entered
earlier in the wizard rather than generating generic filler.

No distinct loading indicator (spinner, disabled editor, "Generating…"
copy) was observed — generation appears to complete within the same
round trip that renders Step 3, at least on this connection. This is
noted as inconclusive rather than "no loading state exists"; see the
loading-indicator note under "Other confirmed findings" below.

`expectPromptPrefilled()` — used by `S3-01` — polls
`getPromptText().trim().length > 0` rather than asserting exact content,
per CLAUDE.md's non-determinism rule for AI output.

### S3-02 — Clearing the prompt blocks progression (CONFIRMED)

1. Navigated to Step 3, confirmed Luna's prefilled content was present.
2. Clicked into the prompt editor, `ControlOrMeta+A` then `Delete` — editor
   reduced to a single empty paragraph.
3. Clicked **Next**.
4. Result: the modal **did not advance** — it stayed on "Step 3 of 5" and
   surfaced a visible inline error, "Please type a prompt before
   continuing.", in a `complementary "Error"` region above the editor.

Mechanism matches Step 2's title gate exactly: Next is never disabled: the
click itself triggers validation, the step counter doesn't change, and an
inline message appears next to the empty field. `expectCannotAdvance()`
asserts on the unchanged step counter, so it covers this scenario without
being hardcoded to Step 3's specific error copy.

### S3-08 — Regenerate silently discards manual edits (CONFIRMED, critical)

This is the finding TEST_PLAN.md §4.3 already flagged as **"the #1 risk on
this page"**, and live testing confirms it is real:

1. Navigated to Step 3, let Luna pre-fill the prompt.
2. Selected all, deleted, and typed a manual replacement:
   `"MANUAL TEACHER EDIT: please do not lose this text."`
3. Clicked **"Regenerate prompt"**.
4. Result: the manual edit was **silently replaced** with new AI-generated
   content. No confirmation dialog, no warning banner, no undo prompt — at
   no point, before or after the click, was there any indication the
   teacher's text was about to be or had been discarded.

Impact, per the plan's own risk framing: the product's guardrail model
depends on the teacher reviewing and editing AI output before it reaches
students (the disclaimer literally asks for this). A control that destroys
that review work with a single accidental click undermines the entire
review loop, not just UI polish. **This should be filed as a defect**, not
tuned around — the fix belongs in the product (a confirm-before-discard
step, or preserving edits on regenerate), not in the test suite lowering its
expectations.

Note: `Undo` (toolbar button, S3-05) was *not* tested against a
post-regenerate state — worth an exploratory follow-up to see whether Undo
can recover the discarded edit even though the UI gives no warning.

### Other confirmed findings

- **S3-03**: edited prompt text (not the original AI text) persists exactly
  across Next → Back navigation. Confirmed with a distinguishable marker
  string (`PERSISTENCE-CHECK-EDIT`).
- **TC-04 (modal dismissal)**: closing the modal mid-flow (✕) does **not**
  silently discard progress. It surfaces an explicit "You have unsaved
  changes" dialog with "Exit" / "Back" actions. TEST_PLAN.md listed this as
  "behavior to confirm exploratorily" — now confirmed, and worth pinning
  with an assertion in `TC-04`.
- **Step 4 Classes field is mislabeled "Required"** despite not gating
  progression (see required-fields table above) — an accessibility/copy
  defect worth flagging separately from the automation itself.
- **No distinct loading indicator observed during Luna regeneration** — the
  response completed within a single round trip in manual testing, so I
  could not confirm or deny a spinner/disabled-button state during
  generation. Left `regeneratePrompt()`'s content-based polling as the
  robust approach rather than pinning a guessed loading-state locator;
  worth a slow-network spot check later.

### New discovery, not in TEST_PLAN.md: credentials exposed via URL (security)

Intermittently (reproduced on roughly 2 of 7 full-suite runs before
mitigation), the sign-in form fell back to a **native GET form submission**
before the SPA's JS submit handler attached, landing on:

```
https://app.newsela.com/signin/?username=qe.demo.teacher&password=<redacted>
```

i.e. the password in plaintext in the URL query string — exposed via browser
history, server access logs, and any `Referer` header sent from that page.
This is a genuine timing race in the product (JS hydration lagging behind
interactivity), not a Playwright artifact — it reproduced with real,
non-instant typing-equivalent `.fill()` + `.click()` calls.

Mitigation added in `LoginPage.goto()`: `await this.page.waitForLoadState('networkidle').catch(() => {})`
after dismissing the cookie dialog and before any interaction. This reduced
the race to 0 occurrences across 4 follow-up runs (3 standalone + 1
full-suite), but it is a reduction, not a fix — the underlying race still
exists in the product. **Recommend filing this as a security defect** with
the app team and adding it to `TEST_PLAN.md` as a known risk (it belongs
next to the "Demo environment instability" row in §7).
