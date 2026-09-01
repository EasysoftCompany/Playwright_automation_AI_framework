import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AssignmentsPage } from '../pages/AssignmentsPage';
import { CreateAssignmentModal } from '../pages/CreateAssignmentModal';
import { ConfirmationModal } from '../pages/ConfirmationModal';

/**
 * Custom fixtures: page objects injected into tests, plus a `loggedIn`
 * fixture so tests start authenticated without repeating login steps.
 */
type Fixtures = {
  loginPage: LoginPage;
  assignmentsPage: AssignmentsPage;
  createModal: CreateAssignmentModal;
  confirmationModal: ConfirmationModal;
  loggedIn: void;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  assignmentsPage: async ({ page }, use) => use(new AssignmentsPage(page)),
  createModal: async ({ page }, use) => use(new CreateAssignmentModal(page)),
  confirmationModal: async ({ page }, use) => use(new ConfirmationModal(page)),

  loggedIn: async ({ loginPage, assignmentsPage }, use) => {
    const username = process.env.NEWSELA_USERNAME;
    const password = process.env.NEWSELA_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing NEWSELA_USERNAME / NEWSELA_PASSWORD. Copy .env.example to .env and fill in credentials.',
      );
    }
    await loginPage.goto();
    await loginPage.login(username, password);
    await assignmentsPage.expectLoaded();
    await use();
  },
});

export { expect } from '@playwright/test';

/** Test data for Step 3 prompt scenarios (see TEST_PLAN.md §4). */
export const prompts = {
  valid:
    'After reading the article, explain how the main character changed and support your answer with two details from the text.',
  whitespaceOnly: '   \n\t  ',
  multiline:
    'Paragraph one of the prompt.\n\nParagraph two with a second question for students.',
  unicode:
    '¿Cómo cambió el personaje? Explícalo con detalles. 日本語テスト — émojis: 📚✏️',
  xssPayload: '<script>alert("xss")</script> Explain the article\'s main idea.',
  longText: 'Explain your reasoning. '.repeat(500), // ~12,000 chars
} as const;
