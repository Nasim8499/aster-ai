import { isAuthenticated } from "../../../../lib/adminAuth";

/** GET /api/auth/session — lets the client confirm a server-side session. */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ok = await isAuthenticated(req);
  return Response.json({ ok }, { status: ok ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
