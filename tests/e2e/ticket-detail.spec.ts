import { test, expect, Page } from '@playwright/test';

const mockUser = {
  userName: 'alice@contoso.com',
  firstName: 'Alice',
  lastName: 'Smith',
  contactId: 'c-abc-123',
  accountId: 'a-xyz-456',
};

const mockTicket = {
  incidentid: 'inc-123',
  ticketnumber: 'CAS-00142-X7B3Q1',
  title: 'Unable to access billing portal',
  description: 'Customer is unable to access billing portal due to login loop.',
  statuscode: 1,
  prioritycode: 2,
  statecode: 0,
  createdon: '2026-02-10T14:30:00Z',
  modifiedon: '2026-02-15T09:45:00Z',
  casetypecode: 1,
  _customerid_value: 'c-abc-123',
  _ownerid_value: 'owner-1',
  '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'Support Queue A',
};

const mockActivities = [
  {
    activityid: 'act-1',
    subject: 'Case opened',
    description: 'Customer reported issue',
    activitytypecode: 'email',
    createdon: '2026-02-10T14:30:00Z',
  },
];

const mockAnnotations = [
  {
    annotationid: 'ann-1',
    subject: 'Attachment',
    notetext: '',
    filename: 'error-log.txt',
    mimetype: 'text/plain',
    isdocument: true,
    createdon: '2026-02-10T15:00:00Z',
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

test.describe('Ticket Detail — US2 acceptance scenarios', () => {
  test('shows detail fields, timeline, and attachments', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents(inc-123)**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockTicket) });
    });
    await page.route('/_api/activitypointers**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ value: mockActivities }),
      });
    });
    await page.route('/_api/annotations**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ value: mockAnnotations }),
      });
    });

    await page.goto('/tickets/inc-123');

    await expect(page.getByText('CAS-00142-X7B3Q1')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Unable to access billing portal',
      })
    ).toBeVisible();
    await expect(page.getByText('Support Queue A')).toBeVisible();
    await expect(page.getByText('Case opened')).toBeVisible();
    await expect(page.getByText('error-log.txt')).toBeVisible();
  });

  test('downloads an attachment', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents(inc-123)**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockTicket) });
    });
    await page.route('/_api/activitypointers**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ value: [] }) });
    });
    let annotationDetailRequested = false;
    await page.route('/_api/annotations**', async (route) => {
      const url = decodeURIComponent(route.request().url());

      if (url.includes('/_api/annotations(ann-1)')) {
        annotationDetailRequested = true;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockAnnotations[0],
            documentbody: 'SGVsbG8=',
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ value: mockAnnotations }),
      });
    });

    await page.goto('/tickets/inc-123');

    await page.getByRole('button', { name: /download error-log.txt/i }).click();

    await expect
      .poll(() => annotationDetailRequested)
      .toBeTruthy();
  });

  test('back navigation returns to list route', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents**', async (route) => {
      const url = route.request().url();
      if (url.includes('/_api/incidents(inc-123)')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockTicket) });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ '@odata.count': 1, value: [mockTicket] }),
      });
    });

    await page.route('/_api/activitypointers**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ value: [] }) });
    });
    await page.route('/_api/annotations**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ value: [] }) });
    });

    await page.goto('/');
    await page.getByRole('link', { name: 'CAS-00142-X7B3Q1' }).click();
    await page.getByRole('button', { name: /back to tickets/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();
  });

  test('unauthorized direct URL shows error and no ticket data', async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route('/_api/incidents(inc-unauthorized)**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Forbidden' } }),
      });
    });

    await page.goto('/tickets/inc-unauthorized');

    await expect(page.getByRole('alert')).toContainText(/not authorized/i);
    await expect(page.getByText('CAS-00142-X7B3Q1')).not.toBeVisible();
  });
});