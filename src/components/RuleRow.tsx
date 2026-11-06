"use client";
import { useState, useTransition } from "react";
import {
  ACTIONS,
  APPROVERS,
  CATEGORIES,
  FIELDS,
  FIELD_IDS,
  OPS,
  OPS_BY_TYPE,
  approverLabel,
  categoryLabel,
  describeCondition,
  type Condition,
  type FieldId,
  type Rule,
} from "@/lib/engine";
import { deleteRule, saveRule } from "@/app/actions";
import { OutcomePill } from "./ui";

type Change = { kind: "added" | "changed"; fields: string[] } | null;

export function RuleRow({ rule, change, editable, currency, startOpen = false, onClosed }: { rule: Rule; change: Change; editable: boolean; currency: string; startOpen?: boolean; onClosed?: () => void }) {
  const [mode, setMode] = useState<"view" | "quick" | "full">(startOpen ? "full" : "view");
  const close = () => { setMode("view"); onClosed?.(); };
  if (mode === "full") return <RuleEditor rule={rule} currency={currency} onClose={close} isNew={startOpen} />;
  if (mode === "quick") return <QuickEdit rule={rule} currency={currency} onClose={close} onMore={() => setMode("full")} />;
  const scope = rule.categories.length ? rule.categories.map(categoryLabel).join(", ") : "Any expense";
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
      <span className="clause w-10 pt-0.5 text-sm">§{rule.clause || "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {rule.title}
          {change?.kind === "added" && <span className="pill ml-2 bg-ok-bg text-ok">New</span>}
          {change?.kind === "changed" && <span className="pill ml-2 bg-warn-bg text-warn">Changed</span>}
        </p>
        <p className="mt-0.5 text-sm text-ink-2">
          <b className="font-medium text-ink">{scope}</b>
          {rule.when.length ? <> — if {rule.when.map((c) => describeCondition(c, currency)).join(" and ")}</> : null}
        </p>
        {rule.quote && <p className="mt-1.5 text-xs text-muted">Policy says: “{rule.quote}”</p>}
      </div>
      <div className="flex items-center gap-2">
        <OutcomePill outcome={rule.action} approver={rule.approver} />
        {editable && <button onClick={() => setMode("quick")} className="btn-line py-1 text-xs">✎ Edit</button>}
      </div>
    </div>
  );
}

type Outcome = "allow" | "manager" | "finance" | "cfo" | "block";
const OUTCOMES: { v: Outcome; label: string }[] = [
  { v: "allow", label: "Approve automatically" },
  { v: "manager", label: "Needs Manager approval" },
  { v: "finance", label: "Needs Finance approval" },
  { v: "cfo", label: "Needs CFO approval" },
  { v: "block", label: "Not allowed" },
];
const toOutcome = (r: Rule): Outcome => (r.action === "require_approval" ? (r.approver ?? "manager") : r.action);
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Swap old numbers for new ones in the quoted text, so the policy wording keeps matching the rule. */
function swapNumber(text: string, from: number, to: number) {
  if (!text || from === to) return text;
  let out = text;
  for (const variant of [from.toLocaleString("en-US"), String(from)]) {
    const re = new RegExp(`(^|[^\\d.,])(\\$?)${escapeRe(variant)}(?![\\d])`, "g");
    out = out.replace(re, (_m, pre, dollar) => `${pre}${dollar}${variant.includes(",") ? to.toLocaleString("en-US") : to}`);
  }
  return out;
}

