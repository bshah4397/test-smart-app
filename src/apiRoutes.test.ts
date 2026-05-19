import type { IncomingMessage, ServerResponse } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import patientContextHandler from "../api/patient-context";
import launchHandler from "../api/smart/launch";
import { SESSION_COOKIE_NAME, encryptCookieValue } from "../api/_lib/smart";

class MockResponse {
  statusCode = 200;
  body = "";
  private headers = new Map<string, number | string | string[]>();

  setHeader(name: string, value: number | string | string[]): void {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): number | string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: string): void {
    if (chunk) {
      this.body += chunk;
    }
  }
}

function createRequest({
  method = "GET",
  url,
  cookie,
  headers
}: {
  method?: string;
  url: string;
  cookie?: string;
  headers?: IncomingHttpHeaders;
}): IncomingMessage {
  return {
    method,
    url,
    headers: {
      host: "localhost:3000",
      ...headers,
      ...(cookie ? { cookie } : {})
    }
  } as IncomingMessage;
}

function createResponse(): ServerResponse & MockResponse {
  return new MockResponse() as ServerResponse & MockResponse;
}

describe("Vercel SMART API routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VITE_SMART_CLIENT_ID: "client-123",
      VITE_SMART_SCOPE: "launch patient/Patient.r user/Patient.r openid fhirUser",
      SMART_SESSION_SECRET: "test-secret",
      SMART_AUTHORIZATION_URL: "https://auth.example/authorize",
      SMART_TOKEN_URL: "https://auth.example/token"
    };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("redirects SMART launch requests to athena authorization with an httpOnly PKCE cookie", async () => {
    const req = createRequest({
      url: "/api/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-token"
    });
    const res = createResponse();

    await launchHandler(req, res);

    const location = new URL(String(res.getHeader("Location")));
    const cookies = res.getHeader("Set-Cookie");

    expect(res.statusCode).toBe(302);
    expect(location.origin + location.pathname).toBe("https://auth.example/authorize");
    expect(location.searchParams.get("client_id")).toBe("client-123");
    expect(location.searchParams.get("aud")).toBe("https://fhir.example/r4");
    expect(location.searchParams.get("launch")).toBe("launch-token");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/smart/callback"
    );
    expect(String(cookies)).toContain("smart_pkce=");
    expect(String(cookies)).toContain("HttpOnly");
  });

  it("sets embedded-safe SMART launch cookies for HTTPS deployments", async () => {
    const req = createRequest({
      url: "/api/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-token",
      headers: {
        "x-forwarded-host": "test-smart-app-zeta.vercel.app",
        "x-forwarded-proto": "https"
      }
    });
    const res = createResponse();

    await launchHandler(req, res);

    const location = new URL(String(res.getHeader("Location")));
    const cookies = String(res.getHeader("Set-Cookie"));

    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://test-smart-app-zeta.vercel.app/api/smart/callback"
    );
    expect(cookies).toContain("smart_pkce=");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=None");
    expect(cookies).toContain("Secure");
    expect(cookies).toContain("Partitioned");
  });

  it("returns patient context by calling FHIR from the server-side session", async () => {
    const sessionCookie = encryptCookieValue(
      {
        accessToken: "access-token",
        tokenType: "Bearer",
        patientId: "patient-123",
        serverUrl: "https://fhir.example/r4",
        scope: "launch patient/Patient.r",
        fhirUser: "Practitioner/example"
      },
      "test-secret"
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "Patient", id: "patient-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const req = createRequest({
      url: "/api/patient-context",
      cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`
    });
    const res = createResponse();

    await patientContextHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledWith("https://fhir.example/r4/Patient/patient-123", {
      headers: {
        Accept: "application/fhir+json, application/json",
        Authorization: "Bearer access-token"
      }
    });
    expect(JSON.parse(res.body)).toMatchObject({
      source: "smart",
      patientId: "patient-123",
      patient: { resourceType: "Patient", id: "patient-123" }
    });
  });

  it("returns sanitized SMART session details when patient lookup is forbidden", async () => {
    const sessionCookie = encryptCookieValue(
      {
        accessToken: "access-token",
        tokenType: "Bearer",
        patientId: "patient-123",
        serverUrl: "https://fhir.example/r4",
        scope: "launch patient/Patient.r user/Patient.r openid fhirUser",
        fhirUser: "Practitioner/example",
        expiresAt: 1778540000
      },
      "test-secret"
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "OperationOutcome" }), {
        status: 403,
        headers: { "Content-Type": "application/fhir+json" }
      })
    );
    const req = createRequest({
      url: "/api/patient-context",
      cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`
    });
    const res = createResponse();

    await patientContextHandler(req, res);

    const payload = JSON.parse(res.body);

    expect(res.statusCode).toBe(403);
    expect(payload).toMatchObject({
      error: "Patient lookup failed (403).",
      smartSession: {
        source: "smart",
        patientId: "patient-123",
        serverUrl: "https://fhir.example/r4",
        scope: "launch patient/Patient.r user/Patient.r openid fhirUser",
        fhirUser: "Practitioner/example",
        expiresAt: 1778540000
      }
    });
    expect(JSON.stringify(payload)).not.toContain("access-token");
  });
});
