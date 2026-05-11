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

Register that as the launch URL and `http://127.0.0.1:5173/` as the redirect URL in a SMART sandbox or EHR developer environment.

Configuration lives in `.env`:

```bash
VITE_SMART_CLIENT_ID=my_web_app
VITE_SMART_SCOPE="launch/patient patient/Patient.r openid fhirUser"
```

Without a SMART authorization session, the app shows demo patient data so the UI can be reviewed locally.
