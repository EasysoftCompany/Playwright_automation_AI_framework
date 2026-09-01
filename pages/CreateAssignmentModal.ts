import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The 5-step "Create Assignment" modal.
 *
 * Design decision: modeled as ONE page object with step methods, not five
 * classes — it is a single component with internal wizard state, and the
 * test should read as the teacher's journey.
 *
 * Step 3 is an AI feature: "Luna" pre-fills the student prompt in a
 * rich-text editor (contenteditable — see TEST_PLAN.md §4.4), with a
 * "Regenerate prompt" action. Interactions use keyboard, not fill(), and
 * assertions are property-based (AI content is non-deterministic).
 *
 * Steps 1, 2 and 4 required-input behavior confirmed via live exploration
 * (Playwright MCP): Step 1's content source and Step 4's class selection are
 * both optional despite UI copy suggesting otherwise; Step 2's title is the
 * only field that actually gates progression, and arrives pre-filled with a
 * valid default. See the per-step method comments below for specifics.
 */
export class CreateAssignmentModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly saveAssignmentButton: Locator;
  readonly promptEditor: Locator;
  readonly regenerateButton: Locator;
  readonly lunaDisclaimer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog');
    this.nextButton = this.modal.getByRole('button', { name: /next/i });
    // exact: true — Step 4 has buttons like "Background toggle menu" and
    // "Show Glows & Grows feedback" whose names substring-match /back/i
    // (confirmed against real DOM: this ambiguity only surfaces once Step 4
    // is reached, since it's the step with the most controls).
    this.backButton = this.modal.getByRole('button', { name: 'Back', exact: true });
    this.saveAssignmentButton = this.modal.getByRole('button', {
      name: /save assignment/i,
    });
    // Confirmed against real DOM: the contenteditable root exposes
    // role=textbox with a proper accessible name — no attribute fallback
    // needed.
    this.promptEditor = this.modal.getByRole('textbox', {
      name: 'Assignment writing prompt',
    });
    this.regenerateButton = this.modal.getByRole('button', {
      name: /regenerate prompt/i,
    });
    this.lunaDisclaimer = this.modal.getByText(/while luna is smart/i);
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
  }

    async clickBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Step 1 — "Newsela content source". Confirmed against real DOM: adding a
   * source article is explicitly optional ("click Next to continue without
   * content"); there is no required input to gate progression.
   */
  async completeStep1(contentUrl?: string): Promise<void> {
    if (contentUrl) {
      // No accessible name beyond the "Required" badge text (mislabeled —
      // this field is optional per the step's own copy); the placeholder is
      // the only meaningful identifier, per CLAUDE.md's locator fallback
      // order for form fields.
      await this.modal.getByPlaceholder('www.newsela.com').fill(contentUrl);
      await this.modal.getByRole('button', { name: 'Add' }).click();
    }
    await this.clickNext();
  }

  /**
   * Step 2 — "Assignment Structure". Confirmed against real DOM: the only
   * field that blocks progression when empty is the title (validation
   * message "Please enter a title before continuing."). Word count (50–250)
   * and genre (Literary Analysis) arrive pre-filled with valid defaults.
   */
  async completeStep2(title = 'QA Automation — TC-01 Assignment'): Promise<void> {
    // Same accessibility gap as the Step 1 URL field — accessible name is
    // just "Required"; the placeholder is the reliable identifier.
    await this.modal.getByPlaceholder('Type here').fill(title);
    await this.clickNext();
  }

  // ---------- Step 3: AI-generated prompt (Luna) ----------

  /** Property assertion: Luna pre-filled the prompt (content-agnostic). */
  async expectPromptPrefilled(): Promise<void> {
    await expect(this.promptEditor).toBeVisible();
    // Generation may be async — poll until non-empty instead of sleeping.
    await expect
      .poll(async () => (await this.getPromptText()).trim().length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
  }

  async getPromptText(): Promise<string> {
    return this.promptEditor.innerText();
  }

  /** contenteditable-safe: select all + delete (fill() may bypass the editor). */
  async clearPrompt(): Promise<void> {
    await this.promptEditor.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.press('Delete');
  }

  /** Replace Luna's content with the teacher's own text. */
  async replacePrompt(text: string): Promise<void> {
    await this.clearPrompt();
    await this.page.keyboard.insertText(text);
  }

  /** Append to the AI content — the realistic "teacher tweaks it" action. */
  async appendToPrompt(text: string): Promise<void> {
    await this.promptEditor.click();
    await this.page.keyboard.press('ControlOrMeta+End');
    await this.page.keyboard.insertText(text);
  }

  /**
   * Regenerate and wait for a new prompt. Non-determinism-aware: asserts the
   * content CHANGED and is non-empty, never exact text.
   *
   * No distinct loading indicator (spinner/disabled button) was observed
   * during manual exploration — regeneration completed within a single
   * round trip. Content-based polling below is deliberately not tied to a
   * transient UI state that may not exist; if a slower-network spot check
   * later reveals one, pin it here.
   */
  async regeneratePrompt(): Promise<{ before: string; after: string }> {
    const before = await this.getPromptText();
    await this.regenerateButton.click();
    await expect
      .poll(async () => (await this.getPromptText()).trim(), { timeout: 30_000 })
      .not.toBe(before.trim());
    const after = await this.getPromptText();
    expect(after.trim().length).toBeGreaterThan(0);
    return { before, after };
  }

  async expectDisclaimerVisible(): Promise<void> {
    await expect(this.lunaDisclaimer).toBeVisible();
  }

  async expectPromptText(expected: string): Promise<void> {
    await expect(this.promptEditor).toContainText(expected);
  }

  /** Happy-path Step 3: verify Luna delivered, keep/adjust content, advance. */
  async completeStep3(editText?: string): Promise<void> {
    await this.expectPromptPrefilled();
    if (editText) {
      await this.appendToPrompt(editText);
    }
    await this.clickNext();
  }

  /**
   * Asserts progression is blocked on the current step. Confirmed mechanism
   * (Steps 2 and 3): Next is never disabled — clicking it keeps the modal on
   * the same "Step N of 5" and surfaces a visible inline validation message
   * (e.g. "Please enter a title before continuing.", "Please type a prompt
   * before continuing."). Asserting the step counter is unchanged is
   * step-agnostic, so this works regardless of which step's gate is under
   * test.
   */
  async expectCannotAdvance(): Promise<void> {
    const stepLabel = this.modal.getByText(/^Step \d of 5$/);
    const before = await stepLabel.textContent();
    if (!(await this.nextButton.isDisabled())) {
      await this.nextButton.click();
    }
    await expect(stepLabel).toHaveText(before ?? /^Step \d of 5$/);
  }

  /**
   * Step 4 — "Assignment Configurations". Confirmed against real DOM: the
   * Rubric selector is genuinely required but arrives pre-filled with a
   * valid default ("General Purpose Literary Analysis"). The Classes
   * selector is labeled "Required" in the UI, but progression succeeds with
   * none selected (verified on a demo account with zero active classrooms) —
   * a mislabeled-field discovery worth flagging in TEST_PLAN.md, not a fill
   * target here. Rubric/Labels/Student experience/Schedule are all optional.
   */
  async completeStep4(): Promise<void> {
    await this.clickNext();
  }

  /** Step 5 — final step: save. */
  async completeStep5AndSave(): Promise<void> {
    await this.saveAssignmentButton.click();
  }
}
