import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Assignments dashboard — entry point to the creation flow.
 */
export class AssignmentsPage {
  readonly page: Page;
  readonly createAssignmentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Confirmed against real DOM: this is an <a role="link"> to
    // /editor?action=createAssignment, not a <button> — it navigates the
    // page, and the 5-step wizard opens as a `dialog` on the resulting page.
    this.createAssignmentButton = page.getByRole('link', { name: 'Create Assignment' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.createAssignmentButton).toBeVisible();
  }

  async openCreateAssignmentModal(): Promise<void> {
    await this.createAssignmentButton.click();
  }
}
