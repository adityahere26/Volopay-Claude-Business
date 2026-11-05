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
  const [open, setOpen] = useState(startOpen);
  if (open) return <RuleEditor rule={rule} currency={currency} onClose={() => { setOpen(false); onClosed?.(); }} isNew={startOpen} />;
  return (
    <div className={`group relative px-5 py-4 ${change?.kind === "added" ? "bg-ok-bg/40" : change ? "bg-warn-bg/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="clause text-sm">§{rule.clause || "—"}</span>
        <span className="font-medium">{rule.title}</span>
        {change?.kind === "added" && <span className="pill bg-ok text-white">New</span>}
        {change?.kind === "changed" && <span className="pill bg-warn text-white" title={change.fields.join(", ")}>Changed · {change.fields.filter((f) => f !== "quote").join(", ") || "wording"}</span>}
        <span className="ml-auto flex items-center gap-2">
          {editable && (
            <button onClick={() => setOpen(true)} className="btn-line py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
              Edit
            </button>
          )}
          <OutcomePill outcome={rule.action} approver={rule.approver} />
        </span>
      </div>
      {rule.quote && <p className="quote mt-2.5">“{rule.quote}”</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
        <span className="rounded bg-line-2 px-2 py-1 text-ink-2">{rule.categories.length ? rule.categories.map(categoryLabel).join(" / ") : "Any category"}</span>
        {rule.when.map((c, i) => (
          <span key={i} className="rounded bg-line-2 px-2 py-1 text-ink-2">
            {i === 0 ? "when " : "and "}
            {describeCondition(c, currency)}
          </span>
        ))}
      </div>
      {rule.message && <p className="mt-2 text-sm text-muted">Employee sees: “{rule.message}”</p>}
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
      <div><label className="label">Policy text (quoted to employees)</label><textarea className="input font-serif text-base" rows={2} value={r.quote} onChange={(e) => set("quote", e.target.value)} /></div>

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
