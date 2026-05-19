import type { IncomingMessage, ServerResponse } from "node:http";
import {
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  assertMatchingState,
  assertMethod,
  clearCookie,
  createSmartSession,
  decryptCookieValue,
  encryptCookieValue,
  exchangeCodeForToken,
  getRequestUrl,
  getSmartSettings,
  isSecureRequest,
  readCookie,
  redirect,
  safeSmartErrorRedirect,
  serializeCookie,
  type LaunchCookie
} from "../_lib/smart.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!assertMethod(req, res, "GET")) {
    return;
  }

  const secure = isSecureRequest(req);
  const clearPkceCookie = clearCookie(PKCE_COOKIE_NAME, secure);

  try {
    const requestUrl = getRequestUrl(req);
    const providerError = requestUrl.searchParams.get("error");
    const providerErrorDescription = requestUrl.searchParams.get("error_description");

    if (providerError) {
      redirect(
        res,
        safeSmartErrorRedirect(providerErrorDescription ?? providerError),
        [clearPkceCookie]
      );
      return;
    }

    const code = requestUrl.searchParams.get("code");

    if (!code) {
      redirect(res, safeSmartErrorRedirect("SMART callback is missing the code parameter."), [
        clearPkceCookie
      ]);
      return;
    }

    const settings = getSmartSettings();
    const launchCookieValue = readCookie(req, PKCE_COOKIE_NAME);

    if (!launchCookieValue) {
      redirect(res, safeSmartErrorRedirect("SMART launch session has expired."), [
        clearPkceCookie
      ]);
      return;
    }

    const launchContext = decryptCookieValue<LaunchCookie>(
      launchCookieValue,
      settings.sessionSecret
    );
    assertMatchingState(requestUrl.searchParams.get("state"), launchContext.state);

    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: launchContext.tokenEndpoint,
      code,
      redirectUri: launchContext.redirectUri,
      clientId: settings.clientId,
      codeVerifier: launchContext.codeVerifier
    });
    const session = createSmartSession(tokenResponse, launchContext);
    const sessionCookie = encryptCookieValue(session, settings.sessionSecret);

    redirect(res, "/?smart=1", [
      clearPkceCookie,
      serializeCookie(SESSION_COOKIE_NAME, sessionCookie, {
        maxAgeSeconds: 3600,
        secure
      })
    ]);
  } catch (error) {
    redirect(
      res,
      safeSmartErrorRedirect(error instanceof Error ? error.message : "SMART callback failed."),
      [clearPkceCookie]
    );
  }
}
