/**
 * Single-admin session helpers (edge-safe Web Crypto).
 * The password lives only in ADMIN_PASSWORD. A signed, httpOnly cookie gates
 * every sensitive API route through middleware.ts.
 */
export const AUTH_COOKIE = "aster_admin";

function secret() {
  return process.env.ADMIN_PASSWORD ?? "666085";
}

const encoder = new TextEncoder();

async function sign(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createToken(maxAgeSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const sig = await sign(`admin.${exp}`, secret());
  return `${exp}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  const expected = await sign(`admin.${exp}`, secret());
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(candidate: string): boolean {
  const expected = secret();
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]+)`));
  return verifyToken(match?.[1]);
}
