import { requireSession, resultFor, runs } from "../../../../lib/agentWorkflow";

/**
 * GET  /api/agent/result?runId=...  → current artifact
 * POST /api/agent/result            → { runId } mark the run complete
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return Response.json({ error: "`runId` is required." }, { status: 400 });
  const run = runs.get(runId);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  const content = run.result ?? resultFor(run.task);
  return Response.json(
    {
      runId,
      status: run.status,
      artifact: {
        title: run.task,
        kind: "markdown",
        filename: run.artifactFilename,
        content,
        files: [{ name: run.artifactFilename, mime: "text/markdown", content }],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const runId = String(body?.runId ?? "");
  const run = runs.get(runId);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  run.status = body?.failed ? "failed" : "completed";
  run.result = run.result ?? resultFor(run.task);
  run.updatedAt = Date.now();
  runs.set(runId, run);
  return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
}
