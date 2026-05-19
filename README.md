# SMART on FHIR Patient Context

A small React + TypeScript sample app that can be launched as a SMART on FHIR public client and display the selected patient context.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## SMART Launch

The SMART launch route is:

```text
http://127.0.0.1:5173/launch
```

For production athena registration, use the server-side SMART endpoints:

```text
Launch URL: https://your-domain.example/api/smart/launch
Post-login redirect URL: https://your-domain.example/api/smart/callback
Post-logout redirect URL: https://your-domain.example/logout-complete
```

The `/launch` route remains available as a local/compatibility route and forwards to `/api/smart/launch`.

Configuration lives in `.env`:

```bash
VITE_SMART_CLIENT_ID=0oa12kld7ldPx3bCw298
VITE_SMART_SCOPE="launch patient/Patient.r user/Patient.r openid fhirUser"
SMART_SESSION_SECRET=replace-with-a-long-random-value
```

`SMART_SESSION_SECRET` is server-only and is used to encrypt httpOnly launch/session cookies. Do not prefix it with `VITE_`.

Without a SMART authorization session, direct visits to `/` show demo patient data so the UI can be reviewed locally. SMART callback failures show an error instead of silently falling back to demo mode.
