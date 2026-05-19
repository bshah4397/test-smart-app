# Athena SMART Skeleton Prompt Notes

These notes explain the reasoning behind `athena-smart-skeleton.prompt.md`. They are not meant to be pasted into an LLM as the build prompt.

## Goal

The goal is to create a reusable athenahealth SMART on FHIR skeleton prompt that produces a predictable React app with minimal setup friction.

The generated app should be useful as a starting point for different athena SMART use cases. Patient Context is included as the first reference module because it proves that launch, token exchange, session handling, and FHIR reads are wired correctly.

## Why Athenahealth-Only

The prompt intentionally targets athenahealth preview only. Generic SMART on FHIR prompts leave too much room for the model to choose incompatible assumptions.

The athena-specific details that matter:

- Preview FHIR issuer/base URL is typically `https://api.preview.platform.athenahealth.com/fhir/r4`.
- OAuth endpoints are under `https://api.preview.platform.athenahealth.com/oauth2/v1`.
- The first create-app screen should use `My app will use Certified APIs ONLY`.
- The app category should be `3-Legged OAuth for Providers`.
- App registration uses FHIR R4 SMART V2 scopes.
- Browser/public app registration uses PKCE and token authentication method `none`.
- Practice entitlement matters. A client can complete OAuth and still fail resource reads if the launched practice is not available to that app builder/client.

## Athena Developer Portal Create-App Choices

The prompt now includes the first-screen choices from the athena developer portal because these choices affect what later app-detail fields and scope options are shown.

For this skeleton, the intended choices are:

```text
API Access: My app will use Certified APIs ONLY
App Category: 3-Legged OAuth for Providers
```

The portal may also show a `System or Provider-Facing ONC Certified App` confirmation for certified provider-facing apps.

That checkbox has certification/legal meaning. The prompt should not tell every user to blindly confirm it. It should tell the generated README to follow the user's actual certification status and only confirm if accurate for that app.

## Why Vercel Serverless Functions

The original browser-only React approach hit CORS during token exchange:

```text
POST https://api.preview.platform.athenahealth.com/oauth2/v1/token
blocked by CORS policy
```

Moving the token exchange into Vercel Serverless Functions avoids browser CORS and keeps the authorization code exchange server-side.

The intended architecture is:

```text
athenaOne iframe
  -> /api/smart/launch
  -> athena authorize
  -> /api/smart/callback
  -> server-side token exchange
  -> encrypted httpOnly session cookie
  -> React app calls /api/patient-context
  -> server-side FHIR Patient read
```

This is not a pure static SPA. It is a Vite React frontend plus Vercel API routes.

## Why Not Next.js or Express

The target audience includes people who may not be deeply comfortable with deployment details.

Vercel API routes keep the deployment path simple:

```text
GitHub repo -> Vercel import -> deploy
```

No custom server process is needed. No Express server is needed. Next.js is also unnecessary for this skeleton and would introduce decisions that do not help the SMART flow.

## Why No Environment Variables

For a production app, secrets and environment-specific values should be configured outside source code.

For this learning/demo skeleton, the priority is low-friction setup for non-dev or less-dev-heavy users. Vercel environment variables create one more deployment concept to teach.

The client ID and scopes are not secrets:

```text
Client ID: public OAuth client identifier
Scopes: public OAuth request values
```

So the prompt uses:

```ts
ATHENA_CLIENT_ID = "<REPLACE_WITH_ATHENA_CLIENT_ID>";
SMART_SCOPES = "launch patient/Patient.r user/Patient.r openid fhirUser";
```

The one caveat is cookie encryption. A hardcoded cookie key is not production-secure. The prompt explicitly allows it only as a demo-only key and requires the generated app to label it that way.

## Why Server-Side Cookies

The app needs to preserve PKCE and session state across redirects.

The launch transaction needs:

- state
- code verifier
- issuer
- launch token
- redirect URI
- token endpoint

The session needs:

- access token
- token type
- patient ID
- FHIR server URL
- granted scope
- fhirUser
- expiry

These should not live in browser-readable local storage. The prompt requires encrypted `httpOnly` cookies.

