import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

export const PKCE_COOKIE_NAME = "smart_pkce";
export const SESSION_COOKIE_NAME = "smart_session";

const DEFAULT_SCOPE = "launch patient/Patient.r user/Patient.r openid fhirUser";
const DEFAULT_AUTHORIZATION_ENDPOINT =
  "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize";
const DEFAULT_TOKEN_ENDPOINT = "https://api.preview.platform.athenahealth.com/oauth2/v1/token";

type EnvSource = Record<string, string | undefined>;

export type SmartSettings = {
  clientId: string;
  scope: string;
  sessionSecret: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
};

export type LaunchCookie = {
  state: string;
  codeVerifier: string;
  iss: string;
  launch?: string;
  redirectUri: string;
  tokenEndpoint: string;
  requestedAt: string;
};

export type SmartSession = {
  accessToken: string;
  tokenType: string;
  patientId: string | null;
  serverUrl: string;
  scope?: string;
  fhirUser?: string | null;
  expiresAt?: number | null;
};

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  patient?: string;
  scope?: string;
  expires_in?: number;
  id_token?: string;
  fhirUser?: string;
};

export class SmartApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "SmartApiError";
    this.statusCode = statusCode;
  }
}

export function getSmartSettings(env: EnvSource = process.env): SmartSettings {
  const clientId = env.SMART_CLIENT_ID ?? env.VITE_SMART_CLIENT_ID;

  if (!clientId) {
    throw new SmartApiError(500, "Missing SMART client ID.");
  }

  const sessionSecret = env.SMART_SESSION_SECRET ?? clientId;

  return {
    clientId,
    scope: env.SMART_SCOPE ?? env.VITE_SMART_SCOPE ?? DEFAULT_SCOPE,
    sessionSecret,
    authorizationEndpoint: env.SMART_AUTHORIZATION_URL,
    tokenEndpoint: env.SMART_TOKEN_URL
  };
}

export function buildAuthorizeUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  scope,
  iss,
  launch,
  state,
  codeChallenge
}: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  iss: string;
  launch?: string;
  state: string;
  codeChallenge: string;
}): URL {
  const url = new URL(authorizationEndpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("aud", iss);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (launch) {
    url.searchParams.set("launch", launch);
  }

  return url;
}

export function createCodeVerifier(): string {
  return base64UrlEncode(randomBytes(64));
}

export function createState(): string {
  return base64UrlEncode(randomBytes(32));
}

export function createCodeChallenge(codeVerifier: string): string {
  return base64UrlEncode(createHash("sha256").update(codeVerifier).digest());
}

export function encryptCookieValue(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const key = secretKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(encrypted)].join(".");
}

