# Build an athenahealth SMART on FHIR React Skeleton

You are building a reusable athenahealth SMART on FHIR app skeleton. Build the project end to end.

## Inputs

Use these exact inputs unless the user edits them before running this prompt.

```ts
ATHENA_CLIENT_ID = "<REPLACE_WITH_ATHENA_CLIENT_ID>";
SMART_SCOPES = "launch patient/Patient.r user/Patient.r openid fhirUser";
ATHENA_FHIR_BASE_URL = "https://api.preview.platform.athenahealth.com/fhir/r4";
ATHENA_AUTHORIZATION_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize";
ATHENA_TOKEN_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/token";
DEPLOYMENT_TARGET = "Vercel";
```

If `ATHENA_CLIENT_ID` is still the placeholder, do not stop. Build the app anyway so the user can deploy it once, get a Vercel URL, register that URL in athenahealth, receive a real client ID, replace the placeholder, and redeploy.

If `ATHENA_CLIENT_ID` is filled in, do not ask setup questions. Build directly.

The generated app must detect the placeholder client ID and show a clear setup-required message instead of attempting a SMART launch.

## Bootstrap Flow

The generated README must explain this two-pass bootstrap flow:

1. Create or clone a GitHub repo.
2. Run this prompt in the repo with an AI coding tool.
3. Let the AI build the app using the placeholder client ID.
4. Push the generated app to GitHub.
5. Import/deploy the repo to Vercel.
6. Copy the Vercel production URL.
7. Create/register the app in the athenahealth developer portal using the Vercel URLs.
8. Copy the generated athenahealth client ID.
9. Replace `<REPLACE_WITH_ATHENA_CLIENT_ID>` in source code.
10. Commit, push, and let Vercel redeploy.
11. Launch the app from an entitled athena preview practice.

This ordering is required because athenahealth app registration asks for launch and redirect URLs before it gives the app a client ID.

## Non-Negotiable Architecture

Build a Vite + React + TypeScript frontend deployed on Vercel.

Use Vercel Serverless Functions under `/api` for all SMART OAuth server work.

Do not build a browser-only SMART app.

Do not perform token exchange from browser JavaScript.

Do not use `fhirclient` for browser-side token exchange.

Do not create an Express server.

Do not create a Next.js app.

Do not require `.env`, `.env.local`, or Vercel environment variables.

Do not ask the user to configure secrets.

Use a hardcoded demo-only cookie encryption key in source code. Name it clearly as demo-only and non-production.

Use constants in a source-controlled config module, for example `src/smartConfig.ts` and/or `api/_lib/smartConfig.ts`.

Never print or render access tokens, refresh tokens, authorization codes, PKCE code verifiers, encrypted cookie values, or raw cookies.

## athenahealth Registration Values

The generated README must tell the user to register the app in athenahealth preview with:

```text
Create New Application screen:
API Access: My app will use Certified APIs ONLY
App Category: 3-Legged OAuth for Providers
System or Provider-Facing ONC Certified App: follow the user's actual certification status; if the portal requires confirmation for this app type, tell the user to confirm only if accurate for their app.

App details / credentials screens:
Application type: Browser / public client
Authentication method: PKCE / token auth method none
FHIR version/API: FHIR R4 SMART V2
Launch URL: https://<vercel-domain>/api/smart/launch
Post-login redirect URL: https://<vercel-domain>/api/smart/callback
Post-logout redirect URL: https://<vercel-domain>/logout-complete
Scopes: launch patient/Patient.r user/Patient.r openid fhirUser
```

## Required Routes

Implement these routes exactly:

```text
GET /api/smart/launch
GET /api/smart/callback
GET /api/patient-context
GET /api/logout
GET /logout-complete
```

`/api/smart/launch` receives athena launch parameters, especially `iss` and `launch`.

`/api/smart/callback` receives `code` and `state`.

`/api/patient-context` returns the current launched patient context to the React app.

`/api/logout` clears app cookies and redirects to `/logout-complete`.

`/logout-complete` is a simple frontend route or static-compatible UI state that tells the user logout is complete.

## SMART OAuth Flow

Implement SMART public-client Authorization Code + PKCE.

On `/api/smart/launch`:

