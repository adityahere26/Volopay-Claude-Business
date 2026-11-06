"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = {
  overview: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  policy: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v2H8v-2zm0 4h5v2H8v-2z",
  approvals: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5L9 16.2z",
  connect: "M7 7h4V5H7a5 5 0 000 10h4v-2H7a3 3 0 010-6zm6-2v2h4a3 3 0 010 6h-4v2h4a5 5 0 000-10h-4zm-5 6h8v2H8v-2z",
};

export function NavLink({ href, icon, children, badge }: { href: string; icon: keyof typeof ICONS; children: React.ReactNode; badge?: number | string | null }) {
  const p = usePathname();
  const active = href === "/app" ? p === "/app" : p.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-bg text-brand" : "text-ink-2 hover:bg-line-2 hover:text-ink"}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="currentColor" aria-hidden>
        <path d={ICONS[icon]} />
      </svg>
      <span className="flex-1">{children}</span>
      {badge ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-brand text-white" : "bg-brand-bg text-brand"}`}>{badge}</span> : null}
    </Link>
  );
}
