import Link from "next/link";
import type { Action, Approver } from "@/lib/engine";
import { approverLabel } from "@/lib/engine";

export function Logo({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink">
      <span className={`grid place-items-center rounded-full bg-ink font-bold text-white ${small ? "h-7 w-7 text-[15px]" : "h-8 w-8 text-base"}`}>§</span>
      <span className={`font-bold tracking-tight ${small ? "text-xl" : "text-[22px]"}`}>clause</span>
    </Link>
  );
}

export function OutcomePill({ outcome, approver }: { outcome: Action; approver?: Approver | null }) {
  if (outcome === "allow") return <span className="pill bg-ok-bg text-ok">● Auto-approve</span>;
  if (outcome === "block") return <span className="pill bg-bad-bg text-bad">✕ Block</span>;
  return <span className="pill bg-warn-bg text-warn">◐ {approver ? `${approverLabel(approver)} approval` : "Needs approval"}</span>;
}

export function StatusPill({ status, auto }: { status: string; auto?: boolean }) {
  const map: Record<string, string> = {
    approved: "bg-ok-bg text-ok",
    pending: "bg-warn-bg text-warn",
    rejected: "bg-bad-bg text-bad",
    blocked: "bg-bad-bg text-bad",
  };
  const label = status === "approved" && auto ? "Auto-approved" : status[0].toUpperCase() + status.slice(1);
  return <span className={`pill ${map[status] ?? "bg-line-2 text-muted"}`}>{label}</span>;
}

export function ActorBadge({ actor }: { actor: string }) {
  if (actor === "claude")
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-claude-bg text-claude" title="Claude via MCP">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
        </svg>
      </span>
    );
  const letter = actor === "admin" ? "A" : actor === "employee" ? "E" : "·";
  const cls = actor === "admin" ? "bg-brand text-white" : actor === "employee" ? "bg-line text-ink-2" : "bg-line-2 text-muted";
  return <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${cls}`}>{letter}</span>;
}

export function ago(d: Date | string | null) {
  if (!d) return "";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ClaudeMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    </svg>
  );
}
