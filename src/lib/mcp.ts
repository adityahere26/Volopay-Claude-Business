import "server-only";
// A minimal, dependency-free MCP server (Streamable HTTP, stateless JSON responses).
// Claude calls these tools; every tool is plain code + database. No AI in here.
import {
  ACTIONS,
  APPROVERS,
  CABIN_CLASSES,
  CATEGORY_IDS,
  FIELDS,
  FIELD_IDS,
  OPS,
  describeRule,
  money,
  normalizeRule,
  normalizeTest,
  type Policy,
  type RequestInput,
} from "./engine";
import {
  analyze,
  checkSpend,
  getDraft,
  getPublished,
  listRequests,
  logEvent,
  reviewRequest,
  saveDraft,
  stats,
  type Workspace,
} from "./store";

import { SAMPLE_POLICY_TEXT } from "./seed";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const conditionSchema = {
  type: "object",
  properties: {
    field: { type: "string", enum: FIELD_IDS, description: FIELD_IDS.map((f) => `${f} (${FIELDS[f].type}): ${FIELDS[f].help}`).join("; ") },
    op: { type: "string", enum: Object.keys(OPS), description: "money/number: gt,gte,lt,lte,eq,neq · text: contains_any,eq,neq,in,not_in · enum: eq,neq,in,not_in · boolean: eq" },
    value: { description: "number for money/number fields; string; boolean; or array of strings for in/not_in/contains_any" },
  },
  required: ["field", "op", "value"],
};
const ruleSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Stable kebab-case id, e.g. 'hotel-cap'. Reuse the existing id when changing a rule so the diff is meaningful." },
    clause: { type: "string", description: "Clause number from the document, e.g. '4.1'" },
    title: { type: "string", description: "Short name, e.g. 'Hotel nightly cap'" },
    quote: { type: "string", description: "VERBATIM sentence(s) from the policy this rule enforces. Shown to employees as the reason." },
    categories: { type: "array", items: { type: "string", enum: CATEGORY_IDS }, description: "Categories in scope. Empty array = all categories." },
    when: { type: "array", items: conditionSchema, description: "ALL conditions must hold for the rule to fire. Empty = always fires for its categories." },
    action: { type: "string", enum: ACTIONS, description: "What happens when the rule fires. Most restrictive firing rule wins: block > require_approval > allow." },
    approver: { type: "string", enum: APPROVERS, description: "Required when action is require_approval. Highest approver among firing rules wins." },
    message: { type: "string", description: "One friendly sentence telling the employee what to do." },
  },
  required: ["id", "clause", "title", "quote", "categories", "when", "action", "message"],
};
const requestSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORY_IDS },
    amount: { type: "number" },
    merchant: { type: "string" },
    description: { type: "string" },
    expense_date: { type: "string", description: "YYYY-MM-DD; for flights this is the departure date" },
    attendees: { type: "number" },
    nights: { type: "number" },
    cabin_class: { type: "string", enum: CABIN_CLASSES as unknown as string[] },
    city: { type: "string" },
    department: { type: "string" },
    has_receipt: { type: "boolean" },
  },
  required: ["category", "amount"],
};
const testSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string", description: "e.g. '$300/night in London is within the high-cost cap'" },
    input: requestSchema,
    prior_month_spend: { type: "number", description: "Employee's spend in this category earlier this month (for month_to_date rules)" },
    expect: { type: "string", enum: ACTIONS },
    expect_approver: { type: "string", enum: APPROVERS },
  },
  required: ["name", "input", "expect"],
};

