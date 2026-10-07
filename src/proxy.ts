import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, STAFF_REFRESH_AFTER_SECONDS, signStaffToken, staffCookieOptions, verifyStaffToken } from "@/lib/auth/staff-token";
import { REFRESH_AFTER_SECONDS, SESSION_COOKIE, sessionCookieOptions, signSessionToken, verifySessionToken } from "@/lib/auth/token";

/**
 * Fast session gates. Neither touches the data store: revocation is checked against the server-side
 * session record by getSession()/requireUser() and getStaffSession()/requireStaff(), which every page,
 * action and route handler calls.
 *
 * Customers (/app, /onboarding, /suspended), with the customer session cookie:
 * - No valid token (missing, tampered, idle more than 30 minutes, or past the 12-hour absolute
 *   lifetime) redirects to /login.
 * - A valid token is re-issued with a fresh idle window (sliding expiry), at most once a minute.
 *
 * Staff console (/admin), with the separate staff cookie (staff-token.ts): the same, with a 1-hour idle
 * window and 8-hour lifetime, redirecting to /admin/login. The sign-in pages themselves are open. A
 * customer session never opens /admin, and a staff session never opens /app.
 */
export const PATH_HEADER = "x-pt-path";

const isStaffLogin = (path: string) => path === "/admin/login" || path.startsWith("/admin/login/");

async function staffGate(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isStaffLogin(path)) return NextResponse.next();
  const claims = await verifyStaffToken(request.cookies.get(STAFF_COOKIE)?.value);
  if (claims) {
    const res = NextResponse.next();
    if (Math.floor(Date.now() / 1000) - (claims.iat ?? 0) >= STAFF_REFRESH_AFTER_SECONDS) {
      res.cookies.set(STAFF_COOKIE, await signStaffToken(claims), staffCookieOptions(claims));
    }
    return res;
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = path === "/admin" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
  const res = NextResponse.redirect(url);
  if (request.cookies.has(STAFF_COOKIE)) res.cookies.delete({ name: STAFF_COOKIE, path: "/admin" });
  return res;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) return staffGate(request);

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
