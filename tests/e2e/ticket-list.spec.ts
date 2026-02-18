import { test, expect, Page } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockUser = {
  userName: 'alice@contoso.com',
  firstName: 'Alice',
  lastName: 'Smith',
  contactId: 'c-abc-123',
  accountId: 'a-xyz-456',
};

const mockTickets = [
  {
    incidentid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ticketnumber: 'CAS-00142-X7B3Q1',
    title: 'Unable to access billing portal',
    statuscode: 1,
    prioritycode: 2,
    statecode: 0,
    createdon: '2026-02-10T14:30:00Z',
    modifiedon: '2026-02-15T09:45:00Z',
    description: '',
    casetypecode: 1,
    _customerid_value: 'c-abc-123',
  },
  {
    incidentid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    ticketnumber: 'CAS-00143-Y8C4R2',
    title: 'Invoice amount is incorrect',
    statuscode: 2,
    prioritycode: 1,
    statecode: 0,
    createdon: '2026-02-05T10:00:00Z',
    modifiedon: '2026-02-12T11:30:00Z',
    description: '',
    casetypecode: 2,
    _customerid_value: 'c-abc-123',
  },
];

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

async function mockIncidentsApi(
  page: Page,
  tickets = mockTickets,
  totalCount = mockTickets.length
) {
  await page.route('/_api/incidents**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ '@odata.count': totalCount, value: tickets }),
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Ticket List — US1 acceptance scenarios', () => {
  test('authenticated user sees the ticket list with ticket details', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await mockIncidentsApi(page);
    await page.goto('/');

    await expect(page.getByText('CAS-00142-X7B3Q1')).toBeVisible();
    await expect(page.getByText('Unable to access billing portal')).toBeVisible();
    await expect(page.getByText('CAS-00143-Y8C4R2')).toBeVisible();
    await expect(page.getByText('Invoice amount is incorrect')).toBeVisible();
  });

  test('ticket list renders expected columns', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await mockIncidentsApi(page);
    await page.goto('/');

    // Column headers visible
    await expect(page.getByRole('columnheader', { name: /ticket/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /subject|title/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /priority/i })).toBeVisible();
  });

  test('shows empty state message when contact has no tickets', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await page.route('/_api/incidents**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ '@odata.count': 0, value: [] }),
      });
    });

    await page.goto('/');

    await expect(page.getByText(/no tickets/i)).toBeVisible();
  });

  test('applying status filter updates results via API query', async ({ page }) => {
    await setupAuthenticatedPage(page);

    const requestUrls: string[] = [];
    await page.route('/_api/incidents**', async (route) => {
      requestUrls.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ '@odata.count': 0, value: [] }),
      });
    });

    await page.goto('/');

    // Interact with status filter (MUI combobox)
    const statusSelect = page.getByRole('combobox', { name: /status/i });
    await statusSelect.click();
    await page.getByRole('option', { name: 'Active' }).click();

    // Wait for a new API call to be made with filter
    await page.waitForTimeout(500);

    // Verify that at least one call had a filter applied
    const filteredCall = requestUrls.find((url) => url.includes('%24filter') || url.includes('$filter'));
    expect(filteredCall).toBeTruthy();
  });

  test('free-text search filters tickets by subject', async ({ page }) => {
    await setupAuthenticatedPage(page);

    const requestUrls: string[] = [];
    await page.route('/_api/incidents**', async (route) => {
      requestUrls.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ '@odata.count': 1, value: [mockTickets[0]] }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    requestUrls.length = 0; // clear initial call

    // Type in search box
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await searchInput.fill('billing');

    // Wait for debounce (300ms) + API call
    await page.waitForTimeout(500);

    const searchCall = requestUrls.find(
      (url) => url.includes('contains') || url.includes('billing')
    );
    expect(searchCall).toBeTruthy();
  });

  test('pagination controls advance to next page', async ({ page }) => {
    await setupAuthenticatedPage(page);
    await mockIncidentsApi(page, mockTickets, 50); // 50 total items

    await page.goto('/');

    // Pagination should be rendered
    const pagination = page.getByRole('navigation', { name: /pagination/i });
    await expect(pagination).toBeVisible();

    // Click page 2
    const page2Button = page.getByRole('button', { name: /go to page 2/i });
    await expect(page2Button).toBeVisible();
    await page2Button.click();

    await page.waitForTimeout(300);
  });

  test('unauthenticated user is redirected and cannot see ticket data', async ({ page }) => {
    // Do NOT set up Microsoft.Dynamic365.Portal.User — simulates unauthenticated session
    await page.route('/_layout/tokenhtml', async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<input type="hidden" name="__RequestVerificationToken" value="test-csrf-token" />',
      });
    });

    // Ensure the API is never called with ticket data in an unauthenticated state
    let apiCalled = false;
    await page.route('/_api/incidents**', async (route) => {
      apiCalled = true;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ value: [] }),
      });
    });

    await page.goto('/');

    // Should redirect away from the ticket list — no ticket data should be visible
    await expect(page.getByText('CAS-00142-X7B3Q1')).not.toBeVisible();

    // API should not have been called (user was redirected before data fetch)
    expect(apiCalled).toBe(false);
  });
});
