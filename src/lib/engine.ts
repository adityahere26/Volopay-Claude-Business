// Clause policy engine.
// Pure, deterministic, zero AI. Claude writes the rules once; this file enforces them forever.

export const CATEGORIES = [
  { id: "flights", label: "Flights" },
  { id: "hotels", label: "Hotels" },
  { id: "meals", label: "Meals" },
  { id: "client_entertainment", label: "Client entertainment" },
  { id: "ground_transport", label: "Taxis & ground transport" },
  { id: "software", label: "Software & SaaS" },
  { id: "equipment", label: "Equipment & hardware" },
  { id: "training", label: "Training & conferences" },
  { id: "office_supplies", label: "Office supplies" },
  { id: "other", label: "Other" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"] as const;

export type FieldType = "money" | "number" | "text" | "enum" | "boolean";
export const FIELDS = {
  amount: { label: "Amount", type: "money", help: "Total amount of the expense" },
  per_person: { label: "Amount per attendee", type: "money", help: "Amount divided by number of attendees" },
  per_night: { label: "Amount per night", type: "money", help: "Amount divided by number of nights" },
  month_to_date: {
    label: "Employee's month-to-date spend in this category",
    type: "money",
    help: "Running total for this employee in this category this calendar month, including this request. Clause tracks this; Claude cannot.",
  },
  attendees: { label: "Attendees", type: "number", help: "People covered by the expense, including the employee" },
  nights: { label: "Nights", type: "number", help: "Number of hotel nights" },
  advance_days: { label: "Days booked in advance", type: "number", help: "Days between submission and the expense date" },
  cabin_class: { label: "Cabin class", type: "enum", options: CABIN_CLASSES as readonly string[], help: "Flight cabin" },
  merchant: { label: "Merchant", type: "text", help: "Vendor name" },
  description: { label: "Description", type: "text", help: "Free-text description from the employee" },
  city: { label: "City", type: "text", help: "City where the expense happens" },
  department: { label: "Department", type: "text", help: "Employee department" },
  has_receipt: { label: "Receipt attached", type: "boolean", help: "Whether a receipt was attached" },
} as const satisfies Record<string, { label: string; type: FieldType; help: string; options?: readonly string[] }>;
export type FieldId = keyof typeof FIELDS;
export const FIELD_IDS = Object.keys(FIELDS) as FieldId[];

export const OPS = {
  gt: "is over",
  gte: "is at least",
  lt: "is under",
  lte: "is at most",
  eq: "is",
  neq: "is not",
  in: "is one of",
  not_in: "is not one of",
  contains_any: "mentions",
} as const;
export type Op = keyof typeof OPS;
export const OPS_BY_TYPE: Record<FieldType, Op[]> = {
  money: ["gt", "gte", "lt", "lte", "eq", "neq"],
  number: ["gt", "gte", "lt", "lte", "eq", "neq"],
  text: ["contains_any", "eq", "neq", "in", "not_in"],
  enum: ["eq", "neq", "in", "not_in"],
  boolean: ["eq"],
};

export type Action = "allow" | "require_approval" | "block";
export const ACTIONS: Action[] = ["allow", "require_approval", "block"];
export type Approver = "manager" | "finance" | "cfo";
export const APPROVERS: Approver[] = ["manager", "finance", "cfo"];
export const approverLabel = (a?: string | null) =>
  a === "cfo" ? "CFO" : a === "finance" ? "Finance" : a === "manager" ? "Manager" : "—";
const SEVERITY: Record<Action, number> = { allow: 0, require_approval: 1, block: 2 };
const APPROVER_RANK: Record<Approver, number> = { manager: 0, finance: 1, cfo: 2 };

export type Condition = { field: FieldId; op: Op; value: number | string | boolean | string[] };
export type Rule = {
  id: string;
  clause: string; // e.g. "4.2"
  title: string;
  quote: string; // verbatim policy text this rule enforces
  categories: string[]; // empty = every category
  when: Condition[]; // all must hold; empty = always
  action: Action;
  approver?: Approver | null;
  message: string; // what the employee sees
};
export type TestCase = {
  id: string;
  name: string;
  input: RequestInput;
  prior_month_spend?: number;
  expect: Action;
  expect_approver?: Approver | null;
};
export type Policy = {
  title: string;
  summary?: string;
  currency: string;
  defaults: { unmatched: Action; approver: Approver };
  rules: Rule[];
  tests: TestCase[];
};

export type RequestInput = {
  category: string;
  amount: number;
  merchant?: string;
  description?: string;
  expense_date?: string; // YYYY-MM-DD
  attendees?: number;
  nights?: number;
  cabin_class?: string;
  city?: string;
  department?: string;
  has_receipt?: boolean;
};

export type CondTrace = { text: string; actual: string; ok: boolean };
export type RuleTrace = {
  rule_id: string;
  clause: string;
  title: string;
  applies: boolean; // category in scope
  matched: boolean;
  action: Action;
  conditions: CondTrace[];
};
export type Decision = {
  outcome: Action;
  approver: Approver | null;
  headline: string;
  hits: { rule_id: string; clause: string; title: string; quote: string; message: string; action: Action; approver: Approver | null }[];
  trace: RuleTrace[];
  facts: Record<string, string | number | boolean | null>;
};

// ---------- formatting ----------
export function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function fmtValue(field: FieldId, v: unknown, currency: string): string {
  if (v === null || v === undefined || v === "") return "not provided";
  const t = FIELDS[field].type;
  if (Array.isArray(v)) return v.map((x) => String(x).replace(/_/g, " ")).join(", ");
  if (t === "money" && typeof v === "number") return money(v, currency);
  if (t === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v).replace(/_/g, " ");
}

export function describeCondition(c: Condition, currency = "USD") {
  const f = FIELDS[c.field];
  if (!f) return `${c.field} ${c.op} ${JSON.stringify(c.value)}`;
  if (f.type === "boolean") return `${f.label.toLowerCase()} is ${c.value ? "yes" : "no"}`;
  return `${f.label.toLowerCase()} ${OPS[c.op] ?? c.op} ${fmtValue(c.field, c.value, currency)}`;
}

export function describeRule(r: Rule, currency = "USD") {
  const scope = r.categories.length ? r.categories.map(categoryLabel).join(", ") : "Any expense";
  const cond = r.when.length ? ` where ${r.when.map((c) => describeCondition(c, currency)).join(" and ")}` : "";
  const act =
    r.action === "block" ? "is not allowed" : r.action === "allow" ? "is pre-approved" : `needs ${approverLabel(r.approver)} approval`;
  return `${scope}${cond} ${act}`;
}

// ---------- evaluation ----------
function daysBetween(fromISO: Date, toYMD: string) {
  const to = new Date(toYMD + "T00:00:00Z");
  if (isNaN(to.getTime())) return null;
  const from = Date.UTC(fromISO.getUTCFullYear(), fromISO.getUTCMonth(), fromISO.getUTCDate());
  return Math.round((to.getTime() - from) / 86400000);
}

export function deriveFacts(input: RequestInput, ctx: { now?: Date; priorMonthSpend?: number } = {}) {
  const now = ctx.now ?? new Date();
  const amount = Number(input.amount) || 0;
  const attendees = input.attendees && input.attendees > 0 ? input.attendees : 1;
  const nights = input.nights && input.nights > 0 ? input.nights : null;
  return {
    category: input.category,
    amount,
    per_person: Math.round((amount / attendees) * 100) / 100,
    per_night: nights ? Math.round((amount / nights) * 100) / 100 : null,
    month_to_date: Math.round(((ctx.priorMonthSpend ?? 0) + amount) * 100) / 100,
    attendees,
    nights,
    advance_days: input.expense_date ? daysBetween(now, input.expense_date) : null,
    cabin_class: input.cabin_class || null,
    merchant: input.merchant || null,
    description: input.description || null,
    city: input.city || null,
    department: input.department || null,
    has_receipt: typeof input.has_receipt === "boolean" ? input.has_receipt : null,
  } as Record<string, string | number | boolean | null>;
}

function lc(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function testCondition(c: Condition, actual: unknown): boolean {
  if (actual === null || actual === undefined || actual === "") return false;
  const t = FIELDS[c.field]?.type;
  if (!t) return false;
  if (t === "money" || t === "number") {
    const a = Number(actual);
    const v = Number(c.value);
    switch (c.op) {
      case "gt": return a > v;
      case "gte": return a >= v;
      case "lt": return a < v;
      case "lte": return a <= v;
      case "eq": return a === v;
      case "neq": return a !== v;
      default: return false;
    }
  }
  if (t === "boolean") return Boolean(actual) === Boolean(c.value);
  const a = lc(actual);
  const list = (Array.isArray(c.value) ? c.value : [c.value]).map(lc).filter(Boolean);
  switch (c.op) {
    case "eq": return a === lc(c.value);
    case "neq": return a !== lc(c.value);
    case "in": return list.includes(a);
    case "not_in": return !list.includes(a);
    case "contains_any":
      return list.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(a));
    default: return false;
  }
}

export function evaluate(policy: Policy, input: RequestInput, ctx: { now?: Date; priorMonthSpend?: number } = {}): Decision {
  const currency = policy.currency || "USD";
  const facts = deriveFacts(input, ctx);
  const trace: RuleTrace[] = [];
  const hits: Decision["hits"] = [];

  for (const r of policy.rules) {
    const applies = r.categories.length === 0 || r.categories.includes(input.category);
    const conditions: CondTrace[] = r.when.map((c) => {
      const actual = facts[c.field];
      return { text: describeCondition(c, currency), actual: fmtValue(c.field, actual, currency), ok: applies && testCondition(c, actual) };
    });
    const matched = applies && conditions.every((c) => c.ok);
    trace.push({ rule_id: r.id, clause: r.clause, title: r.title, applies, matched, action: r.action, conditions });
    if (matched) {
      hits.push({
        rule_id: r.id,
        clause: r.clause,
        title: r.title,
        quote: r.quote,
        message: r.message,
        action: r.action,
        approver: r.action === "require_approval" ? (r.approver ?? policy.defaults.approver) : null,
      });
    }
  }

  let outcome: Action;
  let approver: Approver | null = null;
  if (hits.length === 0) {
    outcome = policy.defaults.unmatched;
    if (outcome === "require_approval") approver = policy.defaults.approver;
  } else {
    outcome = hits.reduce<Action>((acc, h) => (SEVERITY[h.action] > SEVERITY[acc] ? h.action : acc), "allow");
    if (outcome === "require_approval") {
      approver = hits
        .filter((h) => h.action === "require_approval" && h.approver)
        .reduce<Approver>((acc, h) => (APPROVER_RANK[h.approver!] > APPROVER_RANK[acc] ? h.approver! : acc), "manager");
    }
  }
  // Most decisive hits first
  hits.sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action]);

  const headline =
    outcome === "allow"
      ? hits.length
        ? "Approved instantly — within policy"
        : "Approved instantly — no policy limit applies"
      : outcome === "block"
        ? "Not allowed by company policy"
        : `Needs ${approverLabel(approver)} approval`;

  return { outcome, approver, headline, hits, trace, facts };
}