const TOOLS = [
  {
    name: "get_workspace",
    description:
      "Start here. Returns the company, the policy currently ENFORCED (published), any pending draft, 30-day stats, and the links for the finance admin. Call before drafting or editing rules.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_sample_policy",
    description:
      "Returns a realistic sample Travel & Expense policy document (Northwind Labs, 2026). Use it when the user wants to try Clause, asks for 'the sample policy', or has no policy document of their own. Then convert it with propose_policy.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "propose_policy",
    description: `Turn a written spend / travel & expense policy into enforceable Clause rules and save them as a DRAFT for a human to review. Nothing goes live until a finance admin publishes it in Clause.

How to do this well:
1. Read the whole document. Create one rule per enforceable limit. If a clause has two thresholds (e.g. $500 → manager, $2,000 → finance) make two rules.
2. Always copy the exact sentence into 'quote' and the clause number into 'clause' — employees see this as the reason for every decision.
3. Exceptions are separate rules with narrower conditions (e.g. a high-cost-city hotel cap uses city in [...] and a higher amount). Because the most restrictive firing rule wins, write the general rule so it does NOT fire for the exception (e.g. per_night > 250 AND city not_in [high-cost cities]).
4. Use month_to_date for monthly allowances — Clause tracks each employee's running total; you don't need to.
5. Write 8-15 tests that pin down the edge cases (just under/over each threshold, exceptions, blocked items). Clause runs them and returns failures — fix the rules and call again until all pass.
6. Reuse existing rule ids when a rule is the same limit with a new value, so the admin sees a clean diff.

The response tells you validation errors, test results, what changed versus the enforced version, and which REAL past requests would have been decided differently. Summarise that for the user and give them the review link.`,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "e.g. 'Northwind Labs Travel & Expense Policy (2026)'" },
        summary: { type: "string", description: "1-2 sentence summary of what changed or what this policy covers" },
        currency: { type: "string", description: "ISO currency code, default USD" },
        unmatched: { type: "string", enum: ACTIONS, description: "What happens if no rule fires. Usually 'allow'." },
        default_approver: { type: "string", enum: APPROVERS },
        rules: { type: "array", items: ruleSchema },
        tests: { type: "array", items: testSchema },
      },
      required: ["title", "rules", "tests"],
    },
  },
  {
    name: "update_rule",
    description:
      "Add or replace ONE rule in the draft (creates a draft from the enforced policy if none exists). Use for small edits like 'raise the meal cap to $70'. Match by id to replace. Returns tests + impact.",
    inputSchema: { type: "object", properties: { rule: ruleSchema }, required: ["rule"] },
  },
  {
    name: "remove_rule",
    description: "Remove one rule from the draft by id. Returns tests + impact.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "check_spend",
    description:
      "Ask 'would this expense be approved?' against the enforced policy (or the draft). Deterministic, cites the clause. Does not record anything. Pass employee_email to include their month-to-date spend.",
    inputSchema: {
      type: "object",
      properties: {
        request: requestSchema,
        employee_email: { type: "string" },
        against: { type: "string", enum: ["published", "draft"], description: "Default published" },
      },
      required: ["request"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_requests",
    description:
      "List real expense requests employees submitted through Clause, with the decision and cited clauses. Use to find pending approvals or to spot patterns (e.g. which rule sends the most requests to approval).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "pending", "approved", "rejected", "blocked"] },
        limit: { type: "number", description: "Default 30" },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "review_request",
    description: "Approve or reject a PENDING request on behalf of the finance admin. Only do this when the user explicitly asks.",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "e.g. EXP-1012" },
        decision: { type: "string", enum: ["approved", "rejected"] },
        note: { type: "string", description: "Reason shown to the employee" },
      },
      required: ["ref", "decision"],
    },
  },
];

function baseUrl(req: Request) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type Ctx = { ws: Workspace; base: string };

