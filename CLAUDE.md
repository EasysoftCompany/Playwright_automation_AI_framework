# CLAUDE.md — Agent Conventions

Conventions for AI agents (Claude Code, Copilot) working in this repository.
Quality bar: "a senior QE is reviewing your PR."

This file exists for the same reason a team style guide exists — AI accelerates
test writing, but only if it writes tests *our* way. Speed without conventions
produces volume, not value.

## Project context

Playwright + TypeScript E2E framework for the Newsela assignment creation
workflow. Read `TEST_PLAN.md` first — it defines scope, risk-based scenario
selection, and the reasoning behind every design decision here.

The system under test includes an **AI feature**: "Luna" pre-fills the student
prompt in Step 3. That changes how tests are written (see "Testing AI features").

## Hard rules

### Traceability
Every test maps to a scenario ID from `TEST_PLAN.md` (`TC-01`, `S3-07`, …).
Title format: `ID [Priority] behavior described in business language`.
No orphan tests. If behavior isn't in the plan, update the plan first — or flag
it as a discovery, which is a finding worth reporting, not a test worth hiding.

### Locators — accessibility-first, strict order
1. `getByRole` with accessible name — always first
2. `getByLabel` / `getByPlaceholder` for form fields
3. `getByTestId` — fallback only, with a comment explaining why 1 and 2 failed
4. **Banned:** CSS classes, XPath, `nth-child`, text selectors on styled content

Exception, documented: the Step 3 rich-text editor is `contenteditable`; a
`[contenteditable="true"]` fallback is allowed there and is already implemented.

### No sleeps, ever
No `page.waitForTimeout()`. Use auto-waiting, web-first assertions
(`await expect(locator).toBeVisible()`), and `expect.poll` for content that
settles asynchronously. A sleep is never the fix for flakiness — find the race.

### Page Object Model
- Zero locators in test files. Everything through `pages/`.
- Tests read as the teacher's journey, not as DOM instructions.
- The 5-step modal is ONE page object with step methods — it is a single
  component with wizard state, not five pages.

### Secrets
Credentials come from environment variables only (`.env` locally, GitHub
Secrets in CI). Never hardcode, never commit, never log a credential.
This is a public repository.

## Testing AI features (Step 3 / Luna)

AI output is **non-deterministic** — the same input yields different text every
run. Deterministic-era assertions produce green builds and false confidence.

**Never** assert exact generated text (`toHaveText`, snapshot comparison).
**Do** assert properties:

- Presence: content exists and is non-empty (`expect.poll` on length)
- Editability: teacher edits apply and win over AI content
- Persistence: the edited version survives navigation
- Change: after regenerate, content differs from before and is non-empty
- Guardrails: the review disclaimer is visible — treat it as a requirement

Content *quality* (reading level, alignment, factual sanity) cannot be asserted
in E2E. That belongs to an eval layer — see `TEST_PLAN.md` §4.3 Layer C.
Do not fake it with brittle keyword assertions.

## Reusable commands (`.claude/commands/`)

Prompts are versioned artifacts here, not throwaway text. Each command works
identically in an interactive session and in headless/CI mode:

| Command | Purpose |
|---------|---------|
| `/explore-flow` | Drive the live app with Playwright MCP, verify locators, fill in TODOs |
| `/implement-scenario <ID>` | Implement a TEST_PLAN scenario (e.g. `S3-04`) under these conventions |
| `/review-tests` | Senior-QE review of the suite — the same command CI runs on every PR |

Local: `/review-tests`
CI: invoked by `.github/workflows/claude-pr-review.yml`

Edit the criteria in the command file, never inline in a workflow — one source
of truth, reviewable in a PR like any other code.

## PR review checklist (follow in this order)

1. **Traceability** — does every new/changed test reference a valid scenario ID?
2. **Assertion strength** — would the test still pass if the feature were broken?
   Flag tautological or absent assertions.
3. **Locator strategy** — any CSS/XPath/nth-child? Unjustified `getByTestId`?
4. **Flakiness** — sleeps, unawaited promises, order dependence, races.
5. **AI-awareness** — any exact-text assertion on Luna-generated content?
   That is a defect in the test, not a strict test.
6. **Honesty** — does the test title describe what is actually asserted?

## Never

- Add a sleep to "fix" a flaky test
- Weaken an assertion to make a test pass
- Assert exact text on AI-generated content
- Commit credentials or `.env`
- Skip a plan-required scenario without documenting why in `TEST_PLAN.md`
