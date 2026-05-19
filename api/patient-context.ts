import type { IncomingMessage, ServerResponse } from "node:http";
import {
  SESSION_COOKIE_NAME,
  SmartApiError,
  assertMethod,
  decryptCookieValue,
  fetchPatientContext,
  getSmartSettings,
  readCookie,
  sendJson,
  sendSmartError,
  summarizeSmartSession,
  type SmartSession
} from "./_lib/smart.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!assertMethod(req, res, "GET")) {
    return;
  }

  try {
    const settings = getSmartSettings();
    const sessionCookie = readCookie(req, SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      sendJson(res, 401, { error: "No active SMART session." });
      return;
    }

    const session = decryptCookieValue<SmartSession>(sessionCookie, settings.sessionSecret);
    try {
      const context = await fetchPatientContext(session);

      sendJson(res, 200, context);
    } catch (error) {
      const statusCode = error instanceof SmartApiError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : "Unable to load patient context.";
      const details =
        error instanceof SmartApiError && isRecord(error.details) ? error.details : {};

      sendJson(res, statusCode, {
        error: message,
        smartSession: summarizeSmartSession(session),
        ...details
      });
    }
  } catch (error) {
    sendSmartError(res, error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
