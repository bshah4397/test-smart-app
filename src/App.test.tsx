import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const smartContext = {
  source: "smart",
  patient: {
    resourceType: "Patient",
    id: "athena-patient-1",
    name: [{ given: ["Ada"], family: "Lovelace" }],
    gender: "female",
    birthDate: "1815-12-10"
  },
  serverUrl: "https://api.preview.platform.athenahealth.com/fhir/r4",
  patientId: "athena-patient-1",
  fhirUser: "Practitioner/example",
  scope: "launch patient/Patient.r user/Patient.r openid fhirUser"
};

describe("App SMART API integration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders patient context returned by the server-side SMART API", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(smartContext), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<App />);

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(screen.getByText("SMART launch")).toBeInTheDocument();
    expect(screen.getAllByText("athena-patient-1").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith("/api/patient-context", {
      headers: { Accept: "application/json" }
    });
  });

  it("shows an error instead of demo mode when a SMART callback session cannot load", async () => {
    window.history.replaceState(null, "", "/?smart=1");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "SMART session has expired." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<App />);

    await screen.findByText("Unable to load patient context");
    expect(screen.getByText("SMART session has expired.")).toBeInTheDocument();
    expect(screen.queryByText("Demo mode")).not.toBeInTheDocument();
  });

  it("keeps demo mode available for direct non-SMART visits without a session", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "No active SMART session." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Demo mode")).toBeInTheDocument());
  });
});
