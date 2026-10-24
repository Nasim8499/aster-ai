import { requireSession, runs } from "../../../../lib/agentWorkflow";

/**
 * GET /api/agent/status?runId=...
 * Returns the current step index, status and timestamp. Replace the in-memory
 * map with the `agent_runs` / `agent_steps` tables in db/schema.sql.
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

  const activeIndex = run.status === "completed" ? run.steps.length : 0;
  return Response.json(
    {
      runId,
      status: run.status,
      progress: { completed: activeIndex, total: run.steps.length },
      steps: run.steps,
      updatedAt: run.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
