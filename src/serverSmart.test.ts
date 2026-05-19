import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  decryptCookieValue,
  encryptCookieValue,
  getSmartSettings
} from "../api/_lib/smart";

describe("server-side SMART helpers", () => {
  it("builds an athena SMART authorization URL with launch context and PKCE", () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize",
      clientId: "client-123",
      redirectUri: "https://example.com/api/smart/callback",
      scope: "launch patient/Patient.r user/Patient.r openid fhirUser",
      iss: "https://api.preview.platform.athenahealth.com/fhir/r4",
      launch: "launch-token",
      state: "state-123",
      codeChallenge: "challenge-123"
    });

    expect(url.origin + url.pathname).toBe(
      "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/api/smart/callback");
    expect(url.searchParams.get("scope")).toBe("launch patient/Patient.r user/Patient.r openid fhirUser");
    expect(url.searchParams.get("aud")).toBe("https://api.preview.platform.athenahealth.com/fhir/r4");
    expect(url.searchParams.get("launch")).toBe("launch-token");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("uses existing Vite SMART envs for server settings", () => {
    const settings = getSmartSettings({
      VITE_SMART_CLIENT_ID: "client-from-vite",
      VITE_SMART_SCOPE: "launch patient/Patient.r openid fhirUser",
      SMART_SESSION_SECRET: "test-secret"
    });

    expect(settings.clientId).toBe("client-from-vite");
    expect(settings.scope).toBe("launch patient/Patient.r openid fhirUser");
  });

  it("encrypts cookie payloads so the browser cannot read token contents", () => {
    const encrypted = encryptCookieValue(
      {
        accessToken: "token-123",
        patientId: "patient-123"
      },
      "test-secret"
    );

    expect(encrypted).not.toContain("token-123");
    expect(decryptCookieValue(encrypted, "test-secret")).toEqual({
      accessToken: "token-123",
      patientId: "patient-123"
    });
  });
});
