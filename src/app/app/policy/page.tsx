import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { analyze, getDraft, getPublished, listVersions } from "@/lib/store";
import { approverLabel, runTests, type Action, type Rule } from "@/lib/engine";
import { RuleRow, AddRule } from "@/components/RuleRow";
import { EditPolicyButton, PublishBar } from "@/components/PolicyActions";
import { ClaudeMark, OutcomePill, ago } from "@/components/ui";

const byClause = (a: Rule, b: Rule) => a.clause.localeCompare(b.clause, undefined, { numeric: true });
const outcomeWord = (a: Action) => (a === "allow" ? "auto-approve" : a === "block" ? "block" : "approval");

export default async function PolicyPage() {
  const ws = await requireWorkspace();
  const [draft, pub, versions] = await Promise.all([getDraft(ws.id), getPublished(ws.id), listVersions(ws.id)]);
  const current = draft ?? pub;

  if (!current)
    return (
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Policy</p>
        <h1 className="mt-2 font-serif text-4xl">No policy yet</h1>
        <p className="mt-3 text-ink-2">The fastest way: connect Claude, drop in your expense policy document, and say “set this up in Clause”. You&apos;ll review everything here before it goes live.</p>
        <div className="mt-6 flex gap-2">
          <Link href="/app/connect" className="btn-ink"><ClaudeMark /> Connect Claude</Link>
          <EditPolicyButton />
        </div>
      </div>
    );

  const policy = current.policy;
  const a = draft ? await analyze(ws.id, policy) : null;
  const tests = a?.tests ?? runTests(policy);
  const errors = a?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = a?.issues.filter((i) => i.level === "warning") ?? [];
  const failing = tests.filter((t) => !t.pass);
  const changeOf = new Map(a?.diff.filter((d) => d.kind !== "removed").map((d) => [d.rule.id, { kind: d.kind as "added" | "changed", fields: d.fields }]));
  const removed = a?.diff.filter((d) => d.kind === "removed") ?? [];
  const counts = { added: a?.diff.filter((d) => d.kind === "added").length ?? 0, changed: a?.diff.filter((d) => d.kind === "changed").length ?? 0, removed: removed.length };
  const blocked = errors.length ? `Fix ${errors.length} error(s) first` : failing.length ? `${failing.length} test(s) failing` : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{draft ? `Draft v${draft.version} · not enforced yet` : `Enforced · v${pub!.version}`}</p>
          <h1 className="mt-2 max-w-2xl font-serif text-4xl leading-tight">{policy.title}</h1>
          {policy.summary && <p className="mt-2 max-w-2xl text-ink-2">{policy.summary}</p>}
        </div>
        {draft ? <PublishBar version={draft.version} blocked={blocked} impact={a?.impact.changed.length ?? 0} /> : <EditPolicyButton />}
      </div>

      {draft && a && (
        <>
          <div className="mt-5 flex items-center gap-2 text-sm text-muted">
            {draft.source === "claude" ? (
              <span className="pill bg-claude-bg text-claude"><ClaudeMark className="h-3 w-3" /> Proposed by Claude via MCP</span>
            ) : (
              <span className="pill bg-line-2 text-ink-2">Edited by hand</span>
            )}
            <span>updated {ago(draft.updated_at)} · compared with enforced v{a.baseVersion ?? "—"}</span>
          </div>

          {/* The review strip: this is what a human needs before saying yes */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <a href="#tests" className={`card p-4 hover:border-ink ${failing.length ? "border-bad/40" : ""}`}>
              <p className="text-xs text-muted">Test cases</p>
              <p className={`mt-1 font-serif text-3xl ${failing.length ? "text-bad" : "text-ok"}`}>{tests.length - failing.length}/{tests.length} pass</p>
              <p className="mt-1 text-xs text-faint">{failing.length ? `${failing.length} failing — see below` : "Every edge case behaves as written"}</p>
            </a>
            <a href="#rules" className="card p-4 hover:border-ink">
              <p className="text-xs text-muted">Changes vs. v{a.baseVersion ?? 0}</p>
              <p className="mt-1 font-serif text-3xl">
                <span className="text-ok">+{counts.added}</span> <span className="text-warn">~{counts.changed}</span> <span className="text-bad">−{counts.removed}</span>
              </p>
              <p className="mt-1 text-xs text-faint">added · changed · removed rules</p>
            </a>
            <a href="#impact" className="card p-4 hover:border-ink">
              <p className="text-xs text-muted">Replayed on real history</p>
              <p className="mt-1 font-serif text-3xl">{a.impact.changed.length} <span className="text-lg text-muted">of {a.impact.checked}</span></p>
              <p className="mt-1 text-xs text-faint">past decisions would come out differently</p>
            </a>
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="card mt-3 divide-y divide-line-2">
              {errors.map((e, i) => <p key={"e" + i} className="px-4 py-2 text-sm text-bad">✕ {e.message}</p>)}
              {warnings.map((w, i) => <p key={"w" + i} className="px-4 py-2 text-sm text-warn">! {w.message}</p>)}
            </div>
          )}

          {a.impact.changed.length > 0 && (
            <section id="impact" className="card mt-6 overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h2 className="font-medium">What would change for real people</h2>
                <p className="text-sm text-muted">Clause re-ran the last {a.impact.checked} real requests through this draft. These would be decided differently.</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {a.impact.changed.map((c) => (
                    <tr key={c.ref} className="border-b border-line-2 last:border-0">
                      <td className="px-5 py-2 font-mono text-xs"><Link className="hover:underline" href={`/app/requests/${c.ref}`}>{c.ref}</Link></td>
                      <td className="py-2">{c.employee}</td>
                      <td className="py-2 text-muted">{c.summary}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span className="text-muted line-through decoration-faint">{outcomeWord(c.from)}</span>
                        <span className="mx-1.5 text-faint">→</span>
                        <span className={c.to === "allow" ? "text-ok" : c.to === "block" ? "text-bad" : "text-warn"}>{outcomeWord(c.to)}</span>
                      </td>
                      <td className="px-5 py-2 text-right">{c.clause && <span className="clause text-xs">§{c.clause}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      <section id="rules" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Rules <span className="text-muted">({policy.rules.length})</span></h2>
          <p className="text-sm text-muted">
            Most restrictive rule wins. No rule matches → <b className="text-ink">{policy.defaults.unmatched === "allow" ? "auto-approve" : `${approverLabel(policy.defaults.approver)} approval`}</b>
          </p>
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          {[...policy.rules].sort(byClause).map((r) => (
            <RuleRow key={r.id + (draft?.updated_at?.toString() ?? "")} rule={r} change={changeOf.get(r.id) ?? null} editable={!!draft} currency={policy.currency} />
          ))}
          {removed.map((d) => (
            <div key={d.rule.id} className="bg-bad-bg/40 px-5 py-3 text-sm">
              <span className="pill mr-2 bg-bad text-white">Removed</span>
              <span className="clause">§{d.rule.clause}</span> <span className="line-through">{d.rule.title}</span>
            </div>
          ))}
        </div>
        {draft && <div className="mt-3"><AddRule currency={policy.currency} /></div>}
      </section>

      <section id="tests" className="mt-10">
        <h2 className="font-serif text-2xl">Test cases <span className="text-muted">({tests.length})</span></h2>
        <p className="mt-1 text-sm text-muted">Written by Claude from the document&apos;s edge cases. Re-run on every edit — a rule change that breaks one can&apos;t be published.</p>
        <div className="card mt-3 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-muted">
              <tr><th className="px-5 py-2 font-medium">Scenario</th><th className="py-2 font-medium">Expected</th><th className="py-2 font-medium">Clause decides</th><th className="px-5 py-2 font-medium">Cited</th></tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className={`border-t border-line-2 ${t.pass ? "" : "bg-bad-bg/50"}`}>
                  <td className="px-5 py-2.5"><span className={t.pass ? "text-ok" : "text-bad"}>{t.pass ? "✓" : "✕"}</span> {t.name}</td>
                  <td className="py-2.5"><OutcomePill outcome={t.expect} approver={t.expect_approver} /></td>
                  <td className="py-2.5"><OutcomePill outcome={t.got} approver={t.got_approver} /></td>
                  <td className="px-5 py-2.5 font-mono text-xs text-mark">{t.cited.map((c) => `§${c}`).join(" ")}</td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-muted">No tests yet. Ask Claude: “add test cases for the edge cases in our policy”.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 mb-10">
        <h2 className="font-serif text-2xl">Version history</h2>
        <ol className="mt-3 space-y-1.5">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-8 font-mono">v{v.version}</span>
              <span className={`pill ${v.status === "published" ? "bg-ok-bg text-ok" : v.status === "draft" ? "bg-warn-bg text-warn" : "bg-line-2 text-muted"}`}>{v.status === "published" ? "Enforced" : v.status}</span>
              {v.source === "claude" && <span className="pill bg-claude-bg text-claude"><ClaudeMark className="h-3 w-3" /> Claude</span>}
              <span className="text-ink-2">{v.policy.title}</span>
              <span className="text-faint">· {v.policy.rules.length} rules · {v.published_at ? `published ${ago(v.published_at)} by ${v.published_by}` : `created ${ago(v.created_at)}`}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
