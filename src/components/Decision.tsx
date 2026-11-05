import type { Decision } from "@/lib/engine";
import { approverLabel } from "@/lib/engine";

export function Verdict({ d, status }: { d: Decision; status?: string }) {
  const tone =
    status === "rejected" || d.outcome === "block" ? "bad" : status === "approved" || d.outcome === "allow" ? "ok" : "warn";
  const title =
    status === "approved" && d.outcome === "require_approval"
      ? "Approved"
      : status === "rejected"
        ? "Rejected"
        : d.headline;
  const cls = { ok: "border-ok/30 bg-ok-bg text-ok", warn: "border-warn/30 bg-warn-bg text-warn", bad: "border-bad/30 bg-bad-bg text-bad" }[tone];
  return (
    <div className={`rounded-xl border px-5 py-4 ${cls}`}>
      <p className="font-serif text-3xl">{title}</p>
      {d.outcome === "require_approval" && status === "pending" && <p className="mt-1 text-sm text-ink-2">Waiting on {approverLabel(d.approver)}. You don&apos;t need to do anything else.</p>}
    </div>
  );
}

export function Reasons({ d }: { d: Decision }) {
  if (!d.hits.length)
    return <p className="text-sm text-ink-2">No limit in the policy applies to this expense, so it&apos;s within policy.</p>;
  return (
    <ul className="space-y-4">
      {d.hits.map((h) => (
        <li key={h.rule_id}>
          <p className="text-sm"><span className="clause">§{h.clause}</span> <b>{h.title}</b></p>
          {h.quote && <p className="quote mt-1.5">“{h.quote}”</p>}
          {h.message && <p className="mt-1.5 text-sm text-ink-2">{h.message}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Every rule Clause looked at and why it did or didn't fire — the audit trail. */
export function Trace({ d }: { d: Decision }) {
  const relevant = d.trace.filter((t) => t.applies);
  return (
    <div className="font-mono text-[12px]">
      {relevant.map((t) => (
        <div key={t.rule_id} className={`border-b border-line-2 px-4 py-2 last:border-0 ${t.matched ? "bg-paper" : ""}`}>
          <div className="flex items-center gap-2">
            <span className={t.matched ? "text-ink" : "text-faint"}>{t.matched ? "●" : "○"}</span>
            <span className="text-mark">§{t.clause}</span>
            <span className={t.matched ? "text-ink" : "text-muted"}>{t.title}</span>
            <span className="ml-auto text-faint">{t.matched ? `fired → ${t.action.replace("_", " ")}` : "did not fire"}</span>
          </div>
          {t.conditions.map((c, i) => (
            <p key={i} className="ml-5 text-muted">
              <span className={c.ok ? "text-ok" : "text-faint"}>{c.ok ? "✓" : "✗"}</span> {c.text} <span className="text-faint">(actual: {c.actual})</span>
            </p>
          ))}
        </div>
      ))}
      <p className="px-4 py-2 text-faint">{d.trace.length - relevant.length} other rules skipped — different category.</p>
    </div>
  );
}
