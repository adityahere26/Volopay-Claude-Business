import { sessionWorkspaceId } from "@/lib/auth";
import { liveStamp } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = await sessionWorkspaceId();
  if (!id) return Response.json({ stamp: null }, { status: 401 });
  return Response.json({ stamp: await liveStamp(id) });
}