## Embedded athenaOne Cookie Caveat

athena launches the app inside an embedded athenaOne frame. That means the app domain is operating in a cross-site iframe context.

The first working implementation used `SameSite=Lax`, which caused the callback to lose the launch cookie and fail with:

```text
SMART launch session has expired.
```

For HTTPS deployments, the launch/session cookies need:

```text
SameSite=None
Secure
Partitioned
HttpOnly
```

`Partitioned` helps with modern browser third-party cookie restrictions in embedded contexts. Unsupported browsers should ignore it.

## Why Developer Details Are Hidden

During debugging, it was very useful to print:

- FHIR server
- patient ID
- FHIR user
- granted scope
- failed FHIR request URL/status
- OperationOutcome response

But a normal demo screen should not be dominated by diagnostics.

The prompt requires developer diagnostics behind `<details>`. On a successful launch, the UI stays clean. On errors, the technical context remains available for troubleshooting.

The prompt also requires that these values never be rendered:

- access tokens
- refresh tokens
- authorization codes
- PKCE code verifiers
- encrypted cookie values
- raw cookies

## Why Patient Context Is the Reference Module

Patient Context is the smallest useful end-to-end SMART app behavior:

1. athena launches with patient context.
2. App exchanges the authorization code.
3. Token response provides a patient ID.
4. App reads `Patient/{id}`.
5. UI renders the selected patient.

It proves the skeleton works without introducing more clinical logic.

The prompt frames Patient Context as a reference module, not the whole product. Future modules should reuse the same SMART session and server-side FHIR fetch pattern.

## Known Athena Troubleshooting From This Exercise

### Browser Token Exchange CORS

Symptom:

```text
Access to fetch at 'https://api.preview.platform.athenahealth.com/oauth2/v1/token'
from origin '<app-domain>' has been blocked by CORS policy
```

Cause:

The app attempted token exchange from browser JavaScript.

Fix:

Move token exchange to Vercel Serverless Functions.

### Lost Launch Cookie In Embedded Callback

Symptom:

```text
/?smart=1&smart_error=SMART%20launch%20session%20has%20expired.
```

Cause:

The callback did not receive the launch transaction cookie in the embedded athenaOne context.

Fix:

Use embedded-safe HTTPS cookie attributes:

```text
SameSite=None; Secure; Partitioned
```

### 403 Invalid Client

Symptom:

The app completed OAuth and received patient context, but `GET /fhir/r4/Patient/{id}` failed:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "fatal",
      "code": "forbidden",
      "details": {
        "text": "Invalid Client"
      }
    }
  ]
}
```

Cause found in this exercise:

The app builder/client was not entitled for the launched practice `432`.

Working practice:

```text
195900
```

Takeaway:

Scopes can be correct and OAuth can succeed, but athena practice entitlement can still block FHIR resource reads.

### fhirUser Can Be Organization

In the working and failing provider launch tests, `fhirUser` resolved to an `Organization/...Org-ATHENA` URL rather than a Practitioner URL.

This was not the blocker. The actual blocker was practice entitlement.

The skeleton should display `fhirUser` as returned, without assuming it is always a Practitioner.

## Minimal Tests Rationale

The prompt requires thin smoke tests, not exhaustive production test coverage.

For an AI-generated bootstrap skeleton, tests mainly act as guardrails against breaking the core flow:

- authorize URL construction
- launch cookie behavior
- callback token exchange
- patient context FHIR read
- React success rendering
- React error diagnostics

Production apps should expand coverage, but this skeleton should avoid becoming test-heavy boilerplate.

## Current Recommended Scope

Use:

```text
launch patient/Patient.r user/Patient.r openid fhirUser
```

This was sufficient for the working Patient Context skeleton when launched from an entitled athena preview practice.

## What The Prompt Intentionally Does Not Solve

The prompt does not make the generated app production-secure.

It does not implement refresh token rotation.

It does not implement multi-user durable server-side session storage.

It does not implement write scopes.

It does not abstract every FHIR resource.

It does not support non-athena SMART servers.

Those are valid future production concerns, but not part of the low-friction athena SMART skeleton.