async function analysisReport(ctx: Ctx, policy: Policy, version: number) {
  const a = await analyze(ctx.ws.id, policy);
  const errors = a.issues.filter((i) => i.level === "error");
  const warnings = a.issues.filter((i) => i.level === "warning");
  const failed = a.tests.filter((t) => !t.pass);
  return {
    draft_version: version,
    review_url: `${ctx.base}/app/policy`,
    validation: { errors: errors.map((e) => e.message), warnings: warnings.map((w) => w.message) },
    tests: {
      passed: a.tests.length - failed.length,
      total: a.tests.length,
      failures: failed.map((t) => ({ name: t.name, expected: t.expect + (t.expect_approver ? `/${t.expect_approver}` : ""), got: t.got + (t.got_approver ? `/${t.got_approver}` : ""), cited: t.cited })),
    },
    changes_vs_enforced: {
      enforced_version: a.baseVersion,
      added: a.diff.filter((d) => d.kind === "added").map((d) => `§${d.rule.clause} ${d.rule.title}`),
      changed: a.diff.filter((d) => d.kind === "changed").map((d) => `§${d.rule.clause} ${d.rule.title} (${d.fields.join(", ")})`),
      removed: a.diff.filter((d) => d.kind === "removed").map((d) => `§${d.rule.clause} ${d.rule.title}`),
    },
    impact_on_past_requests: {
      checked: a.impact.checked,
      would_change: a.impact.changed.slice(0, 15).map((c) => `${c.ref} ${c.employee} (${c.summary}): ${c.from} → ${c.to}${c.clause ? ` [§${c.clause}]` : ""}`),
    },
    next_step:
      errors.length || failed.length
        ? "Fix the errors / failing tests and call again."
        : `Tell the user the draft is ready and that a finance admin must review and publish it at ${ctx.base}/app/policy. Nothing is enforced until then.`,
  };
}

async function currentDraftPolicy(ws: Workspace): Promise<Policy> {
  const d = await getDraft(ws.id);
  if (d) return d.policy;
  const p = await getPublished(ws.id);
  return p?.policy ?? { title: "Spend policy", currency: "USD", defaults: { unmatched: "allow", approver: "manager" }, rules: [], tests: [] };
}

