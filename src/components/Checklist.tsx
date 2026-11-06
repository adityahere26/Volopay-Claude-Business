import Link from "next/link";
import { CopyBlock } from "./Copy";
import { ClaudeMark } from "./ui";

export function Checklist({ drafted, published, tried, slug, hasDraft }: { drafted: boolean; published: boolean; tried: boolean; slug: string; hasDraft: boolean }) {
  const steps = [
    { done: drafted, title: "Connect Claude", body: "Add Clause to claude.ai as a custom connector. One link, no password.", action: <Link href="/app/connect" className="btn-line">Show me how</Link> },
    { done: drafted, title: "Ask Claude to write your policy", body: <>In claude.ai, type: <b>“Set up the sample policy in Clause.”</b></>, action: <CopyBlock value="Set up the sample policy in Clause." label="Copy message" /> },
    { done: published, title: "Check it and publish", body: "Claude's version lands here. Change anything you like, then press Publish.", action: <Link href="/app/policy" className={hasDraft ? "btn-ink" : "btn-line"}>Open policy</Link> },
    { done: tried, title: "Try it as an employee", body: "Submit an expense and get an instant answer — no Claude needed.", action: <Link href={`/r/${slug}`} target="_blank" className="btn-line">Open employee page ↗</Link> },
  ];
  const next = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{doneCount === 4 ? "You're all set 🎉" : "Get started in 4 steps"}</h2>
          <p className="text-sm text-muted">Claude writes the policy. Clause runs it. About 2 minutes.</p>
        </div>
        <span className="pill bg-brand-bg text-brand">{doneCount}/4 done</span>
      </div>
      <ol>
        {steps.map((s, i) => {
          const active = i === next;
          return (
            <li key={s.title} className={`flex flex-wrap items-center gap-4 border-b border-line-2 px-6 py-4 last:border-0 ${active ? "bg-brand-bg/50" : ""}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${s.done ? "bg-ok text-white" : active ? "bg-brand text-white" : "bg-line-2 text-muted"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${s.done ? "text-muted line-through decoration-faint" : ""}`}>
                  {s.title} {i < 2 && <ClaudeMark className="ml-1 inline h-3.5 w-3.5 text-claude" />}
                </p>
                <p className="text-sm text-ink-2">{s.body}</p>
              </div>
              {!s.done || i === 3 ? s.action : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
