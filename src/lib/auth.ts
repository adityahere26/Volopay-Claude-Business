import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getWorkspaceById } from "./store";

const COOKIE = "clause_session";
const secret = () => process.env.SESSION_SECRET || "dev-only-secret-change-me";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function setSession(wsId: string) {
  const exp = Date.now() + 30 * 86400000;
  const v = `${wsId}.${exp}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function sessionWorkspaceId() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (Number(exp) < Date.now()) return null;
  return id;
}

/** For admin pages and actions: the signed-in workspace or a redirect to /login. */
export async function requireWorkspace() {
  const id = await sessionWorkspaceId();
  const ws = id ? await getWorkspaceById(id) : null;
  if (!ws) redirect("/login");
  return ws;
}
