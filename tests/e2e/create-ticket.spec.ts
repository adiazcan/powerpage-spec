import { expect, test, Page } from '@playwright/test';

const mockUser = {
  userName: 'alice@contoso.com',
  firstName: 'Alice',
  lastName: 'Smith',
  contactId: 'c-abc-123',
  accountId: 'a-xyz-456',
};

async function setupAuthenticatedPage(page: Page) {
  await page.addInitScript((user) => {
    (window as unknown as Record<string, unknown>)['Microsoft'] = {
      Dynamic365: {
        Portal: {
          User: user,
        },
      },
    };
  }, mockUser);

  await page.route('/_layout/tokenhtml', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<input type="hidden" name="__RequestVerificationToken" value="test-csrf-token" />',
    });
  });
}

test.describe('Create Ticket — US3 acceptance scenarios', () => {
  test('successful creation shows confirmation and link to ticket detail', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents', async (route) => {
      await route.fulfill({
        status: 204,
        headers: {
          'OData-EntityId': 'https://example/_api/incidents(inc-123)',
        },
        body: '',
      });
    });

    await page.goto('/tickets/new');

    await page.getByLabel(/subject/i).fill('Cannot reset password');
    await page.getByLabel(/category/i).selectOption('1');
    await page.getByLabel(/description/i).fill('Reset flow fails repeatedly');
    await page.getByRole('button', { name: /submit ticket/i }).click();

    await expect(page).toHaveURL('/tickets/inc-123/confirm');
    await expect(page.getByText(/ticket created/i)).toBeVisible();

    const detailLink = page.getByRole('link', { name: /view ticket details/i });
    await expect(detailLink).toHaveAttribute('href', '/tickets/inc-123');
  });

  test('required field validation appears without submission', async ({ page }) => {
    await setupAuthenticatedPage(page);

    let createCalled = false;
    await page.route('/_api/incidents', async (route) => {
      createCalled = true;
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/tickets/new');
    await page.getByRole('button', { name: /submit ticket/i }).click();

    await expect(page.getByText(/subject is required/i)).toBeVisible();
    await expect(page.getByText(/category is required/i)).toBeVisible();
    await expect(page.getByText(/description is required/i)).toBeVisible();
    expect(createCalled).toBe(false);
  });

  test('file size and count constraints show errors', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.goto('/tickets/new');

    const attachmentInput = page.getByLabel(/attachments/i);

    await attachmentInput.setInputFiles([
      {
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('a'),
      },
      {
        name: 'b.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('b'),
      },
      {
        name: 'c.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('c'),
      },
      {
        name: 'd.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('d'),
      },
    ]);

    await expect(page.getByText(/maximum of 3 files/i)).toBeVisible();
  });

  test('confirmation link navigation to ticket detail route', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.goto('/tickets/inc-123/confirm', {
      waitUntil: 'domcontentloaded',
    });

    await page.getByRole('link', { name: /view ticket details/i }).click();
    await expect(page).toHaveURL('/tickets/inc-123');
  });

  test('network error shows banner and preserves entered form data', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Server unavailable' } }),
      });
    });

    await page.goto('/tickets/new');

    const subject = page.getByLabel(/subject/i);
    const description = page.getByLabel(/description/i);

    await subject.fill('Cannot reset password');
    await page.getByLabel(/category/i).selectOption('1');
    await description.fill('Reset flow fails repeatedly');
    await page.getByRole('button', { name: /submit ticket/i }).click();

    await expect(page.getByRole('alert')).toContainText(/server unavailable/i);
    await expect(subject).toHaveValue('Cannot reset password');
    await expect(description).toHaveValue('Reset flow fails repeatedly');
  });
});
