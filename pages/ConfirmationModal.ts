import { type Page, type Locator, expect } from '@playwright/test';

/**
 * "Your assignment is ready" confirmation modal.
 */
export class ConfirmationModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly readyHeading: Locator;
  readonly assignmentLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByRole('dialog');
    this.readyHeading = this.modal.getByRole('heading', {
      name: 'Your assignment is ready',
    });
    // Confirmed against real DOM: the link is exposed as a disabled,
    // read-only textbox (value attribute, not href) next to a "Copy link"
    // button — not an anchor. It is the only textbox in this dialog.
    this.assignmentLink = this.modal.getByRole('textbox');
  }

  async expectReady(): Promise<void> {
    await expect(this.readyHeading).toBeVisible();
  }

  /**
   * Captures the assignment link, asserts it is a well-formed URL,
   * and prints it (assessment requirement).
   */
  async captureAndPrintAssignmentLink(): Promise<string> {
    const value = await this.assignmentLink.inputValue();

    expect(value, 'Assignment link should be present in the modal').toBeTruthy();
    expect(() => new URL(value)).not.toThrow();

    console.log(`\n✅ Assignment link: ${value}\n`);
    return value;
  }
}
