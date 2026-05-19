import type { IncomingMessage, ServerResponse } from "node:http";
import {
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  assertMethod,
  clearCookie,
  isSecureRequest,
  redirect
} from "./_lib/smart.js";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!assertMethod(req, res, "GET")) {
    return;
  }

  const secure = isSecureRequest(req);

  redirect(res, "/logout-complete", [
    clearCookie(PKCE_COOKIE_NAME, secure),
    clearCookie(SESSION_COOKIE_NAME, secure)
  ]);
}
