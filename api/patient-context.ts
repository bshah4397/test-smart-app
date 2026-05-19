import type { IncomingMessage, ServerResponse } from "node:http";
import {
  SESSION_COOKIE_NAME,
  assertMethod,
  decryptCookieValue,
  fetchPatientContext,
  getSmartSettings,
  readCookie,
  sendJson,
  sendSmartError,
  type SmartSession
} from "./_lib/smart";

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
    const context = await fetchPatientContext(session);

    sendJson(res, 200, context);
  } catch (error) {
    sendSmartError(res, error);
  }
}
