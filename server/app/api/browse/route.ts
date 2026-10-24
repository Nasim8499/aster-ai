import { runPlaywright } from "../../../lib/browser";
import { isAuthenticated } from "../../../lib/adminAuth";

/**
 * POST /api/browse
 * Body: { task: string, maxSources?: number }
 * Response: text/event-stream of Playwright events:
 *   { type: "step",   id, status }
 *   { type: "log",    text, tone }
 *   { type: "page",   url, title, screenshot (base64 JPEG), index }
 *   { type: "source", url, title, text, screenshot }
 *   { type: "answer", delta }
 *   { type: "done",   answer }
 *   { type: "error",  message }
 *
 * Requires ADMIN cookie and PLAYWRIGHT_BROWSERS_PATH / `npx playwright install`.
 * Node runtime is required for Chromium.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sessions = new Map<string, { aborted: boolean }>();

/** Capability probe + CORS preflight for cross-origin clients. */
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated(req))) {
    return Response.json({ error: "Authentication required. Sign in to browse." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const task = String(body?.task ?? "").trim();
  if (!task) return Response.json({ error: "`task` is required." }, { status: 400 });
  if (task.length > 4000) return Response.json({ error: "Task is too long (max 4,000 characters)." }, { status: 400 });

  const sessionId = `browse_${Date.now().toString(36)}`;
  const signal = { aborted: false };
  sessions.set(sessionId, signal);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        if (signal.aborted && event.type !== "done") return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* client disconnected */
        }
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", sessionId, engine: "playwright" })}\n\n`));
      console.info(`[browse] start ${sessionId} chars=${task.length}`);
      await runPlaywright({ task, maxSources: Number(body?.maxSources ?? 3) }, emit, signal);
      try {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch {
        /* already closed */
      }
      sessions.delete(sessionId);
    },
    cancel() {
      signal.aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** POST /api/browse/stop?sessionId= — cooperative cancel (also aborts on disconnect). */
export async function DELETE(req: Request) {
  if (!(await isAuthenticated(req))) return Response.json({ error: "Authentication required." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("sessionId");
  if (!id) return Response.json({ error: "`sessionId` is required." }, { status: 400 });
  const s = sessions.get(id);
  if (s) s.aborted = true;
  return Response.json({ ok: !!s });
}
