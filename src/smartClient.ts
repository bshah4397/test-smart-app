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

export type SmartSessionDetails = {
  source: "smart";
  serverUrl?: string;
  patientId?: string | null;
  fhirUser?: string | null;
  scope?: string;
  expiresAt?: number | null;
};

export type FhirDebugDetails = {
  request: {
    method?: string;
    url?: string;
  };
  response: {
    status?: number;
    statusText?: string;
    body?: unknown;
  };
};

export type SmartLaunchSettings = {
  clientId: string;
  scope: string;
  redirectUri: string;
  launchEndpoint: string;
};

export class SmartPatientContextError extends Error {
  smartSession?: SmartSessionDetails;
  fhirDebug?: FhirDebugDetails;

  constructor(
    message: string,
    smartSession?: SmartSessionDetails,
    fhirDebug?: FhirDebugDetails
  ) {
    super(message);
    this.name = "SmartPatientContextError";
    this.smartSession = smartSession;
    this.fhirDebug = fhirDebug;
  }
}

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
    throw new SmartPatientContextError(
      getErrorMessage(payload, `Unable to load SMART session (${response.status}).`),
      getSmartSessionDetailsFromPayload(payload),
      getFhirDebugDetailsFromPayload(payload)
    );
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

export function getSmartSessionDetails(error: unknown): SmartSessionDetails | undefined {
  if (error instanceof SmartPatientContextError) {
    return error.smartSession;
  }

  if (typeof error === "object" && error !== null && "smartSession" in error) {
    return normalizeSmartSessionDetails((error as { smartSession?: unknown }).smartSession);
  }

  return undefined;
}

export function getFhirDebugDetails(error: unknown): FhirDebugDetails | undefined {
  if (error instanceof SmartPatientContextError) {
    return error.fhirDebug;
  }

  if (typeof error === "object" && error !== null && "fhirDebug" in error) {
    return normalizeFhirDebugDetails((error as { fhirDebug?: unknown }).fhirDebug);
  }

  return undefined;
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

function getSmartSessionDetailsFromPayload(payload: unknown): SmartSessionDetails | undefined {
  if (typeof payload !== "object" || payload === null || !("smartSession" in payload)) {
    return undefined;
  }

  return normalizeSmartSessionDetails((payload as { smartSession?: unknown }).smartSession);
}

function getFhirDebugDetailsFromPayload(payload: unknown): FhirDebugDetails | undefined {
  if (typeof payload !== "object" || payload === null || !("fhirDebug" in payload)) {
    return undefined;
  }

  return normalizeFhirDebugDetails((payload as { fhirDebug?: unknown }).fhirDebug);
}

function normalizeSmartSessionDetails(value: unknown): SmartSessionDetails | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const details = value as Record<string, unknown>;

  if (details.source !== "smart") {
    return undefined;
  }

  return {
    source: "smart",
    serverUrl: stringOrUndefined(details.serverUrl),
    patientId:
      typeof details.patientId === "string" || details.patientId === null
        ? details.patientId
        : undefined,
    fhirUser:
      typeof details.fhirUser === "string" || details.fhirUser === null
        ? details.fhirUser
        : undefined,
    scope: stringOrUndefined(details.scope),
    expiresAt:
      typeof details.expiresAt === "number" || details.expiresAt === null
        ? details.expiresAt
        : undefined
  };
}

function normalizeFhirDebugDetails(value: unknown): FhirDebugDetails | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const details = value as Record<string, unknown>;
  const request = details.request;
  const response = details.response;

  if (
    typeof request !== "object" ||
    request === null ||
    typeof response !== "object" ||
    response === null
  ) {
    return undefined;
  }

  const requestRecord = request as Record<string, unknown>;
  const responseRecord = response as Record<string, unknown>;

  return {
    request: {
      method: stringOrUndefined(requestRecord.method),
      url: stringOrUndefined(requestRecord.url)
    },
    response: {
      status: typeof responseRecord.status === "number" ? responseRecord.status : undefined,
      statusText: stringOrUndefined(responseRecord.statusText),
      body: responseRecord.body
    }
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
