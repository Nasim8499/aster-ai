import { AUTH_COOKIE, createToken, passwordMatches } from "../../../../lib/adminAuth";

/** POST /api/auth/login — the only password gate. No usernames, no accounts. */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  if (!passwordMatches(password)) {
    // Constant-ish delay to blunt trivial guessing; never log the attempt value.
    await new Promise((r) => setTimeout(r, 450));
    return Response.json({ ok: false, error: "Incorrect password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const maxAge = body.remember === false ? 60 * 60 * 12 : 60 * 60 * 24 * 30;
  const token = await createToken(maxAge);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return new Response(JSON.stringify({ ok: true, remember: body.remember !== false }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
    },
  });
}
