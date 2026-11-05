"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, badge }: { href: string; children: React.ReactNode; badge?: number | string | null }) {
  const p = usePathname();
  const active = href === "/app" ? p === "/app" : p.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${active ? "bg-card text-ink shadow-[0_0_0_1px_#e3dfd3]" : "text-ink-2 hover:bg-line-2"}`}
    >
      <span>{children}</span>
      {badge ? <span className="rounded-full bg-ink px-1.5 text-[11px] font-medium text-paper">{badge}</span> : null}
    </Link>
  );
}
