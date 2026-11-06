import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { getDraft, getPublished, listEvents, listRequests, onboarding, stats } from "@/lib/store";
import { Checklist } from "@/components/Checklist";
import { categoryLabel, money } from "@/lib/engine";
import { ActorBadge, ClaudeMark, StatusPill, ago } from "@/components/ui";

export default async function Overview() {
  const ws = await requireWorkspace();
  const [s, pub, draft, events, pending, ob] = await Promise.all([
    stats(ws.id),
    getPublished(ws.id),
    getDraft(ws.id),
    listEvents(ws.id, 14),
    listRequests(ws.id, { status: "pending", limit: 5 }),
    onboarding(ws.id),
  ]);
  const autoRate = s.total ? Math.round((s.autoApproved / s.total) * 100) : 0;
  const claudeConnected = events.some((e) => e.actor === "claude");

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Overview</p>
      <h1 className="mt-2 font-serif text-4xl">Good to see you, {ws.admin_name.split(" ")[0]}.</h1>

      <div className="mt-6">
        <Checklist {...ob} slug={ws.slug} hasDraft={!!draft} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Decided automatically", v: `${autoRate}%`, d: `${s.autoApproved} of ${s.total} requests, 30 days`, tone: "bg-brand-bg text-brand", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
          { k: "Waiting for approval", v: String(s.pending), d: "Routed by policy", tone: "bg-warn-bg text-warn", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-4V7h2v4h2v2z" },
          { k: "Approved spend", v: money(s.approvedSpend), d: "Last 30 days", tone: "bg-ok-bg text-ok", icon: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5L9 16.2z" },
          { k: "Out-of-policy blocked", v: money(s.blockedSpend), d: `${s.blocked} request${s.blocked === 1 ? "" : "s"} stopped at the door`, tone: "bg-bad-bg text-bad", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM4 12a8 8 0 0112.9-6.3L5.7 16.9A7.9 7.9 0 014 12zm8 8a7.9 7.9 0 01-4.9-1.7L18.3 7.1A8 8 0 0112 20z" },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <span className={`mb-3 grid h-9 w-9 place-items-center rounded-full ${c.tone}`}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden><path d={c.icon} /></svg>
            </span>
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
