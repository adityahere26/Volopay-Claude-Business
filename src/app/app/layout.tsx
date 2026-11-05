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
      <aside className="flex shrink-0 flex-col gap-6 border-b border-line px-4 py-5 md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center justify-between">
          <Logo href="/app" small />
          <LiveRefresh />
        </div>
        <div>
          <p className="eyebrow">Workspace</p>
          <p className="mt-1 font-medium">{ws.name}</p>
          <p className="text-xs text-muted">{ws.admin_name} · Finance admin</p>
        </div>
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          <NavLink href="/app">Overview</NavLink>
          <NavLink href="/app/policy" badge={draft ? "Draft" : null}>Policy</NavLink>
          <NavLink href="/app/requests" badge={s.pending || null}>Approvals</NavLink>
          <NavLink href="/app/connect">Connect Claude</NavLink>
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
          <form action={logout}>
            <button className="btn-ghost w-full justify-start text-xs">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}
