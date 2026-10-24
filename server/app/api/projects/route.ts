import { requireSession, runs } from "../../../lib/agentWorkflow";

/**
 * /api/projects — workspace projects derived from completed agent runs.
 * Swap the in-memory derivation for the `projects` table in db/schema.sql.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const projects = [...runs.values()]
    .filter((r) => r.status === "completed")
    .map((r) => ({
      id: `proj_${r.id}`,
      name: r.task.slice(0, 80),
      kind: "report",
      status: "active",
      runIds: [r.id],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

  return Response.json({ projects }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return Response.json({ error: "`name` is required." }, { status: 400 });

  const project = {
    id: `proj_${Date.now().toString(36)}`,
    name: name.slice(0, 120),
    kind: ["website", "report", "checklist", "workflow"].includes(body?.kind) ? body.kind : "report",
    status: "draft",
    runIds: [] as string[],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  console.info(`[projects] created ${project.id}`);
  return Response.json({ project }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
