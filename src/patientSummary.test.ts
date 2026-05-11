import { describe, expect, it } from "vitest";
import {
  formatHumanName,
  getPatientDisplayRows,
  summarizePatientResource
} from "./patientSummary";

describe("patient summary helpers", () => {
  it("formats official human names from a FHIR Patient resource", () => {
    expect(
      formatHumanName([
        {
          use: "official",
          family: "Shaw",
          given: ["Nora", "A."]
        }
      ])
    ).toBe("Nora A. Shaw");
  });

  it("summarizes patient demographics for display", () => {
    const summary = summarizePatientResource({
      resourceType: "Patient",
      id: "smart-123",
      name: [{ family: "Shaw", given: ["Nora"] }],
      gender: "female",
      birthDate: "1984-03-02",
      telecom: [{ system: "phone", value: "555-0100" }]
    });

    expect(summary).toEqual({
      id: "smart-123",
      name: "Nora Shaw",
      gender: "female",
      birthDate: "1984-03-02",
      phone: "555-0100"
    });
  });

  it("returns stable rows for the patient table", () => {
    expect(
      getPatientDisplayRows({
        id: "smart-123",
        name: "Nora Shaw",
        gender: "female",
        birthDate: "1984-03-02",
        phone: "555-0100"
      })
    ).toEqual([
      { label: "FHIR ID", value: "smart-123" },
      { label: "Name", value: "Nora Shaw" },
      { label: "Gender", value: "female" },
      { label: "Birth date", value: "1984-03-02" },
      { label: "Phone", value: "555-0100" }
    ]);
  });
});