// ---------- validation ("lint") ----------
export type Issue = { level: "error" | "warning"; rule_id?: string; message: string };

export function validatePolicy(p: Policy): Issue[] {
  const issues: Issue[] = [];
  const seenIds = new Set<string>();
  if (!Array.isArray(p.rules)) return [{ level: "error", message: "rules must be an array" }];
  for (const r of p.rules) {
    const where = `Rule ${r.clause ? "§" + r.clause : r.id}`;
    if (!r.id) issues.push({ level: "error", message: `${where}: missing id` });
    if (seenIds.has(r.id)) issues.push({ level: "error", rule_id: r.id, message: `${where}: duplicate rule id "${r.id}"` });
    seenIds.add(r.id);
    if (!ACTIONS.includes(r.action)) issues.push({ level: "error", rule_id: r.id, message: `${where}: unknown action "${r.action}"` });
    if (r.action === "require_approval" && r.approver && !APPROVERS.includes(r.approver))
      issues.push({ level: "error", rule_id: r.id, message: `${where}: unknown approver "${r.approver}"` });
    for (const c of r.categories ?? [])
      if (!CATEGORY_IDS.includes(c)) issues.push({ level: "error", rule_id: r.id, message: `${where}: unknown category "${c}"` });
    for (const c of r.when ?? []) {
      const f = FIELDS[c.field as FieldId];
      if (!f) {
        issues.push({ level: "error", rule_id: r.id, message: `${where}: unknown field "${c.field}"` });
        continue;
      }
      if (!OPS_BY_TYPE[f.type].includes(c.op))
        issues.push({ level: "error", rule_id: r.id, message: `${where}: operator "${c.op}" can't be used on ${c.field} (${f.type})` });
      if ((f.type === "money" || f.type === "number") && typeof c.value !== "number")
        issues.push({ level: "error", rule_id: r.id, message: `${where}: ${c.field} needs a number value` });
      if ((c.op === "in" || c.op === "not_in" || c.op === "contains_any") && !Array.isArray(c.value))
        issues.push({ level: "error", rule_id: r.id, message: `${where}: "${c.op}" needs a list of values` });
    }
    // Drift check: the rule's numbers should appear in the policy text it cites.
    const quoted = new Set((r.quote ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []);
    if (quoted.size)
      for (const c of r.when ?? []) {
        const t = FIELDS[c.field as FieldId]?.type;
        if ((t === "money" || t === "number") && typeof c.value === "number" && !quoted.has(c.value))
          issues.push({
            level: "warning",
            rule_id: r.id,
            message: `${where}: the rule uses ${t === "money" ? money(c.value, p.currency) : c.value} but the quoted policy text doesn't mention it — update the quote or the rule so employees see the real limit`,
          });
      }
    if (!r.quote?.trim())
      issues.push({ level: "warning", rule_id: r.id, message: `${where}: no policy quote — employees won't see why` });
    if (r.action === "allow" && r.when.length === 0 && r.categories.length === 0)
      issues.push({ level: "warning", rule_id: r.id, message: `${where}: allows everything — it can never change a decision` });
  }
  const covered = new Set(p.rules.flatMap((r) => (r.categories.length ? r.categories : CATEGORY_IDS)));
  const uncovered = CATEGORY_IDS.filter((c) => !covered.has(c) && c !== "other");
  if (uncovered.length && p.defaults.unmatched === "allow")
    issues.push({ level: "warning", message: `No rules for ${uncovered.map(categoryLabel).join(", ")} — any amount is auto-approved` });
  return issues;
}

// ---------- tests ----------
export type TestResult = { id: string; name: string; expect: Action; expect_approver?: Approver | null; got: Action; got_approver: Approver | null; pass: boolean; cited: string[] };
export function runTests(p: Policy, now = new Date()): TestResult[] {
  return (p.tests ?? []).map((t) => {
    const d = evaluate(p, t.input, { now, priorMonthSpend: t.prior_month_spend ?? 0 });
    const pass = d.outcome === t.expect && (!t.expect_approver || t.expect_approver === d.approver);
    return {
      id: t.id,
      name: t.name,
      expect: t.expect,
      expect_approver: t.expect_approver ?? null,
      got: d.outcome,
      got_approver: d.approver,
      pass,
      cited: d.hits.map((h) => h.clause),
    };
  });
}

// ---------- diff ----------
export type RuleChange = { kind: "added" | "removed" | "changed"; rule: Rule; before?: Rule; fields: string[] };
// Canonical JSON (sorted keys) — Postgres jsonb reorders keys, so plain stringify lies.
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v as object)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v ?? null);
export function diffRules(before: Rule[], after: Rule[]): RuleChange[] {
  const out: RuleChange[] = [];
  const b = new Map(before.map((r) => [r.id, r]));
  const a = new Map(after.map((r) => [r.id, r]));
  for (const r of after) {
    const old = b.get(r.id);
    if (!old) out.push({ kind: "added", rule: r, fields: [] });
    else {
      const fields = (["clause", "title", "quote", "categories", "when", "action", "approver", "message"] as const).filter(
        (k) => stable(old[k] ?? null) !== stable(r[k] ?? null),
      );
      if (fields.length) out.push({ kind: "changed", rule: r, before: old, fields });
    }
  }
  for (const r of before) if (!a.has(r.id)) out.push({ kind: "removed", rule: r, fields: [] });
  return out;
}

