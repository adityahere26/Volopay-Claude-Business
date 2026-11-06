import "server-only";
import { q, newId } from "./db";
import {
  diffRules,
  evaluate,
  money,
  runTests,
  validatePolicy,
  type Action,
  type Decision,
  type Policy,
  type RequestInput,
} from "./engine";
import { hashPassword } from "./password";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  admin_name: string;
  admin_email: string;
  mcp_key: string;
  is_demo: boolean;
};
export type Version = {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  source: "claude" | "human";
  policy: Policy;
  note: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  published_by: string | null;
};
export type RequestRow = {
  id: string;
  ref: string;
  employee_name: string;
  employee_email: string;
  input: RequestInput;
  decision: Decision;
  policy_version: number;
  status: "approved" | "pending" | "rejected" | "blocked";
  auto: boolean;
  reviewer: string | null;
  review_note: string | null;
  created_at: Date;
  decided_at: Date | null;
};
export type EventRow = { id: string; actor: string; kind: string; detail: string; created_at: Date };

const WS_COLS = "id, name, slug, admin_name, admin_email, mcp_key, is_demo";

// ---------- workspaces ----------
export async function getWorkspaceById(id: string) {
  return ((await q(`select ${WS_COLS} from workspaces where id=$1`, [id]))[0] as Workspace) ?? null;
}
export async function getWorkspaceByKey(key: string) {
  return ((await q(`select ${WS_COLS} from workspaces where mcp_key=$1`, [key]))[0] as Workspace) ?? null;
}
export async function getWorkspaceBySlug(slug: string) {
  return ((await q(`select ${WS_COLS} from workspaces where slug=$1`, [slug]))[0] as Workspace) ?? null;
}
export async function getLogin(email: string) {
  return ((await q(`select id, password_hash from workspaces where lower(admin_email)=lower($1)`, [email]))[0] as
    | { id: string; password_hash: string }
    | undefined) ?? null;
}
export async function createWorkspace(input: { company: string; name: string; email: string; password: string }) {
  const base = input.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "team";
  let slug = base;
  for (let i = 2; await getWorkspaceBySlug(slug); i++) slug = `${base}-${i}`;
  const id = newId("ws");
  const key = newId("ck");
  await q(
    `insert into workspaces (id, name, slug, admin_name, admin_email, password_hash, mcp_key) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.company.trim(), slug, input.name.trim(), input.email.trim().toLowerCase(), hashPassword(input.password), key],
  );
  await logEvent(id, "system", "created", `Workspace created for ${input.company.trim()}`);
  return id;
}

// ---------- events ----------
export async function logEvent(wsId: string, actor: "claude" | "admin" | "employee" | "system", kind: string, detail: string) {
  await q(`insert into events (id, workspace_id, actor, kind, detail) values ($1,$2,$3,$4,$5)`, [newId("ev"), wsId, actor, kind, detail]);
}
export async function listEvents(wsId: string, limit = 12) {
  return (await q(`select id, actor, kind, detail, created_at from events where workspace_id=$1 order by created_at desc limit $2`, [
    wsId,
    limit,
  ])) as EventRow[];
}
export async function liveStamp(wsId: string) {
  const r = await q(`select count(*)::int as n, max(created_at) as t from events where workspace_id=$1`, [wsId]);
  return `${r[0]?.n ?? 0}:${r[0]?.t ? new Date(r[0].t).getTime() : 0}`;
}

// ---------- policy versions ----------
const V_COLS = "id, version, status, source, policy, note, created_at, updated_at, published_at, published_by";
export async function getPublished(wsId: string) {
  return ((await q(`select ${V_COLS} from policy_versions where workspace_id=$1 and status='published' limit 1`, [wsId]))[0] as Version) ?? null;
}
export async function getDraft(wsId: string) {
  return ((await q(`select ${V_COLS} from policy_versions where workspace_id=$1 and status='draft' limit 1`, [wsId]))[0] as Version) ?? null;
}
export async function listVersions(wsId: string) {
  return (await q(`select ${V_COLS} from policy_versions where workspace_id=$1 order by version desc`, [wsId])) as Version[];
}

export async function saveDraft(wsId: string, policy: Policy, opts: { source: "claude" | "human"; note?: string }) {
  const draft = await getDraft(wsId);
  if (draft) {
    // A human touching Claude's draft makes it a joint draft; keep "claude" as origin unless human-only.
    await q(`update policy_versions set policy=$2::text::jsonb, note=coalesce($3, note), updated_at=now(), source=$4 where id=$1`, [
      draft.id,
      JSON.stringify(policy),
      opts.note ?? null,
      draft.source === "claude" || opts.source === "claude" ? "claude" : "human",
    ]);
    return { id: draft.id, version: draft.version, created: false };
  }
  const max = await q(`select coalesce(max(version),0)::int as v from policy_versions where workspace_id=$1`, [wsId]);
  const version = (max[0]?.v ?? 0) + 1;
  const id = newId("pv");
  await q(
    `insert into policy_versions (id, workspace_id, version, status, source, policy, note) values ($1,$2,$3,'draft',$4,$5::text::jsonb,$6)`,
    [id, wsId, version, opts.source, JSON.stringify(policy), opts.note ?? null],
  );
  return { id, version, created: true };
}

/** Start editing: returns the draft, creating one from the published policy if needed. */
export async function ensureDraft(wsId: string) {
  const d = await getDraft(wsId);
  if (d) return d;
  const pub = await getPublished(wsId);
  const base: Policy = pub?.policy ?? { title: "Spend policy", currency: "USD", defaults: { unmatched: "allow", approver: "manager" }, rules: [], tests: [] };
  await saveDraft(wsId, base, { source: "human", note: "Manual edits" });
  return (await getDraft(wsId))!;
}

export async function publishDraft(wsId: string, by: string) {
  const d = await getDraft(wsId);
  if (!d) throw new Error("There is no draft to publish.");
  const errors = validatePolicy(d.policy).filter((i) => i.level === "error");
  if (errors.length) throw new Error(`Fix ${errors.length} error(s) before publishing: ${errors[0].message}`);
  await q(`update policy_versions set status='archived' where workspace_id=$1 and status='published'`, [wsId]);
  await q(`update policy_versions set status='published', published_at=now(), published_by=$2, updated_at=now() where id=$1`, [d.id, by]);
  await logEvent(wsId, "admin", "published", `${by} published v${d.version} — ${d.policy.rules.length} rules now enforced`);
  return d.version;
}

export async function discardDraft(wsId: string, by: string) {
  const d = await getDraft(wsId);
  if (!d) return;
  await q(`delete from policy_versions where id=$1`, [d.id]);
  await logEvent(wsId, "admin", "discarded", `${by} discarded draft v${d.version}`);
}

// ---------- analysis: validation + tests + diff + impact on real history ----------
export type Impact = {
  checked: number;
  changed: { ref: string; employee: string; summary: string; from: Action; to: Action; clause: string | null }[];
};
export async function analyze(wsId: string, policy: Policy) {
  const pub = await getPublished(wsId);
  const issues = validatePolicy(policy);
  const tests = runTests(policy);
  const diff = diffRules(pub?.policy.rules ?? [], policy.rules);
  const recent = await listRequests(wsId, { limit: 200 });
  const changed: Impact["changed"] = [];
  for (const r of recent) {
    const before = r.decision.outcome;
    const prior = Math.max(0, Number(r.decision.facts?.month_to_date ?? r.input.amount) - Number(r.input.amount));
    const after = evaluate(policy, r.input, { now: new Date(r.created_at), priorMonthSpend: prior });
    if (after.outcome !== before)
      changed.push({
        ref: r.ref,
        employee: r.employee_name,
        summary: `${r.input.merchant ?? r.input.category} · ${money(r.input.amount, policy.currency)}`,
        from: before,
        to: after.outcome,
        clause: after.hits[0]?.clause ?? r.decision.hits[0]?.clause ?? null,
      });
  }
  return { issues, tests, diff, impact: { checked: recent.length, changed } as Impact, baseVersion: pub?.version ?? null };
}

// ---------- requests ----------
export async function monthToDate(wsId: string, email: string, category: string, at = new Date()) {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const r = await q(
    `select coalesce(sum((input->>'amount')::float8),0) as s from requests
     where workspace_id=$1 and lower(employee_email)=lower($2) and input->>'category'=$3
       and created_at >= $4 and status in ('approved','pending')`,
    [wsId, email, category, start],
  );
  return Number(r[0]?.s ?? 0);
}

export async function checkSpend(wsId: string, input: RequestInput, opts: { email?: string; useDraft?: boolean } = {}) {
  const v = opts.useDraft ? ((await getDraft(wsId)) ?? (await getPublished(wsId))) : await getPublished(wsId);
  if (!v) return null;
  const prior = opts.email ? await monthToDate(wsId, opts.email, input.category) : 0;
  return { version: v.version, status: v.status, decision: evaluate(v.policy, input, { priorMonthSpend: prior }), currency: v.policy.currency };
}

export async function submitRequest(wsId: string, emp: { name: string; email: string }, input: RequestInput) {
  const pub = await getPublished(wsId);
  if (!pub) throw new Error("Your company hasn't published a spend policy yet.");
  const prior = await monthToDate(wsId, emp.email, input.category);
  const d = evaluate(pub.policy, input, { priorMonthSpend: prior });
  const status = d.outcome === "allow" ? "approved" : d.outcome === "block" ? "blocked" : "pending";
  const n = await q(`select count(*)::int as n from requests where workspace_id=$1`, [wsId]);
  const ref = `EXP-${1001 + (n[0]?.n ?? 0)}`;
  await q(
    `insert into requests (id, workspace_id, ref, employee_name, employee_email, input, decision, policy_version, status, auto, decided_at)
     values ($1,$2,$3,$4,$5,$6::text::jsonb,$7::text::jsonb,$8,$9,true,$10)`,
    [newId("rq"), wsId, ref, emp.name.trim(), emp.email.trim().toLowerCase(), JSON.stringify(input), JSON.stringify(d), pub.version, status, status === "pending" ? null : new Date()],
  );
  await logEvent(wsId, "employee", "request", `${emp.name.trim()} submitted ${ref} — ${d.headline.toLowerCase()}`);
  return ref;
}

const R_COLS = "id, ref, employee_name, employee_email, input, decision, policy_version, status, auto, reviewer, review_note, created_at, decided_at";
export async function listRequests(wsId: string, opts: { status?: string; limit?: number; email?: string } = {}) {
  const params: unknown[] = [wsId];
  let where = "workspace_id=$1";
  if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where += ` and status=$${params.length}`;
  }
  if (opts.email) {
    params.push(opts.email);
    where += ` and lower(employee_email)=lower($${params.length})`;
  }
  params.push(opts.limit ?? 100);
  return (await q(`select ${R_COLS} from requests where ${where} order by created_at desc limit $${params.length}`, params)) as RequestRow[];
}
export async function getRequest(wsId: string, ref: string) {
  return ((await q(`select ${R_COLS} from requests where workspace_id=$1 and ref=$2`, [wsId, ref]))[0] as RequestRow) ?? null;
}
export async function reviewRequest(wsId: string, ref: string, decision: "approved" | "rejected", note: string, reviewer: string, actor: "admin" | "claude") {
  const r = await getRequest(wsId, ref);
  if (!r) throw new Error(`No request ${ref}`);
  if (r.status !== "pending") throw new Error(`${ref} is already ${r.status}`);
  await q(`update requests set status=$3, reviewer=$4, review_note=$5, auto=false, decided_at=now() where workspace_id=$1 and ref=$2`, [
    wsId,
    ref,
    decision,
    reviewer,
    note || null,
  ]);
  await logEvent(wsId, actor, "review", `${reviewer} ${decision} ${ref} (${r.employee_name})`);
}

export async function stats(wsId: string) {
  const r = await q(
    `select count(*)::int as total,
            count(*) filter (where status='pending')::int as pending,
            count(*) filter (where auto and status='approved')::int as auto_approved,
            count(*) filter (where status='blocked')::int as blocked,
            coalesce(sum((input->>'amount')::float8) filter (where status='approved'),0) as approved_spend,
            coalesce(sum((input->>'amount')::float8) filter (where status='blocked'),0) as blocked_spend
     from requests where workspace_id=$1 and created_at > now() - interval '30 days'`,
    [wsId],
  );
  const s = r[0] ?? {};
  return {
    total: Number(s.total ?? 0),
    pending: Number(s.pending ?? 0),
    autoApproved: Number(s.auto_approved ?? 0),
    blocked: Number(s.blocked ?? 0),
    approvedSpend: Number(s.approved_spend ?? 0),
    blockedSpend: Number(s.blocked_spend ?? 0),
  };
}
