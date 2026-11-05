import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { listRequests } from "@/lib/store";
import { categoryLabel, money } from "@/lib/engine";
import { StatusPill, ago } from "@/components/ui";

const TABS = [
  { k: "pending", label: "Needs decision" },
  { k: "all", label: "All" },
  { k: "approved", label: "Approved" },
  { k: "blocked", label: "Blocked" },
  { k: "rejected", label: "Rejected" },
];

export default async function Requests({ searchParams }: PageProps<"/app/requests">) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const tab = typeof sp.status === "string" && TABS.some((t) => t.k === sp.status) ? sp.status : "pending";
  const rows = await listRequests(ws.id, { status: tab, limit: 200 });

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Approvals</p>
      <h1 className="mt-2 font-serif text-4xl">Expense requests</h1>
      <p className="mt-2 text-ink-2">
        Employees submit at <Link href={`/r/${ws.slug}`} target="_blank" className="font-mono text-sm underline">/r/{ws.slug}</Link>. Clause decides what it can; only the exceptions land here.
      </p>
      <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link key={t.k} href={`/app/requests?status=${t.k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-2.5 font-medium">Ref</th><th className="font-medium">Employee</th><th className="font-medium">Expense</th>
              <th className="font-medium">Why</th><th className="text-right font-medium">Amount</th><th className="px-5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-2 last:border-0 hover:bg-paper">
                <td className="px-5 py-3 font-mono text-xs"><Link href={`/app/requests/${r.ref}`} className="hover:underline">{r.ref}</Link></td>
                <td className="py-3"><p>{r.employee_name}</p><p className="text-xs text-faint">{r.input.department} · {ago(r.created_at)}</p></td>
                <td className="py-3"><p>{r.input.merchant ?? "—"}</p><p className="text-xs text-faint">{categoryLabel(r.input.category)}</p></td>
                <td className="max-w-56 py-3 text-xs">
                  {r.decision.hits.length ? r.decision.hits.slice(0, 2).map((h) => <p key={h.rule_id} className="truncate"><span className="clause">§{h.clause}</span> {h.title}</p>) : <span className="text-faint">Within policy</span>}
                </td>
                <td className="py-3 text-right font-mono">{money(r.input.amount)}</td>
                <td className="px-5 py-3 text-right"><Link href={`/app/requests/${r.ref}`}><StatusPill status={r.status} auto={r.auto} /></Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
