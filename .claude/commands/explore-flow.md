---
description: Explore the live app with Playwright MCP and replace TODO locators with real ones
---

Use **Playwright MCP** to explore the live application and turn the TODO
placeholders in `pages/` into real, verified locators.

Focus area (optional): $ARGUMENTS — if empty, explore the entire flow.

## Context to read first
- `TEST_PLAN.md` — the scenarios this framework must support
- `CLAUDE.md` — the conventions every locator and method must follow

## Procedure

1. **Navigate.** Open `https://everwrite.app.newsela.com/assignments` and log in
   with `NEWSELA_USERNAME` / `NEWSELA_PASSWORD` from `.env`. Never print the
   password in your output.

2. **Walk the full flow** — "+ Create Assignment", Steps 1 through 5, "Save
   Assignment", confirmation modal.

3. **Record, for every step:**
   - The accessible role + name of each interactive element
   - Which fields are **required** to advance (try clicking Next with the step
     empty and observe what happens)
   - For Step 3: how the rich-text editor is exposed (role? `contenteditable`?),
     whether Luna pre-fills content on arrival, and whether a loading indicator
     appears while generating
   - For the confirmation modal: how the assignment link is exposed
     (anchor `href` vs read-only input value)

4. **Update the page objects** in `pages/`:
   - Replace every `TODO:` locator with the verified one
   - Implement `completeStep1`, `completeStep2`, `completeStep4` with the real
     required inputs
   - Follow the locator priority in `CLAUDE.md` strictly: `getByRole` /
     `getByLabel` first; `getByTestId` only with a comment justifying it;
     never CSS, XPath or `nth-child`

5. **Verify.** Run `npx playwright test --headed -g "TC-01"` and iterate until
   it passes. Never use a sleep to make it pass — if it is flaky, find the race.

6. **Report** at the end, as a short list:
   - Locators changed (old guess → verified locator)
   - Required fields discovered per step
   - **Behavioral findings**, especially:
     - Does regenerating the prompt discard the teacher's manual edits, and is
       there any warning? (scenario S3-08 — highest risk on that page)
     - Is progression blocked when the prompt is empty? (S3-02)
     - Does the edited prompt survive Back/Next? (S3-03)

   Findings that contradict `TEST_PLAN.md` are **discoveries worth reporting**,
   not tests to delete. List them so they can be documented in the plan.
