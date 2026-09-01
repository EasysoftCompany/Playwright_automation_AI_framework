---
description: Implement a TEST_PLAN scenario by ID, following repo conventions
---

Implement the test scenario(s): **$ARGUMENTS**

(e.g. `/implement-scenario S3-04`, or `/implement-scenario S3-04 S3-05`)

## Context to read first
- `TEST_PLAN.md` — find the scenario by ID; the expected behavior and the risk
  it targets are defined there. **Do not invent requirements** — if the scenario
  ID does not exist in the plan, stop and say so.
- `CLAUDE.md` — the conventions below are enforced in PR review
- `pages/` and `fixtures/` — reuse what exists before adding anything

## Rules

- **Traceability:** test title format `ID [Priority] behavior in business language`
- **POM:** zero locators in the test file. Add methods to the relevant page
  object instead; keep methods behavior-named, not DOM-named.
- **Locators:** `getByRole` / `getByLabel` first; `getByTestId` only with a
  justifying comment; CSS, XPath and `nth-child` are banned.
- **No sleeps.** Auto-waiting and web-first assertions only; `expect.poll` for
  content that settles asynchronously.
- **AI content (Step 3 / Luna) is non-deterministic.** Never assert exact
  generated text. Assert properties: present and non-empty, editable, edits
  persist, content changed after regenerate, guardrail disclaimer visible.
- **Assertion strength:** the test must fail if the feature breaks. No
  tautological assertions, no `expect(true)`.

## Procedure

1. Read the scenario in `TEST_PLAN.md` and restate, in one line, what must be
   true for it to pass.
2. Check whether the needed page object methods already exist; extend rather
   than duplicate.
3. Write the test in `tests/test_assignment-workflow_spec.ts`, placed in the
   matching `describe` block.
4. Run it (`npx playwright test -g "<ID>"`). Iterate until it passes for the
   right reason — if it passes because the assertion is weak, fix the assertion.
5. Report: what you added, why the assertion is meaningful, and anything the
   app did that the plan did not predict.