async function callTool(ctx: Ctx, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { ws, base } = ctx;
  switch (name) {
    case "get_workspace": {
      const [pub, draft, s] = await Promise.all([getPublished(ws.id), getDraft(ws.id), stats(ws.id)]);
      return {
        company: ws.name,
        admin: ws.admin_name,
        links: { admin_review: `${base}/app/policy`, approvals: `${base}/app/requests`, employee_portal: `${base}/r/${ws.slug}` },
        enforced_policy: pub
          ? { version: pub.version, title: pub.policy.title, currency: pub.policy.currency, defaults: pub.policy.defaults, rules: pub.policy.rules, test_count: pub.policy.tests.length }
          : "None yet — use propose_policy to create the first version.",
        pending_draft: draft ? { version: draft.version, source: draft.source, rule_count: draft.policy.rules.length, note: draft.note } : null,
        last_30_days: s,
        categories: CATEGORY_IDS,
      };
    }
    case "get_sample_policy":
      return { document: SAMPLE_POLICY_TEXT, next_step: "Convert this document into rules and tests with propose_policy." };
    case "propose_policy": {
      const rules = ((args.rules as Record<string, unknown>[]) ?? []).map(normalizeRule);
      const tests = ((args.tests as Record<string, unknown>[]) ?? []).map(normalizeTest);
      const policy: Policy = {
        title: String(args.title ?? "Spend policy"),
        summary: args.summary ? String(args.summary) : undefined,
        currency: String(args.currency ?? "USD").toUpperCase(),
        defaults: {
          unmatched: (ACTIONS as string[]).includes(String(args.unmatched)) ? (args.unmatched as Policy["defaults"]["unmatched"]) : "allow",
          approver: (APPROVERS as string[]).includes(String(args.default_approver)) ? (args.default_approver as Policy["defaults"]["approver"]) : "manager",
        },
        rules,
        tests,
      };
      const saved = await saveDraft(ws.id, policy, { source: "claude", note: policy.summary ?? "Drafted by Claude" });
      await logEvent(ws.id, "claude", "drafted", `Claude ${saved.created ? "drafted" : "revised"} v${saved.version} — ${rules.length} rules, ${tests.length} tests`);
      return analysisReport(ctx, policy, saved.version);
    }
    case "update_rule": {
      const policy = await currentDraftPolicy(ws);
      const rule = normalizeRule((args.rule ?? {}) as Record<string, unknown>, policy.rules.length);
      const idx = policy.rules.findIndex((r) => r.id === rule.id);
      if (idx >= 0) policy.rules[idx] = rule;
      else policy.rules.push(rule);
      const saved = await saveDraft(ws.id, policy, { source: "claude" });
      await logEvent(ws.id, "claude", "rule", `Claude ${idx >= 0 ? "updated" : "added"} §${rule.clause} ${rule.title} in draft v${saved.version}`);
      return { rule: describeRule(rule, policy.currency), ...(await analysisReport(ctx, policy, saved.version)) };
    }
    case "remove_rule": {
      const policy = await currentDraftPolicy(ws);
      const rule = policy.rules.find((r) => r.id === args.id);
      if (!rule) throw new Error(`No rule with id "${args.id}". Rule ids: ${policy.rules.map((r) => r.id).join(", ")}`);
      policy.rules = policy.rules.filter((r) => r.id !== args.id);
      const saved = await saveDraft(ws.id, policy, { source: "claude" });
      await logEvent(ws.id, "claude", "rule", `Claude removed §${rule.clause} ${rule.title} from draft v${saved.version}`);
      return analysisReport(ctx, policy, saved.version);
    }
    case "check_spend": {
      const r = await checkSpend(ws.id, args.request as RequestInput, {
        email: args.employee_email as string | undefined,
        useDraft: args.against === "draft",
      });
      if (!r) return { error: "No policy exists yet. Use propose_policy first." };
      const d = r.decision;
      return {
        evaluated_against: `v${r.version} (${r.status})`,
        outcome: d.outcome,
        approver: d.approver,
        headline: d.headline,
        reasons: d.hits.map((h) => ({ clause: `§${h.clause}`, rule: h.title, quote: h.quote, message: h.message, action: h.action })),
        month_to_date: d.facts.month_to_date,
      };
    }
    case "list_requests": {
      const rows = await listRequests(ws.id, { status: (args.status as string) ?? "all", limit: Math.min(Number(args.limit) || 30, 100) });
      return {
        count: rows.length,
        requests: rows.map((r) => ({
          ref: r.ref,
          employee: r.employee_name,
          department: r.input.department,
          category: r.input.category,
          amount: money(r.input.amount),
          merchant: r.input.merchant,
          description: r.input.description,
          status: r.status,
          decided_by: r.auto ? "Clause (automatic)" : r.reviewer,
          cited: r.decision.hits.map((h) => `§${h.clause} ${h.title}`),
          policy_version: r.policy_version,
          submitted: new Date(r.created_at).toISOString().slice(0, 10),
        })),
        approvals_page: `${base}/app/requests`,
      };
    }
    case "review_request": {
      await reviewRequest(ws.id, String(args.ref), args.decision as "approved" | "rejected", String(args.note ?? ""), `${ws.admin_name} via Claude`, "claude");
      return { ok: true, ref: args.ref, status: args.decision };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

type RpcMsg = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handleOne(ctx: Ctx, msg: RpcMsg) {
  const isNotification = msg.id === undefined || msg.id === null;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  try {
    switch (msg.method) {
      case "initialize": {
        const requested = String(msg.params?.protocolVersion ?? "");
        return reply({
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "clause", title: `Clause — ${ctx.ws.name}`, version: "1.0.0" },
          instructions: `Clause turns ${ctx.ws.name}'s written spend policy into deterministic rules that employees are checked against instantly. You (Claude) do the reading and drafting; Clause stores, tests, enforces and keeps the audit trail. Drafts only go live after a human publishes them. Call get_workspace first.`,
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        try {
          const out = await callTool(ctx, name, args);
          return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out as Record<string, unknown> });
        } catch (e) {
          if (e instanceof RpcError) throw e;
          return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
        }
      }
      case "resources/list":
        return reply({ resources: [] });
      case "prompts/list":
        return reply({ prompts: [] });
      default:
        if (isNotification) return null;
        return fail(-32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    if (e instanceof RpcError) return fail(e.code, e.message);
    return fail(-32603, (e as Error).message);
  }
}

export async function handleMcp(req: Request, ws: Workspace) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const ctx: Ctx = { ws, base: baseUrl(req) };
  const msgs = Array.isArray(body) ? (body as RpcMsg[]) : [body as RpcMsg];
  const out = (await Promise.all(msgs.map((m) => handleOne(ctx, m)))).filter(Boolean);
  if (out.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0]);
}
