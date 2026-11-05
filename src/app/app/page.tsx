import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { getDraft, getPublished, listEvents, listRequests, stats } from "@/lib/store";
import { categoryLabel, money } from "@/lib/engine";
import { ActorBadge, ClaudeMark, StatusPill, ago } from "@/components/ui";

export default async function Overview() {
  const ws = await requireWorkspace();
  const [s, pub, draft, events, pending] = await Promise.all([
    stats(ws.id),
    getPublished(ws.id),
    getDraft(ws.id),
    listEvents(ws.id, 14),
    listRequests(ws.id, { status: "pending", limit: 5 }),
  ]);
  const autoRate = s.total ? Math.round((s.autoApproved / s.total) * 100) : 0;
  const claudeConnected = events.some((e) => e.actor === "claude");

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Overview</p>
      <h1 className="mt-2 font-serif text-4xl">Good to see you, {ws.admin_name.split(" ")[0]}.</h1>

      {draft && (
        <Link href="/app/policy" className="mt-6 flex items-center gap-3 rounded-xl border border-claude/30 bg-claude-bg px-4 py-3 text-sm transition-colors hover:border-claude">
          {draft.source === "claude" ? <ClaudeMark className="h-4 w-4 text-claude" /> : <span className="clause">§</span>}
          <span>
            <b>Draft v{draft.version}</b> {draft.source === "claude" ? "was proposed by Claude" : "is in progress"} — {draft.policy.rules.length} rules waiting for your review.
          </span>
          <span className="ml-auto font-medium">Review →</span>
        </Link>
      )}
      {!pub && !draft && (
        <Link href="/app/connect" className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm hover:border-ink">
          <ClaudeMark className="h-4 w-4 text-claude" />
          <span>No policy yet. Connect Claude and ask it to set up your expense policy.</span>
          <span className="ml-auto font-medium">Connect →</span>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Decided automatically", v: `${autoRate}%`, d: `${s.autoApproved} of ${s.total} requests, 30 days` },
          { k: "Waiting for approval", v: String(s.pending), d: "Routed by policy", href: "/app/requests" },
          { k: "Approved spend", v: money(s.approvedSpend), d: "Last 30 days" },
          { k: "Out-of-policy blocked", v: money(s.blockedSpend), d: `${s.blocked} request${s.blocked === 1 ? "" : "s"} stopped at the door` },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <p className="text-xs text-muted">{c.k}</p>
            <p className="mt-1 font-serif text-3xl">{c.v}</p>
            <p className="mt-1 text-xs text-faint">{c.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-medium">Needs your decision</h2>
            <Link href="/app/requests" className="text-sm text-muted hover:text-ink">All approvals →</Link>
          </div>
          {pending.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">Nothing waiting. The policy is doing its job.</p>
          ) : (
            <ul>
              {pending.map((r) => (
                <li key={r.id} className="border-b border-line-2 last:border-0">
                  <Link href={`/app/requests/${r.ref}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.employee_name} · {r.input.merchant ?? categoryLabel(r.input.category)}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {r.decision.hits.map((h) => `§${h.clause} ${h.title}`).join(" · ")}
                      </p>
                    </div>
                    <span className="font-mono text-sm">{money(r.input.amount)}</span>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-medium">Activity</h2>
            <span className={`pill ${claudeConnected ? "bg-claude-bg text-claude" : "bg-line-2 text-muted"}`}>
              <ClaudeMark className="h-3 w-3" /> {claudeConnected ? "Claude connected" : "Claude not connected yet"}
            </span>
          </div>
          <ul className="px-5 py-2">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 py-2">
                <ActorBadge actor={e.actor} />
                <div className="min-w-0 text-sm">
                  <p className="text-ink-2">{e.detail}</p>
                  <p className="text-xs text-faint">{ago(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pub && (
        <p className="mt-6 text-sm text-muted">
          Enforcing <span className="text-ink">v{pub.version}</span> · {pub.policy.title} · published {ago(pub.published_at)} by {pub.published_by}
        </p>
      )}
    </div>
  );
}