function QuickEdit({ rule, currency, onClose, onMore }: { rule: Rule; currency: string; onClose: () => void; onMore: () => void }) {
  const numeric = rule.when.map((c, i) => ({ c, i })).filter(({ c }) => typeof c.value === "number");
  const [values, setValues] = useState<Record<number, string>>(Object.fromEntries(numeric.map(({ c, i }) => [i, String(c.value)])));
  const [outcome, setOutcome] = useState<Outcome>(toOutcome(rule));
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      let quote = rule.quote;
      let message = rule.message;
      const when = rule.when.map((c, i) => {
        if (!(i in values)) return c;
        const next = Number(values[i]);
        if (isNaN(next)) return c;
        quote = swapNumber(quote, c.value as number, next);
        message = swapNumber(message, c.value as number, next);
        return { ...c, value: next };
      });
      const action = outcome === "allow" || outcome === "block" ? outcome : "require_approval";
      await saveRule({ ...rule, when, quote, message, action, approver: action === "require_approval" ? (outcome as Rule["approver"]) : null }, rule.id);
      onClose();
    });
  return (
    <div className="space-y-4 bg-brand-bg/40 px-5 py-5">
      <p className="font-medium"><span className="clause mr-2">§{rule.clause}</span>{rule.title}</p>
      {numeric.map(({ c, i }) => {
        const f = FIELDS[c.field];
        return (
          <div key={i} className="flex flex-wrap items-center gap-3">
            <span className="w-56 text-sm text-ink-2">If {f.label.toLowerCase()} {OPS[c.op]}</span>
            <div className="relative w-40">
              {f.type === "money" && <span className="pointer-events-none absolute top-2 left-3 text-sm text-muted">{currency === "USD" ? "$" : currency}</span>}
              <input type="number" className={`input ${f.type === "money" ? "pl-7" : ""} text-base font-semibold`} value={values[i]} onChange={(e) => setValues({ ...values, [i]: e.target.value })} autoFocus={i === numeric[0].i} />
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-56 text-sm text-ink-2">Then</span>
        <select className="input w-64" value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
          {OUTCOMES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ink" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
        <button className="ml-auto text-sm text-muted underline hover:text-ink" onClick={onMore} disabled={pending}>More options</button>
      </div>
    </div>
  );
}

const listify = (v: Condition["value"]) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));

function RuleEditor({ rule, currency, onClose, isNew }: { rule: Rule; currency: string; onClose: () => void; isNew: boolean }) {
  const [r, setR] = useState<Rule>(structuredClone(rule));
  const [pending, start] = useTransition();
  const set = <K extends keyof Rule>(k: K, v: Rule[K]) => setR((x) => ({ ...x, [k]: v }));
  const setCond = (i: number, c: Partial<Condition>) => set("when", r.when.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const save = () =>
    start(async () => {
      const cleaned: Rule = {
        ...r,
        when: r.when.map((c) => {
          const t = FIELDS[c.field].type;
          const isList = c.op === "in" || c.op === "not_in" || c.op === "contains_any";
          let value: Condition["value"] = c.value;
          if (isList) value = listify(c.value).split(",").map((s) => s.trim()).filter(Boolean);
          else if (t === "money" || t === "number") value = Number(c.value);
          else if (t === "boolean") value = c.value === true || c.value === "true";
          return { ...c, value };
        }),
      };
      await saveRule(cleaned, isNew ? undefined : rule.id);
      onClose();
    });

  return (
    <div className="space-y-4 bg-paper px-5 py-5">
      <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
        <div><label className="label">Clause</label><input className="input font-mono" value={r.clause} onChange={(e) => set("clause", e.target.value)} /></div>
        <div><label className="label">Rule name</label><input className="input" value={r.title} onChange={(e) => set("title", e.target.value)} /></div>
      </div>
      <div><label className="label">Policy text (quoted to employees)</label><textarea className="input text-sm" rows={2} value={r.quote} onChange={(e) => set("quote", e.target.value)} /></div>

      <div>
        <label className="label">Applies to</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = r.categories.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => set("categories", on ? r.categories.filter((x) => x !== c.id) : [...r.categories, c.id])}
                className={`pill border cursor-pointer ${on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2"}`}>
                {c.label}
              </button>
            );
          })}
          <span className="self-center text-xs text-faint">{r.categories.length ? "" : "None selected = every category"}</span>
        </div>
      </div>

      <div>
        <label className="label">When all of these are true</label>
        <div className="space-y-2">
          {r.when.map((c, i) => {
            const f = FIELDS[c.field];
            const ops = OPS_BY_TYPE[f.type];
            const isList = c.op === "in" || c.op === "not_in" || c.op === "contains_any";
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className="input w-auto" value={c.field} onChange={(e) => {
                  const field = e.target.value as FieldId;
                  const t = FIELDS[field].type;
                  setCond(i, { field, op: OPS_BY_TYPE[t][0], value: t === "boolean" ? false : t === "money" || t === "number" ? 0 : [] });
                }}>
                  {FIELD_IDS.map((id) => <option key={id} value={id}>{FIELDS[id].label}</option>)}
                </select>
                <select className="input w-auto" value={c.op} onChange={(e) => setCond(i, { op: e.target.value as Condition["op"] })}>
                  {ops.map((o) => <option key={o} value={o}>{OPS[o]}</option>)}
                </select>
                {f.type === "boolean" ? (
                  <select className="input w-auto" value={String(c.value)} onChange={(e) => setCond(i, { value: e.target.value === "true" })}>
                    <option value="true">yes</option><option value="false">no</option>
                  </select>
                ) : (
                  <div className="relative min-w-40 flex-1">
                    {f.type === "money" && !isList && <span className="pointer-events-none absolute top-2 left-3 text-sm text-muted">{currency === "USD" ? "$" : currency}</span>}
                    <input
                      className={`input ${f.type === "money" && !isList ? "pl-7" : ""} font-mono`}
                      type={!isList && (f.type === "money" || f.type === "number") ? "number" : "text"}
                      value={isList ? listify(c.value) : String(c.value ?? "")}
                      placeholder={isList ? "comma, separated, values" : ""}
                      onChange={(e) => setCond(i, { value: e.target.value })}
                    />
                  </div>
                )}
                <button type="button" className="btn-ghost px-2" onClick={() => set("when", r.when.filter((_, j) => j !== i))} aria-label="Remove condition">✕</button>
              </div>
            );
          })}
          <button type="button" className="btn-ghost px-0 text-sm" onClick={() => set("when", [...r.when, { field: "amount", op: "gt", value: 0 }])}>+ Add condition</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Then</label>
          <select className="input" value={r.action} onChange={(e) => set("action", e.target.value as Rule["action"])}>
            {ACTIONS.map((a) => <option key={a} value={a}>{a === "allow" ? "Auto-approve" : a === "block" ? "Block" : "Require approval"}</option>)}
          </select>
        </div>
        {r.action === "require_approval" && (
          <div>
            <label className="label">Approver</label>
            <select className="input" value={r.approver ?? "manager"} onChange={(e) => set("approver", e.target.value as Rule["approver"])}>
              {APPROVERS.map((a) => <option key={a} value={a}>{approverLabel(a)}</option>)}
            </select>
          </div>
        )}
      </div>
      <div><label className="label">Message to the employee</label><input className="input" value={r.message} onChange={(e) => set("message", e.target.value)} /></div>

      <div className="flex items-center gap-2">
        <button className="btn-ink" onClick={save} disabled={pending}>{pending ? "Saving & re-running tests…" : "Save to draft"}</button>
        <button className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
        {!isNew && (
          <button className="btn-ghost ml-auto text-bad hover:bg-bad-bg hover:text-bad" disabled={pending}
            onClick={() => start(async () => { await deleteRule(rule.id); onClose(); })}>
            Delete rule
          </button>
        )}
      </div>
    </div>
  );
}

export function AddRule({ currency }: { currency: string }) {
  const [newId, setNewId] = useState<string | null>(null);
  if (!newId) return <button className="btn-line" onClick={() => setNewId(`rule-${Date.now().toString(36)}`)}>+ Add rule</button>;
  const blank: Rule = { id: newId, clause: "", title: "", quote: "", categories: [], when: [{ field: "amount", op: "gt", value: 0 }], action: "require_approval", approver: "manager", message: "" };
  return (
    <div className="card mt-3 w-full overflow-hidden">
      <RuleRow rule={blank} change={null} editable currency={currency} startOpen onClosed={() => setNewId(null)} />
    </div>
  );
}
