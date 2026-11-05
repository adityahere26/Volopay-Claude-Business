import { handleMcp } from "@/lib/mcp";
import { getWorkspaceByKey } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id, mcp-protocol-version, authorization",
};

export async function POST(req: Request, ctx: RouteContext<"/api/mcp/[key]">) {
  const { key } = await ctx.params;
  const ws = await getWorkspaceByKey(key);
  if (!ws) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unknown Clause connector key" } }, { status: 404, headers: CORS });
  const res = await handleMcp(req, ws);
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

// Stateless server: no server-initiated SSE stream, no sessions to delete.
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST", ...CORS } });
}
export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST", ...CORS } });
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
