# Signed-in E2E tests with real Chrome profiles

These tests run Playwright against **two real Chrome user-data-dir profiles**:

- `CUSTOMER_CHROME_PROFILE` — already signed in as a normal customer
- `ADMIN_CHROME_PROFILE` — already signed in as a Firebase user with the `admin: true` custom claim

The tests never type passwords or handle OAuth popups; they reuse whatever session is already stored in the profile.

## What is covered

| Spec | What it does |
|------|--------------|
| `signed-in-smoke.spec.ts` | Verifies customer account pages and admin console load for the signed-in users. Non-destructive. |
| `signed-in-lifecycle.spec.ts` | Customer places a COD order; admin finds it and advances `placed → processing → shipped → delivered`; customer confirms the delivered status. |

## One-time setup

### 1. Create or pick two Chrome profiles

The safest approach is to create **dedicated** profiles so your main browser session is not locked or modified.

1. Close all Chrome windows.
2. Open Chrome with a temporary profile path:
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\ChromeProfiles\Customer"
   ```
3. Sign in to `https://tresorcouture.in` as the **customer**.
4. Close Chrome completely.
5. Repeat for the **admin** profile:
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\ChromeProfiles\Admin"
   ```
6. Sign in as the **admin** user and close Chrome.

> If you already have a signed-in tab in your main profile (`sumanthbrb94`), you can copy that profile folder instead of creating new ones. Make sure Chrome is closed before copying.

### 2. Verify the admin user has the admin claim

```bash
npm run set-admin -- <admin-user-email>
```

Then sign the admin profile out and back in so the Firebase token refreshes with the claim.

### 3. Set environment variables

In PowerShell (run this in the same terminal before the npm command):

```powershell
$env:CUSTOMER_CHROME_PROFILE = "C:\ChromeProfiles\Customer"
$env:ADMIN_CHROME_PROFILE    = "C:\ChromeProfiles\Admin"
$env:BASE_URL               = "https://tresorcouture.in"
# $env:HEADLESS             = "1"   # uncomment to run without a visible browser
```

On bash/macOS/Linux:

```bash
export CUSTOMER_CHROME_PROFILE="/path/to/Customer"
export ADMIN_CHROME_PROFILE="/path/to/Admin"
export BASE_URL="https://tresorcouture.in"
# export HEADLESS=1
```

## Run the tests

```bash
# Both smoke + lifecycle
npm run test:e2e:signed-in

# Just smoke
npm run test:e2e:signed-in:smoke

# Just lifecycle
npm run test:e2e:signed-in:lifecycle
```

Or directly with Playwright:

```bash
npx playwright test tests/e2e/signed-in --project=signed-in-chrome --workers=1
```

## Important notes

- **Chrome must be closed** before the tests run. Chrome locks the profile while it is open, and Playwright will fail to launch a second instance using the same data dir.
- The tests launch each profile with `chromium.launchPersistentContext(...)`. They are isolated from your normal Chrome windows, but they use the same cookies/localStorage/IndexedDB stored in those directories.
- These tests target the production website (`https://tresorcouture.in`) by default. Do not point them at a local dev server — the lifecycle test creates a real order on the live site.
- If a session expires, the test will fail with a clear message telling you to sign in again and close Chrome.
