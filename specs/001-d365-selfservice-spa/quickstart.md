# Quickstart: Customer Self-Service SPA for Dynamics 365

**Branch**: `001-d365-selfservice-spa` | **Date**: February 18, 2026

## Prerequisites

1. **Node.js** v18+ and npm v9+
2. **Power Platform CLI (PAC CLI)** v1.44.x or later, authenticated
3. **Power Pages environment** with site version 9.7.4.x or later
4. **Dynamics 365 Customer Service** provisioned with Case, Contact, and Account tables
5. **Microsoft Entra ID** identity provider configured for the Power Pages site

## 1. Clone & Install

```bash
git clone <repo-url>
cd powerpage-spec
npm install
```

## 2. Configure Power Pages Environment

### 2.1 Allow JavaScript file uploads

1. Go to [Power Platform admin center](https://admin.powerplatform.microsoft.com/)
2. Select your environment → Settings → Product → Privacy + Security
3. Remove `js` from the Blocked Attachments list
4. Save

### 2.2 Enable Web API for required tables

Add the following **site settings** in Power Pages (make.powerpages.microsoft.com → your site → Edit → … → Site Settings, or via Portal Management app):

| Setting | Value |
|---------|-------|
| `Webapi/incident/enabled` | `true` |
| `Webapi/incident/fields` | `ticketnumber,title,description,statuscode,prioritycode,createdon,modifiedon,statecode,casetypecode,customerid` |
| `Webapi/annotation/enabled` | `true` |
| `Webapi/annotation/fields` | `filename,mimetype,documentbody,notetext,subject,objectid,isdocument,createdon` |
| `Webapi/activitypointer/enabled` | `true` |
| `Webapi/activitypointer/fields` | `subject,description,activitytypecode,createdon,regardingobjectid` |

### 2.3 Configure table permissions

In Power Pages Design Studio → Security → Table Permissions:

| Table | Access Type | Scope | Web Roles |
|-------|------------|-------|-----------|
| Case (incident) | Read, Create | Contact | Authenticated Users |
| Annotation | Read, Create | Parent (Case) | Authenticated Users |
| Activity | Read | Parent (Case) | Authenticated Users |

If account-level ticket visibility is desired, add a second table permission for Case with Account scope.

### 2.4 Configure identity provider

1. Go to Power Pages → your site → Edit → Security → Identity providers
2. Configure Microsoft Entra ID for enterprise SSO (B2B)
3. The default Entra ID provider is auto-created; configure tenant and redirect URIs

## 3. Local Development

### 3.1 Configure Vite proxy

Update `vite.config.ts` with your Power Pages site URL:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/_api': {
        target: 'https://<your-site>.powerappsportals.com',
        changeOrigin: true,
        secure: true
      },
      '/_layout': {
        target: 'https://<your-site>.powerappsportals.com',
        changeOrigin: true,
        secure: true
      },
      '/Account': {
        target: 'https://<your-site>.powerappsportals.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
```

### 3.2 Enable bearer authentication (development only)

Add these site settings for local dev:

| Setting | Value |
|---------|-------|
| `Authentication/BearerAuthentication/Enabled` | `true` |
| `Authentication/BearerAuthentication/Protocol` | `OpenIdConnect` |
| `Authentication/BearerAuthentication/Provider` | `AzureAD` |

In Azure Portal, enable SPA authentication in the Entra app registration and add `http://localhost:5173/` as a redirect URI.

### 3.3 Start dev server

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

## 4. Run Tests

```bash
# Unit & component tests
npm run test

# E2E tests (requires running dev server or built site)
npm run test:e2e
```

## 5. Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory.

## 6. Deploy to Power Pages

```bash
# Authenticate (if not already)
pac auth create --environment <Environment URL>

# Upload site
pac pages upload-code-site --rootPath .
```

Then:
1. Go to [Power Pages](https://make.powerpages.microsoft.com/)
2. Select **Inactive sites** → find your site → **Reactivate**
3. Once active, navigate to the site URL to verify

Subsequent runs of `pac pages upload-code-site --rootPath .` automatically update the active site.

## 7. Validation Checklist

| # | Check | Pass? |
|---|-------|-------|
| 1 | Site loads and redirects unauthenticated users to login | PASS (local E2E) |
| 2 | After login, ticket list displays with correct columns | PASS (local E2E) |
| 3 | Ticket list sorts by most recently updated (default) | PASS (local service/component behavior) |
| 4 | Filters (status, priority, date range) work correctly | PASS (local E2E + unit) |
| 5 | Free-text search filters by ticket subject | PASS (local E2E + unit) |
| 6 | Clicking a ticket opens the detail view | PASS (local E2E) |
| 7 | Detail view shows timeline and attachments | PASS (local E2E) |
| 8 | Attachment download works | PASS (local E2E) |
| 9 | Back navigation preserves list state | PASS (local E2E) |
| 10 | Create ticket form validates required fields | PASS (local E2E + component) |
| 11 | File attachment validation (type, size, count) works | PASS (local E2E + unit) |
| 12 | Successful creation shows confirmation with ticket number | PASS (local E2E) |
| 13 | Confirmation link navigates to newly created ticket | PASS (local E2E) |
| 14 | Direct URL to unauthorized ticket shows error, no data | PASS (local E2E) |
| 15 | All transitions complete in <1s without full page reload | FAIL (not measured against deployed Power Pages site) |

## Project Configuration Files

### powerpages.config.json

```json
{
  "siteName": "Customer Self-Service Portal",
  "defaultLandingPage": "index.html",
  "compiledPath": "dist"
}
```

### Key npm scripts (package.json)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src/ --ext .ts,.tsx",
    "format": "prettier --write src/"
  }
}
```