export function decryptCookieValue<T = unknown>(value: string, secret: string): T {
  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new SmartApiError(401, "Invalid SMART session cookie.");
  }

  const decipher = createDecipheriv("aes-256-gcm", secretKey(secret), base64UrlDecode(ivValue));
  decipher.setAuthTag(base64UrlDecode(tagValue));
  const decrypted = Buffer.concat([
    decipher.update(base64UrlDecode(encryptedValue)),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

export async function resolveSmartMetadata(
  iss: string,
  settings: SmartSettings
): Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> {
  if (settings.authorizationEndpoint && settings.tokenEndpoint) {
    return {
      authorizationEndpoint: settings.authorizationEndpoint,
      tokenEndpoint: settings.tokenEndpoint
    };
  }

  try {
    const smartConfigUrl = `${iss.replace(/\/$/, "")}/.well-known/smart-configuration`;
    const response = await fetch(smartConfigUrl, {
      headers: { Accept: "application/json" }
    });

    if (response.ok) {
      const metadata = (await response.json()) as {
        authorization_endpoint?: string;
        token_endpoint?: string;
      };

      return {
        authorizationEndpoint:
          settings.authorizationEndpoint ??
          metadata.authorization_endpoint ??
          DEFAULT_AUTHORIZATION_ENDPOINT,
        tokenEndpoint: settings.tokenEndpoint ?? metadata.token_endpoint ?? DEFAULT_TOKEN_ENDPOINT
      };
    }
  } catch {
    // Fall back to the athena preview endpoints below.
  }

  return {
    authorizationEndpoint: settings.authorizationEndpoint ?? DEFAULT_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: settings.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT
  };
}

export async function exchangeCodeForToken({
  tokenEndpoint,
  code,
  redirectUri,
  clientId,
  codeVerifier
}: {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await readJsonResponse<TokenResponse>(response);

  if (!response.ok) {
    throw new SmartApiError(response.status, `Token exchange failed (${response.status}).`);
  }

  if (!payload.access_token) {
    throw new SmartApiError(502, "Token response did not include an access token.");
  }

  return payload;
}

export function createSmartSession(
  tokenResponse: TokenResponse,
  launchContext: LaunchCookie
): SmartSession {
  const profile = tokenResponse.id_token ? decodeJwtPayload(tokenResponse.id_token) : {};
  const fhirUser =
    tokenResponse.fhirUser ??
    stringValue(profile.fhirUser) ??
    stringValue(profile.fhir_user) ??
    null;

  return {
    accessToken: tokenResponse.access_token ?? "",
    tokenType: tokenResponse.token_type ?? "Bearer",
    patientId: tokenResponse.patient ?? stringValue(profile.patient) ?? null,
    serverUrl: launchContext.iss,
    scope: tokenResponse.scope,
    fhirUser,
    expiresAt:
      typeof tokenResponse.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in
        : null
  };
}

export async function fetchPatientContext(session: SmartSession): Promise<{
  source: "smart";
  patient: unknown;
  serverUrl: string;
  patientId: string;
  fhirUser?: string | null;
  scope?: string;
}> {
  if (!session.patientId) {
    throw new SmartApiError(502, "SMART token response did not include a patient context.");
  }

  const patientUrl = `${session.serverUrl.replace(/\/$/, "")}/Patient/${encodeURIComponent(
    session.patientId
  )}`;
  const response = await fetch(patientUrl, {
    headers: {
      Accept: "application/fhir+json, application/json",
      Authorization: `${session.tokenType} ${session.accessToken}`
    }
  });
  const patient = await readJsonResponse(response);

  if (!response.ok) {
    throw new SmartApiError(response.status, `Patient lookup failed (${response.status}).`);
  }

  return {
    source: "smart",
    patient,
    serverUrl: session.serverUrl,
    patientId: session.patientId,
    fhirUser: session.fhirUser,
    scope: session.scope
  };
}

export function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", getRequestBaseUrl(req.headers));
}

export function getRedirectUri(req: IncomingMessage, env: EnvSource = process.env): string {
  return env.SMART_REDIRECT_URI ?? `${getRequestBaseUrl(req.headers)}/api/smart/callback`;
}

export function isSecureRequest(req: IncomingMessage): boolean {
  return getRequestBaseUrl(req.headers).startsWith("https://");
}

export function readCookie(req: IncomingMessage, name: string): string | null {
  const cookieHeader = getHeader(req.headers, "cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=");
    }
  }

  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds: number; secure: boolean }
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, "", { maxAgeSeconds: 0, secure });
}

export function appendSetCookie(res: ServerResponse, cookies: string[]): void {
  const previous = res.getHeader("Set-Cookie");
  const existing = Array.isArray(previous) ? previous : previous ? [String(previous)] : [];

  res.setHeader("Set-Cookie", [...existing, ...cookies]);
}

export function redirect(res: ServerResponse, location: string, cookies: string[] = []): void {
  if (cookies.length > 0) {
    appendSetCookie(res, cookies);
  }

  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function sendSmartError(res: ServerResponse, error: unknown): void {
  const statusCode = error instanceof SmartApiError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Unexpected SMART server error.";

  sendJson(res, statusCode, { error: message });
}

export function safeSmartErrorRedirect(message: string): string {
  return `/?smart=1&smart_error=${encodeURIComponent(message)}`;
}

export function assertMethod(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method === method) {
    return true;
  }

  res.statusCode = 405;
  res.setHeader("Allow", method);
  res.end();
  return false;
}

export function assertMatchingState(actual: string | null, expected: string): void {
  if (!actual) {
    throw new SmartApiError(400, "Missing SMART state.");
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new SmartApiError(400, "SMART state did not match the launch session.");
  }
}

function getRequestBaseUrl(headers: IncomingHttpHeaders): string {
  const host = getHeader(headers, "x-forwarded-host") ?? getHeader(headers, "host") ?? "localhost";
  const protocol =
    getHeader(headers, "x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function getHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function secretKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): Buffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replaceAll("-", "+").replaceAll("_", "/");

  return Buffer.from(base64, "base64");
}

async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SmartApiError(502, "Expected a JSON response from the SMART server.");
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");

  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(base64UrlDecode(payload).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
