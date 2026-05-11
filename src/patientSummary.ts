export type HumanName = {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
};

export type ContactPoint = {
  system?: string;
  value?: string;
  use?: string;
};

export type PatientResource = {
  resourceType?: "Patient" | string;
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: { text?: string };
  }>;
  name?: HumanName[];
  gender?: string;
  birthDate?: string;
  telecom?: ContactPoint[];
};

export type PatientSummary = {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
};

export type PatientDisplayRow = {
  label: string;
  value: string;
};

const MISSING_VALUE = "Not provided";

export function formatHumanName(names: HumanName[] | undefined): string {
  const selectedName =
    names?.find((name) => name.use === "official") ?? names?.[0];

  if (!selectedName) {
    return MISSING_VALUE;
  }

  if (selectedName.text) {
    return selectedName.text;
  }

  const nameParts = [
    ...(selectedName.prefix ?? []),
    ...(selectedName.given ?? []),
    selectedName.family,
    ...(selectedName.suffix ?? [])
  ].filter(Boolean);

  return nameParts.length > 0 ? nameParts.join(" ") : MISSING_VALUE;
}

export function summarizePatientResource(
  patient: PatientResource
): PatientSummary {
  return {
    id: patient.id ?? MISSING_VALUE,
    name: formatHumanName(patient.name),
    gender: patient.gender ?? MISSING_VALUE,
    birthDate: patient.birthDate ?? MISSING_VALUE,
    phone:
      patient.telecom?.find((contact) => contact.system === "phone")?.value ??
      MISSING_VALUE
  };
}

export function getPatientDisplayRows(
  patient: PatientSummary
): PatientDisplayRow[] {
  return [
    { label: "FHIR ID", value: patient.id },
    { label: "Name", value: patient.name },
    { label: "Gender", value: patient.gender },
    { label: "Birth date", value: patient.birthDate },
    { label: "Phone", value: patient.phone }
  ];
}
