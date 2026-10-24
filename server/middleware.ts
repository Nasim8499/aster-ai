import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "./lib/adminAuth";

/**
 * Protects every sensitive API route (chat, agent, projects). The UI lock screen is the first gate;
 * this is the enforced gate — no cookie, no upstream call, no API key used.
 */
export const config = {
  matcher: ["/api/agent/:path*", "/api/chat/:path*", "/api/projects/:path*"],
};

export async function middleware(req: NextRequest) {
  const authed = await isAuthenticated(req);
  if (!authed) {
    return NextResponse.json(
      { error: "Admin session required. Unlock VisaMotion and try again." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}
