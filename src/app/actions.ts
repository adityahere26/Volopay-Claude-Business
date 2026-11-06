"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, requireWorkspace, setSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { normalizeRule, CATEGORY_IDS, type RequestInput, type Rule } from "@/lib/engine";
import {
  checkSpend,
  createWorkspace,
  discardDraft,
  freshenDemo,
  ensureDraft,
  getLogin,
  getWorkspaceBySlug,
  logEvent,
  publishDraft,
  reviewRequest,
  saveDraft,
  submitRequest,
} from "@/lib/store";
import { q } from "@/lib/db";
import { DEMO, resetDemo } from "@/lib/seed";

type FormState = { error?: string } | undefined;

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "");
  const pw = String(fd.get("password") ?? "");
  const row = await getLogin(email);
  if (!row || !verifyPassword(pw, row.password_hash)) return { error: "Email or password is incorrect." };
  await freshenDemo(row.id);
  await setSession(row.id);
  redirect("/app");
}

export async function demoLogin() {
  await getLogin(DEMO.email); // ensures schema + seed
  await freshenDemo(DEMO.workspaceId);
  await setSession(DEMO.workspaceId);
  redirect("/app");
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const company = String(fd.get("company") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!company || !name || !email) return { error: "Please fill in every field." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  if (await getLogin(email)) return { error: "An account with this email already exists. Sign in instead." };
  const id = await createWorkspace({ company, name, email, password });
  await setSession(id);
  redirect("/app/connect");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

// ---------- policy editing (the human-in-the-loop half) ----------
export async function saveRule(raw: Rule, originalId?: string) {
  const ws = await requireWorkspace();
  const draft = await ensureDraft(ws.id);
  const rule = normalizeRule(raw as unknown as Record<string, unknown>, draft.policy.rules.length);
  const rules = [...draft.policy.rules];
  const idx = rules.findIndex((r) => r.id === (originalId ?? rule.id));
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  await saveDraft(ws.id, { ...draft.policy, rules }, { source: "human" });
  await logEvent(ws.id, "admin", "rule", `${ws.admin_name} ${idx >= 0 ? "edited" : "added"} §${rule.clause} ${rule.title}`);
  revalidatePath("/app", "layout");
}

export async function deleteRule(id: string) {
  const ws = await requireWorkspace();
  const draft = await ensureDraft(ws.id);
  const rule = draft.policy.rules.find((r) => r.id === id);
  await saveDraft(ws.id, { ...draft.policy, rules: draft.policy.rules.filter((r) => r.id !== id) }, { source: "human" });
  if (rule) await logEvent(ws.id, "admin", "rule", `${ws.admin_name} removed §${rule.clause} ${rule.title}`);
  revalidatePath("/app", "layout");
}

export async function setUnmatched(value: "allow" | "require_approval") {
  const ws = await requireWorkspace();
  const draft = await ensureDraft(ws.id);
  await saveDraft(ws.id, { ...draft.policy, defaults: { ...draft.policy.defaults, unmatched: value } }, { source: "human" });
  revalidatePath("/app", "layout");
}

export async function startDraft() {
  const ws = await requireWorkspace();
  await ensureDraft(ws.id);
  revalidatePath("/app", "layout");
}

export async function publish(): Promise<{ error?: string; version?: number }> {
  const ws = await requireWorkspace();
  try {
    const version = await publishDraft(ws.id, ws.admin_name);
    revalidatePath("/app", "layout");
    return { version };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function discard() {
  const ws = await requireWorkspace();
  await discardDraft(ws.id, ws.admin_name);
  revalidatePath("/app", "layout");
}

export async function review(ref: string, decision: "approved" | "rejected", note: string) {
  const ws = await requireWorkspace();
  await reviewRequest(ws.id, ref, decision, note, ws.admin_name, "admin");
  revalidatePath("/app", "layout");
}

export async function resetDemoWorkspace() {
  const ws = await requireWorkspace();
  if (!ws.is_demo) return;
  await resetDemo(q);
  await logEvent(ws.id, "system", "reset", "Demo data reset");
  revalidatePath("/app", "layout");
  redirect("/app");
}

// ---------- employee portal (public, no Claude needed) ----------
function parseExpense(fd: FormData): RequestInput {
  const num = (k: string) => {
    const v = String(fd.get(k) ?? "").trim();
    return v === "" ? undefined : Number(v);
  };
  const str = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
  const category = String(fd.get("category") ?? "other");
  return {
    category: CATEGORY_IDS.includes(category) ? category : "other",
    amount: num("amount") ?? 0,
    merchant: str("merchant"),
    description: str("description"),
    expense_date: str("expense_date"),
    attendees: num("attendees"),
    nights: num("nights"),
    cabin_class: str("cabin_class"),
    city: str("city"),
    department: str("department"),
    has_receipt: fd.get("has_receipt") === "on",
  };
}

export async function previewExpense(slug: string, fd: FormData) {
  const ws = await getWorkspaceBySlug(slug);
  if (!ws) return null;
  const input = parseExpense(fd);
  if (!input.amount || input.amount <= 0) return null;
  const r = await checkSpend(ws.id, input, { email: String(fd.get("email") ?? "") || undefined });
  if (!r) return null;
  return { outcome: r.decision.outcome, approver: r.decision.approver, headline: r.decision.headline, hits: r.decision.hits, version: r.version };
}

export async function submitExpense(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const ws = await getWorkspaceBySlug(slug);
  if (!ws) return { error: "Unknown company." };
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  if (!name || !email) return { error: "Add your name and work email." };
  const input = parseExpense(fd);
  if (!input.amount || input.amount <= 0) return { error: "Enter an amount." };
  let ref: string;
  try {
    ref = await submitRequest(ws.id, { name, email }, input);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/r/${slug}/${ref}?email=${encodeURIComponent(email)}`);
}