1. Validate that `iss` exists.
2. Read `launch` if present.
3. Generate a cryptographically random PKCE `code_verifier`.
4. Generate a `code_challenge` using SHA-256 and base64url encoding.
5. Generate a cryptographically random `state`.
6. Store launch transaction data server-side in an encrypted `httpOnly` cookie:
   - `state`
   - `code_verifier`
   - `iss`
   - `launch`
   - `redirect_uri`
   - token endpoint
   - timestamp
7. Redirect to athenahealth authorization endpoint with:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`
   - `scope`
   - `aud=iss`
   - `launch`
   - `state`
   - `code_challenge`
   - `code_challenge_method=S256`

Discover OAuth endpoints from:

```text
{iss}/.well-known/smart-configuration
```

If discovery fails, fall back to:

```text
Authorization endpoint: https://api.preview.platform.athenahealth.com/oauth2/v1/authorize
Token endpoint: https://api.preview.platform.athenahealth.com/oauth2/v1/token
```

On `/api/smart/callback`:

1. Read `code` and `state`.
2. Read and decrypt the launch transaction cookie.
3. Verify callback `state` matches stored `state`.
4. Exchange `code` for tokens server-side using the stored PKCE `code_verifier`.
5. Send the token request as `application/x-www-form-urlencoded`.
6. Include:
   - `grant_type=authorization_code`
   - `code`
   - `redirect_uri`
   - `client_id`
   - `code_verifier`
7. Create an encrypted `httpOnly` session cookie containing only what the app needs:
   - access token
   - token type
   - patient ID from token response or ID token
   - FHIR server URL
   - granted scope
   - fhirUser
   - expiry timestamp if available
8. Clear the launch transaction cookie.
9. Redirect to `/?smart=1`.

## Cookie Rules

Use encrypted `httpOnly` cookies for launch transaction and session state.

For HTTPS deployments, cookies must include:

```text
HttpOnly
Secure
SameSite=None
Partitioned
Path=/
```

For local HTTP development, cookies may use:

```text
HttpOnly
SameSite=Lax
Path=/
```

Set launch transaction cookie max age to about 10 minutes.

Set session cookie max age to about 1 hour.

Use AES-256-GCM or another authenticated encryption primitive available in Node.js standard libraries.

Use the hardcoded demo-only cookie key for encryption. Clearly label it:

```ts
// Demo only. Do not use this hardcoded key for production patient data.
```

## Patient Context Reference Module

Build the skeleton around a default reference module named Patient Context.

This module proves the SMART skeleton works but should not be framed as the only purpose of the app.

On successful launch, `/api/patient-context` must:

1. Read and decrypt the SMART session cookie.
2. Require a patient ID.
3. Call:

```text
GET {FHIR_SERVER}/Patient/{patientId}
```

4. Use:

```text
Accept: application/fhir+json, application/json
Authorization: Bearer <access_token>
```

5. Return JSON to the frontend:
   - `source: "smart"`
   - `patient`
   - `serverUrl`
   - `patientId`
   - `fhirUser`
   - `scope`

## Frontend UI Requirements

Build a clean React UI, not a landing page.

Default direct visits without an active SMART session may show demo patient data.

After a SMART callback, do not silently fall back to demo mode if patient context fails. Show an error.

Successful SMART launch screen:

1. Show a clear heading: `Patient Context`.
2. Show a badge or label: `SMART launch`.
3. Show a simple Patient table:
   - FHIR ID
   - name
   - gender
   - birth date
   - phone if present
4. Include collapsed `<details>` titled `Developer details`.
5. Inside developer details show:
   - FHIR server
   - patient ID
   - FHIR user
   - granted scope
   - raw Patient resource JSON

Error screen:

1. Show a clear heading: `Unable to load patient context`.
2. Show the user-facing error message.
3. Include `<details>` titled `Developer details`.
4. Inside developer details show, when available:
   - FHIR server
   - patient ID
   - FHIR user
   - granted scope
   - failed FHIR request method
   - failed FHIR request URL
   - failed FHIR response status
   - FHIR `OperationOutcome` or raw response body

Never display access tokens, refresh tokens, authorization codes, PKCE code verifiers, encrypted cookie values, or raw cookies.

## Error Handling Requirements

If the app is still configured with `<REPLACE_WITH_ATHENA_CLIENT_ID>`, do not redirect to athena authorization and do not attempt token exchange. Show a setup-required message that tells the user to:

```text
Deploy to Vercel first, register the Vercel URLs in athenahealth, copy the generated client ID, replace the placeholder in source code, and redeploy.
```

Handle these cases:

```text
Placeholder athena client ID
Missing iss on launch
Missing code on callback
Missing launch transaction cookie
State mismatch
Token exchange failure
Token response missing access token
Token response missing patient context
FHIR Patient read failure
No active SMART session
```

FHIR Patient read failures must return sanitized diagnostics from `/api/patient-context`, including:

```ts
{
  error: string,
  smartSession?: {
    source: "smart",
    patientId?: string | null,
    serverUrl?: string,
    fhirUser?: string | null,
    scope?: string,
    expiresAt?: number | null
  },
  fhirDebug?: {
    request: {
      method: "GET",
      url: string
    },
    response: {
      status: number,
      statusText: string,
      body: unknown
    }
  }
}
```

## Vercel Requirements

Include a `vercel.json` suitable for a Vite SPA with API routes.

The frontend should build to `dist`.

Use Vercel’s normal Vite detection when possible.

Do not require custom server startup.

Do not require Vercel environment variables.

Do not include `"type": "module"` in `package.json`.

Keep the package CommonJS-compatible for Vercel Serverless Functions so extensionless TypeScript imports in `/api` do not crash at runtime with `ERR_MODULE_NOT_FOUND`.

If any generated API helper imports are emitted as native ESM, relative imports must include the runtime `.js` extension. The preferred skeleton path is simpler: omit `"type": "module"` from `package.json`.

Include a root `.gitignore` with at least:

```text
node_modules
dist
.vercel
.env
.env.*
*.local
.DS_Store
```

## Minimal Tests

Add thin smoke tests. Do not overbuild coverage.

Tests should verify:

1. SMART authorize URL includes `client_id`, `scope`, `aud`, `launch`, `redirect_uri`, and PKCE challenge.
2. `/api/smart/launch` sets an embedded-safe `httpOnly` cookie on HTTPS requests.
3. `/api/smart/callback` exchanges code server-side and creates a session cookie.
4. `/api/patient-context` calls `Patient/{id}` using the bearer token from the server-side session.
5. React renders patient context returned by `/api/patient-context`.
6. React shows sanitized developer diagnostics on FHIR errors.

Use the project’s normal test framework. If starting from scratch, use Vitest and React Testing Library.

## README Requirements

Write a README that explains:

1. What this skeleton is.
2. How to replace the athena client ID placeholder.
3. The two-pass bootstrap flow:
   - build with placeholder client ID
   - deploy to Vercel
   - register Vercel URLs in athenahealth
   - replace placeholder client ID
   - redeploy
4. How to run locally.
5. How to deploy to Vercel.
6. Exact athenahealth preview registration URLs:
   - Launch URL
   - Post-login redirect URL
   - Post-logout redirect URL
7. Exact athenahealth create-app selections:
   - API Access: `My app will use Certified APIs ONLY`
   - App Category: `3-Legged OAuth for Providers`
   - CAPI confirmation: only confirm if accurate for the user's app/certification status
8. Required scopes.
9. Why no `.env` is required for this demo.
10. Why the hardcoded cookie key is demo-only and not production-safe.
11. Known athenahealth and Vercel troubleshooting:
   - Browser token exchange can fail because of CORS; token exchange must be server-side.
   - Embedded athenaOne launches require `SameSite=None; Secure; Partitioned` cookies.
   - A successful OAuth flow can still fail with `403 Invalid Client` if the app/client is not entitled for the launched practice.
   - For athena preview, external app builders may only be entitled for specific practices.
   - Vercel functions can crash with `ERR_MODULE_NOT_FOUND` if `package.json` has `"type": "module"` and serverless API files use extensionless relative imports. Omit `"type": "module"` for this skeleton.

## Final Verification

Before finishing:

1. Run the test suite.
2. Run the production build.
3. Report the commands run and whether they passed.
4. List created or changed files.
5. Do not claim the app is production-secure. This is a demo skeleton with a hardcoded cookie key.
