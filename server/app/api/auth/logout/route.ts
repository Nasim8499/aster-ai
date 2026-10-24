import { AUTH_COOKIE } from "../../../../lib/adminAuth";

/** POST /api/auth/logout — clears the signed admin cookie. */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    },
  });
}
