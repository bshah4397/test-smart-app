import type { IncomingMessage, ServerResponse } from "node:http";
import {
  PKCE_COOKIE_NAME,
  assertMethod,
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  encryptCookieValue,
  getRedirectUri,
  getRequestUrl,
  getSmartSettings,
  isSecureRequest,
  redirect,
  resolveSmartMetadata,
  safeSmartErrorRedirect,
  serializeCookie
} from "../_lib/smart";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!assertMethod(req, res, "GET")) {
    return;
  }

  try {
    const requestUrl = getRequestUrl(req);
    const iss = requestUrl.searchParams.get("iss");
    const launch = requestUrl.searchParams.get("launch") ?? undefined;

    if (!iss) {
      redirect(res, safeSmartErrorRedirect("SMART launch is missing the iss parameter."));
      return;
    }

    const settings = getSmartSettings();
    const metadata = await resolveSmartMetadata(iss, settings);
    const redirectUri = getRedirectUri(req);
    const codeVerifier = createCodeVerifier();
    const state = createState();
    const launchCookie = encryptCookieValue(
      {
        state,
        codeVerifier,
        iss,
        launch,
        redirectUri,
        tokenEndpoint: metadata.tokenEndpoint,
        requestedAt: new Date().toISOString()
      },
      settings.sessionSecret
    );
    const authorizationUrl = buildAuthorizeUrl({
      authorizationEndpoint: metadata.authorizationEndpoint,
      clientId: settings.clientId,
      redirectUri,
      scope: settings.scope,
      iss,
      launch,
      state,
      codeChallenge: createCodeChallenge(codeVerifier)
    });

    redirect(res, authorizationUrl.toString(), [
      serializeCookie(PKCE_COOKIE_NAME, launchCookie, {
        maxAgeSeconds: 600,
        secure: isSecureRequest(req)
      })
    ]);
  } catch (error) {
    redirect(
      res,
      safeSmartErrorRedirect(error instanceof Error ? error.message : "SMART launch failed.")
    );
  }
}
