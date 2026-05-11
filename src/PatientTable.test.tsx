import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatientTable } from "./PatientTable";

describe("PatientTable", () => {
  it("renders patient context rows in a table", () => {
    render(
      <PatientTable
        summary={{
          id: "smart-123",
          name: "Nora Shaw",
          gender: "female",
          birthDate: "1984-03-02",
          phone: "555-0100"
        }}
      />
    );

    expect(screen.getByRole("table", { name: "Patient context" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "FHIR ID" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "smart-123" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Nora Shaw" })).toBeVisible();
  });
});
