import type { PatientResource } from "./patientSummary";

export const demoPatient: PatientResource = {
  resourceType: "Patient",
  id: "example-patient-001",
  identifier: [
    {
      system: "https://example.org/mrn",
      value: "MRN-245813",
      type: { text: "Medical record number" }
    }
  ],
  name: [
    {
      use: "official",
      family: "Shaw",
      given: ["Nora", "A."]
    }
  ],
  gender: "female",
  birthDate: "1984-03-02",
  telecom: [
    {
      system: "phone",
      value: "555-0100",
      use: "mobile"
    }
  ]
};
