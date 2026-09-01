import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Login surface for everwrite.app.newsela.com.
 *
 * `/assignments` redirects unauthenticated users through an OAuth-style hop
 * to `app.newsela.com/signin` — the real sign-in form lives on that origin,
 * not on the app's own domain. Confirmed against the real DOM.
 *
 * The username/password fields have no programmatically-associated <label>;
 * their visible "Username"/"Password" text sits next to a "Required" badge,
 * and both combine into the field's accessible name ("Username Required"),
 * not the field's own label text. getByLabel() does not resolve them.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByRole('textbox', { name: 'Username Required' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password Required' });
    // exact: true — "Sign in" is a substring of the unrelated "Sign in
    // through another LMS" accordion toggle also present on this page.
    this.signInButton = page.getByRole('button', { name: 'Sign in', exact: true });
    // Scoped by text: the page also renders an empty top-level `alert` role
    // (a generic live-region placeholder) alongside the one that actually
    // carries the validation copy — filtering picks the populated one.
    this.errorMessage = page
      .getByRole('alert')
      .filter({ hasText: /check your username or password/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/assignments');
    await this.dismissCookieConsent();
    // Mitigation for a discovered product defect, not a UI wait: the form
    // intermittently submits as a native GET before its JS submit handler
    // attaches, putting the password in the URL query string in plaintext
    // (browser history, server access logs, Referer headers). Settling on
    // network-idle reduces the race; it does not eliminate it — see the
    // security discovery filed in TEST_PLAN.md.
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /**
   * A "Your Privacy Choices" cookie-consent dialog covers the sign-in form
   * on a fresh browser profile (confirmed against real DOM: Playwright's
   * isolated test context hits it every run). Until it is dismissed, the
   * username/password fields' accessible names never resolve, hanging any
   * role-based locator. Bounded wait via click(), not a sleep — a returning
   * session with the preference already stored simply won't render it, so
   * the timeout is swallowed rather than treated as a failure.
   */
  private async dismissCookieConsent(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Close' })
      .click({ timeout: 8_000 })
      .catch(() => {});
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectLoginError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }
}
