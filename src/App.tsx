import { useEffect, useMemo, useState } from "react";
import { demoPatient } from "./demoPatient";
import { PatientTable } from "./PatientTable";
import {
  authorizeSmartLaunch,
  getFhirDebugDetails,
  getErrorMessage,
  getSmartCallbackError,
  getSmartLaunchSettings,
  getSmartSessionDetails,
  hasSmartCallbackQuery,
  hasSmartLaunchQuery,
  type FhirDebugDetails,
  type LoadedPatientContext,
  type SmartSessionDetails,
  readSmartPatientContext
} from "./smartClient";
import { summarizePatientResource } from "./patientSummary";

type AppState =
  | { status: "loading" }
  | { status: "ready"; context: LoadedPatientContext }
  | {
      status: "error";
      message: string;
      smartSession?: SmartSessionDetails;
      fhirDebug?: FhirDebugDetails;
    };

const demoContext: LoadedPatientContext = {
  source: "demo",
  patient: demoPatient,
  serverUrl: "Demo data",
  patientId: demoPatient.id,
  fhirUser: null,
  scope: "Demo patient context"
};

function LaunchRoute() {
  const [message, setMessage] = useState("Preparing SMART launch...");
  const settings = getSmartLaunchSettings();
  const canLaunch = hasSmartLaunchQuery();

  useEffect(() => {
    if (!canLaunch) {
      setMessage("Open this route from a SMART launcher with iss and launch parameters.");
      return;
    }

    authorizeSmartLaunch().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "SMART launch failed.");
    });
  }, [canLaunch]);

  return (
    <main className="app-shell">
      <section className="status-panel">
        <p className="eyebrow">SMART launch</p>
        <h1>{message}</h1>
        <dl className="meta-grid">
          <div>
            <dt>Client ID</dt>
            <dd>{settings.clientId}</dd>
          </div>
          <div>
            <dt>Redirect URI</dt>
            <dd>{settings.redirectUri}</dd>
          </div>
          <div>
            <dt>Launch endpoint</dt>
            <dd>{settings.launchEndpoint}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{settings.scope}</dd>
          </div>
        </dl>
        {!canLaunch ? (
          <a className="primary-link" href="/?demo=true">
            View demo patient
          </a>
        ) : null}
      </section>
    </main>
  );
}

function ContextDetails({ context }: { context: LoadedPatientContext }) {
  const patientSummary = useMemo(
    () => summarizePatientResource(context.patient),
    [context.patient]
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SMART on FHIR sample</p>
          <h1>Patient Context</h1>
        </div>
        <div className={`source-badge source-badge-${context.source}`}>
          {context.source === "smart" ? "SMART launch" : "Demo mode"}
        </div>
      </header>

      <section className="content-grid">
        <section className="patient-panel" aria-labelledby="patient-summary-title">
          <div className="section-heading">
            <p className="eyebrow">FHIR Patient</p>
            <h2 id="patient-summary-title">{patientSummary.name}</h2>
          </div>
          <PatientTable summary={patientSummary} />
        </section>

        <aside className="context-panel" aria-labelledby="launch-context-title">
          <div className="section-heading">
            <p className="eyebrow">Launch context</p>
            <h2 id="launch-context-title">Session</h2>
          </div>
          <dl className="meta-grid">
            <div>
              <dt>FHIR server</dt>
              <dd>{context.serverUrl ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Patient ID</dt>
              <dd>{context.patientId ?? "Not available"}</dd>
            </div>
            <div>
              <dt>FHIR user</dt>
              <dd>{context.fhirUser ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{context.scope ?? "Not available"}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <details className="raw-resource">
        <summary>Raw Patient resource</summary>
        <pre>{JSON.stringify(context.patient, null, 2)}</pre>
      </details>
    </main>
  );
}

function SmartSessionDiagnostics({ smartSession }: { smartSession: SmartSessionDetails }) {
  return (
    <div className="session-debug" aria-label="SMART session diagnostics">
      <p className="eyebrow">SMART session from server</p>
      <dl className="meta-grid">
        <div>
          <dt>FHIR server</dt>
          <dd>{smartSession.serverUrl ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Patient ID</dt>
          <dd>{smartSession.patientId ?? "Not available"}</dd>
        </div>
        <div>
          <dt>FHIR user</dt>
          <dd>{smartSession.fhirUser ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Granted scope</dt>
          <dd>{smartSession.scope ?? "Not returned by token response"}</dd>
        </div>
      </dl>
    </div>
  );
}

function FhirDebugDetailsView({ fhirDebug }: { fhirDebug: FhirDebugDetails }) {
  const statusText = [fhirDebug.response.status, fhirDebug.response.statusText]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="fhir-debug" aria-label="FHIR error diagnostics">
      <p className="eyebrow">FHIR request</p>
      <dl className="meta-grid">
        <div>
          <dt>Method</dt>
          <dd>{fhirDebug.request.method ?? "Not available"}</dd>
        </div>
        <div>
          <dt>URL</dt>
          <dd>{fhirDebug.request.url ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusText || "Not available"}</dd>
        </div>
      </dl>
      <details className="debug-resource" open>
        <summary>FHIR error response</summary>
        <pre>{JSON.stringify(fhirDebug.response.body ?? {}, null, 2)}</pre>
      </details>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const isLaunchRoute = window.location.pathname === "/launch";

  useEffect(() => {
    if (isLaunchRoute) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      setState({ status: "ready", context: demoContext });
      return;
    }

    const smartCallbackError = getSmartCallbackError();
    const isSmartCallback = hasSmartCallbackQuery();

    if (smartCallbackError) {
      setState({ status: "error", message: smartCallbackError });
      return;
    }

    readSmartPatientContext()
      .then((context) => setState({ status: "ready", context }))
      .catch((error: unknown) => {
        if (isSmartCallback) {
          setState({
            status: "error",
            message: getErrorMessage(error),
            smartSession: getSmartSessionDetails(error),
            fhirDebug: getFhirDebugDetails(error)
          });
          return;
        }

        setState({ status: "ready", context: demoContext });
      });
  }, [isLaunchRoute]);

  if (isLaunchRoute) {
    return <LaunchRoute />;
  }

  if (state.status === "loading") {
    return (
      <main className="app-shell">
        <section className="status-panel">
          <p className="eyebrow">SMART on FHIR sample</p>
          <h1>Loading patient context...</h1>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="app-shell">
        <section className="status-panel status-panel-error">
          <p className="eyebrow">SMART on FHIR sample</p>
          <h1>Unable to load patient context</h1>
          <p>{state.message}</p>
          {state.smartSession ? (
            <SmartSessionDiagnostics smartSession={state.smartSession} />
          ) : null}
          {state.fhirDebug ? <FhirDebugDetailsView fhirDebug={state.fhirDebug} /> : null}
          <a className="primary-link" href="/?demo=true">
            View demo patient
          </a>
        </section>
      </main>
    );
  }

  return <ContextDetails context={state.context} />;
}
