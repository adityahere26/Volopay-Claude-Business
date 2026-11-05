import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { getRequest } from "@/lib/store";
import { approverLabel, categoryLabel, money } from "@/lib/engine";
import { Reasons, Trace, Verdict } from "@/components/Decision";
import { ReviewForm } from "@/components/ReviewForm";
import { StatusPill, ago } from "@/components/ui";

export default async function RequestDetail({ params }: PageProps<"/app/requests/[ref]">) {
  const ws = await requireWorkspace();
  const { ref } = await params;
  const r = await getRequest(ws.id, ref);
  if (!r) notFound();
  const i = r.input;
  const facts: [string, string | undefined][] = [
    ["Category", categoryLabel(i.category)],
    ["Merchant", i.merchant],
    ["Date", i.expense_date],
    ["City", i.city],
    ["Attendees", i.attendees ? String(i.attendees) : undefined],
    ["Nights", i.nights ? String(i.nights) : undefined],
    ["Cabin", i.cabin_class?.replace("_", " ")],
    ["Receipt", i.has_receipt === undefined ? undefined : i.has_receipt ? "Attached" : "Missing"],
    ["Month-to-date in category", r.decision.facts.month_to_date != null ? money(Number(r.decision.facts.month_to_date)) : undefined],
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/requests" className="text-sm text-muted hover:text-ink">← Approvals</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{r.ref} · decided against policy v{r.policy_version}</p>
          <h1 className="mt-2 font-serif text-4xl">{r.employee_name} · {money(i.amount)}</h1>
          <p className="mt-1 text-ink-2">{i.description}</p>
        </div>
        <StatusPill status={r.status} auto={r.auto} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Verdict d={r.decision} status={r.status} />
          {r.status === "pending" && <ReviewForm refId={r.ref} approver={approverLabel(r.decision.approver)} />}
          {r.reviewer && (
            <div className="card p-4 text-sm">
              <b>{r.reviewer}</b> {r.status} this {ago(r.decided_at)}.{r.review_note && <span className="text-ink-2"> “{r.review_note}”</span>}
            </div>
          )}
          <section>
            <h2 className="mb-2 font-medium">Why — cited from the policy</h2>
            <div className="card p-5"><Reasons d={r.decision} /></div>
          </section>
          <section>
            <h2 className="mb-2 font-medium">Decision trace</h2>
            <p className="mb-2 text-sm text-muted">Every rule Clause checked. Same input, same policy version → same answer, forever.</p>
            <div className="card overflow-hidden"><Trace d={r.decision} /></div>
          </section>
        </div>
        <aside className="card h-fit p-5">
          <p className="eyebrow">Request</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Employee</dt><dd className="text-right">{r.employee_name}<br /><span className="text-xs text-faint">{r.employee_email}</span></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Department</dt><dd>{i.department ?? "—"}</dd></div>
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
            <div className="flex justify-between gap-3"><dt className="text-muted">Submitted</dt><dd>{ago(r.created_at)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
