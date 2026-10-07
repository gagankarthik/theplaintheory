import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_AFTER_SECONDS, SESSION_COOKIE, sessionCookieOptions, signSessionToken, verifySessionToken } from "@/lib/auth/token";

/**
 * Fast session gate for /app, /onboarding, /suspended and the staff console (/admin):
 * - No valid token (missing, tampered, idle more than 30 minutes, or past the 12-hour absolute
 *   lifetime) redirects to sign-in.
 * - A valid token is re-issued with a fresh idle window (sliding expiry), at most once a minute.
 * Revocation is checked against the server-side session record in getSession()/requireUser(), which
 * every page, action and route handler calls; this proxy deliberately doesn't touch the data store.
 */
export const PATH_HEADER = "x-pt-path";

export async function proxy(request: NextRequest) {
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) {
    // The /app layout reads the path to apply the org MFA policy before any streaming starts.
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, request.nextUrl.pathname);
    const res = NextResponse.next({ request: { headers } });
    const age = Math.floor(Date.now() / 1000) - (claims.iat ?? 0);
    if (age >= REFRESH_AFTER_SECONDS) {
      res.cookies.set(SESSION_COOKIE, await signSessionToken(claims), sessionCookieOptions(claims));
    }
    return res;
  }
  // The staff console answers 404 to anyone without a staff session, so no sign-in redirect here:
  // a redirect would reveal that /admin exists. The page-level check decides.
  if (request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = request.nextUrl.pathname.startsWith("/app") ? `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}` : "";
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/suspended", "/admin", "/admin/:path*"],
};