// ---------- normalisation of untrusted input (from Claude or the editor) ----------
export function slugId(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "rule"
  );
}

export function normalizeRule(raw: Record<string, unknown>, i = 0): Rule {
  const clause = String(raw.clause ?? "").replace(/^§\s*/, "").trim();
  const title = String(raw.title ?? "").trim() || `Rule ${i + 1}`;
  const action = (ACTIONS as string[]).includes(String(raw.action)) ? (raw.action as Action) : "require_approval";
  const when = Array.isArray(raw.when) ? (raw.when as Record<string, unknown>[]) : [];
  return {
    id: String(raw.id ?? "").trim() || slugId(`${clause}-${title}`),
    clause,
    title,
    quote: String(raw.quote ?? "").trim(),
    categories: Array.isArray(raw.categories) ? (raw.categories as unknown[]).map(String) : [],
    when: when.map((c) => {
      const field = String(c.field) as FieldId;
      let value = c.value as Condition["value"];
      const t = FIELDS[field]?.type;
      if ((t === "money" || t === "number") && typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) value = Number(value);
      if (t === "boolean" && typeof value === "string") value = value === "true";
      return { field, op: String(c.op) as Op, value };
    }),
    action,
    approver: action === "require_approval" ? ((raw.approver as Approver) ?? null) : null,
    message: String(raw.message ?? "").trim(),
  };
}

export function normalizeTest(raw: Record<string, unknown>, i = 0): TestCase {
  const input = (raw.input ?? {}) as RequestInput;
  return {
    id: String(raw.id ?? "").trim() || `t${i + 1}`,
    name: String(raw.name ?? `Test ${i + 1}`),
    input: { ...input, amount: Number(input.amount) || 0 },
    prior_month_spend: raw.prior_month_spend != null ? Number(raw.prior_month_spend) : undefined,
    expect: (ACTIONS as string[]).includes(String(raw.expect)) ? (raw.expect as Action) : "allow",
    expect_approver: (raw.expect_approver as Approver) ?? null,
  };
}

export const EMPTY_POLICY: Policy = {
  title: "Spend policy",
  currency: "USD",
  defaults: { unmatched: "allow", approver: "manager" },
  rules: [],
  tests: [],
};
