import { resolveProvider, type ChatTurn } from "../../../lib/models";
import { requireSession } from "../../../lib/agentWorkflow";

/**
 * POST /api/chat           JSON response
 * POST /api/chat?stream=1  Server-Sent Events stream
 *
 * Body: { messages: [{ role, content }], model?, provider? }
 * Only provider keys from the server environment are used.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const turns: ChatTurn[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
        .slice(-20)
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];
  if (!turns.length) return Response.json({ error: "`messages` is required." }, { status: 400 });

  const provider = resolveProvider(body?.provider);
  const model = typeof body?.model === "string" ? body.model : undefined;
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  try {
    if (!stream) {
      let text = "";
      for await (const chunk of provider.stream(turns, { model })) text += chunk.text;
      return Response.json({ text, provider: provider.id }, { headers: { "Cache-Control": "no-store" } });
    }

    const encoder = new TextEncoder();
    const generator = provider.stream(turns, { model });
    const sse = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`event: start\ndata: ${JSON.stringify({ provider: provider.id })}\n\n`));
        try {
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", delta: chunk.text })}\n\n`));
          }
          controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e instanceof Error ? e.message : "model error" })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Model request failed." }, { status: 502 });
  }
}
