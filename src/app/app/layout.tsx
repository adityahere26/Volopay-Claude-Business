import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { getDraft, stats } from "@/lib/store";
import { Logo } from "@/components/ui";
import { NavLink } from "@/components/NavLink";
import { LiveRefresh } from "@/components/LiveRefresh";
import { logout, resetDemoWorkspace } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ws = await requireWorkspace();
  const [s, draft] = await Promise.all([stats(ws.id), getDraft(ws.id)]);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-line bg-white px-4 py-5 md:sticky md:top-0 md:h-screen md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center justify-between">
          <Logo href="/app" small />
          <LiveRefresh />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-bg text-sm font-semibold text-brand">{ws.name[0]}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ws.name}</p>
            <p className="truncate text-xs text-muted">{ws.admin_name} · Admin</p>
          </div>
        </div>
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          <NavLink href="/app" icon="overview">Overview</NavLink>
          <NavLink href="/app/policy" icon="policy" badge={draft ? "Draft" : null}>Policy</NavLink>
          <NavLink href="/app/requests" icon="approvals" badge={s.pending || null}>Approvals</NavLink>
          <NavLink href="/app/connect" icon="connect">Connect Claude</NavLink>
        </nav>
        <div className="mt-auto hidden space-y-2 md:block">
          <Link href={`/r/${ws.slug}`} target="_blank" className="btn-line w-full justify-between">
            Employee portal <span aria-hidden>↗</span>
          </Link>
          {ws.is_demo && (
            <form action={resetDemoWorkspace}>
              <button className="btn-ghost w-full justify-start text-xs">↺ Reset demo data</button>
            </form>
          )}
          {ws.is_demo && (
            <p className="px-3 text-[11px] leading-snug text-faint">Demo data resets itself after 15 minutes of no activity.</p>
          )}
          <form action={logout}>
            <button className="btn-ghost w-full justify-start text-xs">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}
