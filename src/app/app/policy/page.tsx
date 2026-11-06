import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { analyze, getDraft, getPublished, listVersions } from "@/lib/store";
import { runTests, type Action, type Rule } from "@/lib/engine";
import { RuleRow, AddRule } from "@/components/RuleRow";
import { EditPolicyButton, PublishBar } from "@/components/PolicyActions";
import { ClaudeMark, OutcomePill, ago } from "@/components/ui";

const byClause = (a: Rule, b: Rule) => a.clause.localeCompare(b.clause, undefined, { numeric: true });
const word = (a: Action) => (a === "allow" ? "approved" : a === "block" ? "blocked" : "needs approval");

export default async function PolicyPage() {
  const ws = await requireWorkspace();
  const [draft, pub, versions] = await Promise.all([getDraft(ws.id), getPublished(ws.id), listVersions(ws.id)]);
  const current = draft ?? pub;

  if (!current)
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="font-serif text-4xl">No policy yet</h1>
        <p className="mt-3 text-ink-2">Ask Claude to write it for you. It takes about a minute.</p>
        <Link href="/app/connect" className="btn-ink mt-6 px-6 py-3 text-base"><ClaudeMark /> Connect Claude</Link>
      </div>
    );

  const policy = current.policy;
  const a = draft ? await analyze(ws.id, policy) : null;
  const tests = a?.tests ?? runTests(policy);
  const errors = a?.issues.filter((i) => i.level === "error") ?? [];
  const failing = tests.filter((t) => !t.pass);
  const changeOf = new Map(a?.diff.filter((d) => d.kind !== "removed").map((d) => [d.rule.id, { kind: d.kind as "added" | "changed", fields: d.fields }]));
  const added = a?.diff.filter((d) => d.kind === "added").length ?? 0;
  const changed = a?.diff.filter((d) => d.kind === "changed").length ?? 0;
  const removed = a?.diff.filter((d) => d.kind === "removed") ?? [];
  const blocked = errors.length ? `Fix ${errors.length} problem(s) first` : failing.length ? `${failing.length} check(s) failing` : null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* ---------- One clear status + one clear action ---------- */}
      {draft ? (
        <div className="card overflow-hidden border-brand/30">
          <div className="flex flex-wrap items-center gap-4 bg-brand-bg/60 px-6 py-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-claude shadow-sm"><ClaudeMark className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{draft.source === "claude" ? "Claude wrote a new version of your policy" : "You have unpublished changes"}</p>
              <p className="text-sm text-ink-2">Look over the rules below. Change anything with <b>Edit</b>. When it looks right, press <b>Publish</b>.</p>
            </div>
            <PublishBar version={draft.version} blocked={blocked} impact={a?.impact.changed.length ?? 0} />
          </div>
          <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-4">
              <p className={`text-2xl font-bold ${failing.length ? "text-bad" : "text-ok"}`}>{failing.length ? `✕ ${failing.length} failing` : "✓ All good"}</p>
              <p className="text-sm text-muted">{tests.length - failing.length} of {tests.length} automatic checks passed</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-2xl font-bold">{added + changed + removed.length} changes</p>
              <p className="text-sm text-muted">{added} new · {changed} updated · {removed.length} removed</p>
            </div>
            <a href="#impact" className="px-6 py-4 hover:bg-paper">
              <p className="text-2xl font-bold">{a?.impact.changed.length ?? 0} past expenses</p>
              <p className="text-sm text-muted">would be decided differently <span className="text-brand">· see which ↓</span></p>
            </a>
          </div>
          {errors.length > 0 && (
            <div className="border-t border-line bg-bad-bg px-6 py-3 text-sm text-bad">
              {errors.map((e, i) => <p key={i}>✕ {e.message}</p>)}
            </div>
          )}
        </div>
      ) : (
        <div className="card flex flex-wrap items-center gap-4 px-6 py-5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ok-bg text-xl text-ok">✓</span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">This policy is live</p>
            <p className="text-sm text-ink-2">Every expense your team submits is checked against these rules instantly.</p>
          </div>
          <Link href={`/r/${ws.slug}`} target="_blank" className="btn-line">Try it as an employee ↗</Link>
          <EditPolicyButton />
        </div>
      )}

      {/* ---------- The rules, in plain sentences ---------- */}
      <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl">{policy.title}</h1>
          <p className="text-sm text-muted">{policy.rules.length} rules · version {current.version}{draft ? " (draft)" : ""} · {policy.defaults.unmatched === "allow" ? "anything not covered is approved" : "anything not covered needs approval"}</p>
        </div>
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {[...policy.rules].sort(byClause).map((r) => (
          <RuleRow key={r.id + String(draft?.updated_at ?? "")} rule={r} change={changeOf.get(r.id) ?? null} editable={!!draft} currency={policy.currency} />
        ))}
        {removed.map((d) => (
          <div key={d.rule.id} className="px-5 py-3 text-sm text-muted">
            <span className="pill mr-2 bg-bad-bg text-bad">Removed</span><span className="line-through">§{d.rule.clause} {d.rule.title}</span>
          </div>
        ))}
      </div>
      {draft && <div className="mt-3"><AddRule currency={policy.currency} /></div>}

      {/* ---------- Details, folded away ---------- */}
      <div className="mt-8 space-y-3 pb-10">
        {a && a.impact.changed.length > 0 && (
          <details id="impact" className="card group overflow-hidden" open>
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-medium">
              Past expenses that would be decided differently ({a.impact.changed.length})
              <span className="text-sm text-muted group-open:hidden">Show</span>
            </summary>
            <p className="px-5 pb-3 text-sm text-muted">Clause replayed your team&apos;s last {a.impact.checked} real expenses against this draft.</p>
            <ul className="divide-y divide-line-2 border-t border-line">
              {a.impact.changed.map((c) => (
                <li key={c.ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <Link href={`/app/requests/${c.ref}`} className="font-medium hover:underline">{c.employee}</Link>
                  <span className="text-muted">{c.summary}</span>
                  <span className="ml-auto">
                    was <span className="text-muted">{word(c.from)}</span> → now{" "}
                    <b className={c.to === "allow" ? "text-ok" : c.to === "block" ? "text-bad" : "text-warn"}>{word(c.to)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="card group overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-medium">
            Automatic checks ({tests.length - failing.length}/{tests.length} passed)
            <span className="text-sm text-muted group-open:hidden">Show</span>
          </summary>
          <p className="px-5 pb-3 text-sm text-muted">Example expenses Claude wrote from your document. Clause re-runs them after every change.</p>
          <ul className="divide-y divide-line-2 border-t border-line">
            {tests.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm ${t.pass ? "" : "bg-bad-bg/50"}`}>
                <span className={t.pass ? "text-ok" : "text-bad"}>{t.pass ? "✓" : "✕"}</span>
                <span className="flex-1">{t.name}</span>
                {!t.pass && <span className="text-xs text-bad">expected</span>}
                {!t.pass && <OutcomePill outcome={t.expect} approver={t.expect_approver} />}
                <OutcomePill outcome={t.got} approver={t.got_approver} />
              </li>
            ))}
            {tests.length === 0 && <li className="px-5 py-4 text-muted">No checks yet.</li>}
          </ul>
        </details>

        <details className="card group overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-medium">
            Version history ({versions.length})
            <span className="text-sm text-muted group-open:hidden">Show</span>
          </summary>
          <ul className="space-y-2 border-t border-line px-5 py-4 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="w-8 font-semibold">v{v.version}</span>
                <span className={`pill ${v.status === "published" ? "bg-ok-bg text-ok" : v.status === "draft" ? "bg-brand-bg text-brand" : "bg-line-2 text-muted"}`}>{v.status === "published" ? "Live" : v.status === "draft" ? "Draft" : "Old"}</span>
                {v.source === "claude" && <span className="pill bg-claude-bg text-claude"><ClaudeMark className="h-3 w-3" /> by Claude</span>}
                <span className="text-muted">{v.policy.rules.length} rules · {v.published_at ? `published ${ago(v.published_at)}` : `created ${ago(v.created_at)}`}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
