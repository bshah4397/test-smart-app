import type { PatientResource } from "./patientSummary";

export type PatientContextSource = "smart" | "demo";

export type LoadedPatientContext = {
  source: PatientContextSource;
  patient: PatientResource;
  serverUrl?: string;
  patientId?: string | null;
  fhirUser?: string | null;
  scope?: string;
};

export type SmartLaunchSettings = {
  clientId: string;
  scope: string;
  redirectUri: string;
  launchEndpoint: string;
};

const DEFAULT_CLIENT_ID = "my_web_app";
const DEFAULT_SCOPE = "launch patient/Patient.r user/Patient.r openid fhirUser";

export function getSmartLaunchSettings(): SmartLaunchSettings {
  return {
    clientId: import.meta.env.VITE_SMART_CLIENT_ID ?? DEFAULT_CLIENT_ID,
    scope: import.meta.env.VITE_SMART_SCOPE ?? DEFAULT_SCOPE,
    redirectUri: window.location.origin + "/api/smart/callback",
    launchEndpoint: window.location.origin + "/api/smart/launch"
  };
}

export function hasSmartLaunchQuery(search = window.location.search): boolean {
  const params = new URLSearchParams(search);

  return params.has("iss") || params.has("launch");
}

export function hasSmartCallbackQuery(search = window.location.search): boolean {
  const params = new URLSearchParams(search);

  return params.get("smart") === "1" || params.has("smart_error");
}

export function getSmartCallbackError(search = window.location.search): string | null {
  const params = new URLSearchParams(search);

  return params.get("smart_error");
}

export async function authorizeSmartLaunch(): Promise<void> {
  const launchUrl = new URL("/api/smart/launch", window.location.origin);
  launchUrl.search = window.location.search;
  window.location.assign(launchUrl.toString());
}

export async function readSmartPatientContext(): Promise<LoadedPatientContext> {
  const response = await fetch("/api/patient-context", {
    headers: { Accept: "application/json" }
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Unable to load SMART session (${response.status}).`));
  }

  if (!isLoadedPatientContext(payload)) {
    throw new Error("No active SMART session.");
  }

  return payload as LoadedPatientContext;
}

export function getErrorMessage(error: unknown, fallback = "Unable to load patient context."): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "error" in error) {
    const message = (error as { error?: unknown }).error;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function isLoadedPatientContext(payload: unknown): payload is LoadedPatientContext {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { source?: unknown }).source === "smart" &&
    typeof (payload as { patient?: unknown }).patient === "object" &&
    (payload as { patient?: unknown }).patient !== null
  );
}
