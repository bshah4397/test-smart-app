import FHIR from "fhirclient";
import type Client from "fhirclient/lib/Client";
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
};

const DEFAULT_CLIENT_ID = "my_web_app";
const DEFAULT_SCOPE = "launch/patient patient/Patient.r openid fhirUser";

export function getSmartLaunchSettings(): SmartLaunchSettings {
  return {
    clientId: import.meta.env.VITE_SMART_CLIENT_ID ?? DEFAULT_CLIENT_ID,
    scope: import.meta.env.VITE_SMART_SCOPE ?? DEFAULT_SCOPE,
    redirectUri: window.location.origin + "/"
  };
}

export function hasSmartLaunchQuery(search = window.location.search): boolean {
  const params = new URLSearchParams(search);

  return params.has("iss") || params.has("launch");
}

export async function authorizeSmartLaunch(): Promise<void> {
  await FHIR.oauth2.authorize(getSmartLaunchSettings());
}

export async function readSmartPatientContext(): Promise<LoadedPatientContext> {
  const client: Client = await FHIR.oauth2.ready();
  const patient = await client.patient.read();

  return {
    source: "smart",
    patient: patient as PatientResource,
    serverUrl: client.state.serverUrl,
    patientId: client.getPatientId(),
    fhirUser: client.getFhirUser(),
    scope: client.state.scope
  };
}
