import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

/**
 * Who is signed in, for the marketing header only: a name for the avatar and the e-mail, or null.
 * The marketing pages are static or ISR, so they can't read the (httpOnly) session cookie while
 * rendering without turning dynamic; the header asks here after hydration instead. The check is the
 * authoritative one (getSession validates the server-side record), and the answer is never cached.
 */
export async function GET() {
  const session = await getSession();
  const user = session ? await (await getStore()).getUser(session.userId) : null;
  return Response.json(user ? { user: { name: user.name || user.email, email: user.email } } : { user: null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
