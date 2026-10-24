import { plan, requireSession, resultFor, runs, type ServerRun } from "../../../../lib/agentWorkflow";

/** POST /api/agent/start — creates a run with a visible plan. */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const task = String(body?.task ?? "").trim();
  if (!task) return Response.json({ error: "`task` is required." }, { status: 400 });
  if (task.length > 4000) return Response.json({ error: "Task is too long (max 4,000 characters)." }, { status: 400 });

  const run: ServerRun = {
    id: `run_${Date.now().toString(36)}`,
    userId: "admin",
    task,
    status: "running",
    steps: plan(task),
    result: null,
    artifactFilename: "artifact.md",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  runs.set(run.id, run);

  console.info(`[agent/start] ${run.id} steps=${run.steps.length}`);
  return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
}

/** GET /api/agent/start — list runs for the signed-in admin. */
export async function GET(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;
  void resultFor;
  return Response.json({ runs: [...runs.values()] }, { headers: { "Cache-Control": "no-store" } });
}
