import Link from "next/link";
import { demoLogin } from "./actions";
import { ClaudeMark, Logo } from "@/components/ui";

export default function Home() {
  return (
    <div className="flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#why" className="btn-ghost hidden sm:inline-flex">Why Clause</a>
          <a href="#pricing" className="btn-ghost hidden sm:inline-flex">Pricing</a>
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <form action={demoLogin}>
            <button className="btn-ink">Live demo →</button>
          </form>
        </nav>
      </header>

      {/* HERO */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pt-10 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <p className="eyebrow">For finance teams at 20–500 person companies</p>
          <h1 className="mt-5 font-serif text-[52px] leading-[0.98] tracking-tight sm:text-[68px]">
            Your expense policy, <em className="text-mark">enforced</em> — not interpreted.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Claude reads your policy once and turns it into rules. Clause checks every expense against them —
            instantly, identically, with the exact clause cited. Your employees never need Claude. Clause never needs AI.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <form action={demoLogin}>
              <button className="btn-ink px-5 py-2.5 text-[15px]">Open the live demo</button>
            </form>
            <Link href="/signup" className="btn-line px-5 py-2.5 text-[15px]">Start free</Link>
            <span className="text-sm text-muted">No card. Connect Claude in 60 seconds.</span>
          </div>
        </div>

        {/* Flow visual */}
        <div className="relative">
          <div className="card p-5 shadow-[0_1px_0_#e3dfd3,0_20px_40px_-24px_rgba(21,20,15,0.25)]">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Travel & Expense Policy.pdf</span>
              <span className="font-mono text-xs text-faint">p. 3</span>
            </div>
            <p className="mt-3 font-serif text-[19px] leading-snug text-ink-2">
              <span className="clause not-italic">4.1</span> Hotels are covered up to $250 per night.{" "}
              <mark className="rounded bg-[#f2d9a6]/70 px-0.5 text-ink">In high-cost cities — New York, San Francisco, London, Singapore and Tokyo — the cap is $350 per night.</mark>{" "}
              Anything above the cap needs manager approval.
            </p>
          </div>

          <div className="mx-auto flex w-fit items-center gap-2 py-3 text-xs text-claude">
            <ClaudeMark className="h-3.5 w-3.5" /> Claude drafts the rule over MCP · you review & publish
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="clause">§4.1</span>
              <span className="font-medium">High-cost city hotel cap</span>
              <span className="pill ml-auto bg-ok-bg text-ok">10/10 tests pass</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[12px]">
              <span className="rounded bg-line-2 px-2 py-1">per night &gt; $350</span>
              <span className="rounded bg-line-2 px-2 py-1">city ∈ NYC, SF, London, SG, Tokyo</span>
              <span className="rounded bg-warn-bg px-2 py-1 text-warn">→ Manager approval</span>
            </div>
          </div>

          <div className="mx-auto h-6 w-px bg-line" />

          <div className="card border-ok/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Daniel · The Hoxton, London · 4 nights · $1,240</span>
              <span className="font-mono text-xs text-faint">0.4 ms</span>
            </div>
            <p className="mt-1 font-serif text-2xl text-ok">Approved instantly</p>
            <p className="mt-1 text-sm text-muted">
              $310/night is within the <span className="clause">§4.1</span> high-cost city cap of $350.
            </p>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow">“Why not just ask Claude?”</p>
          <h2 className="mt-3 max-w-3xl font-serif text-[40px] leading-tight">
            Claude is brilliant at reading a policy. A policy needs something else to <em>run</em> it.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Same request, same answer. Every time.",
                d: "Auditors and employees need decisions that don't change with phrasing or mood. Clause's rules are deterministic, tested, and versioned — every decision is reproducible months later.",
              },
              {
                n: "02",
                t: "Your 200 employees don't have your Claude.",
                d: "They get a link. They type an expense and get an instant answer with the clause quoted. Approvals route to the right person. It keeps working long after the chat ends.",
              },
              {
                n: "03",
                t: "Policies need memory.",
                d: "“$200 a month of SaaS per person” needs a running total per employee. Clause keeps the ledger, the approval queue, and the audit trail. A chat window can't.",
              },
            ].map((x) => (
              <div key={x.n}>
                <span className="font-mono text-sm text-mark">{x.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{x.t}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="eyebrow">How it works</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { k: "Claude drafts", d: "Drop your policy PDF into Claude and say “set this up in Clause”. Claude writes the rules and the test cases, and pushes a draft through MCP.", tag: "Your Claude plan" },
            { k: "You review", d: "Clause shows a diff against what's live, runs the tests, and replays your real past expenses: “12 decisions would change”. Edit any rule in plain fields.", tag: "Clause" },
            { k: "Clause enforces", d: "Publish. Employees get instant, cited decisions; approvals go to Manager, Finance or CFO. Change the policy next year? Same loop, one minute.", tag: "Clause · no AI" },
          ].map((s, i) => (
            <div key={s.k} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="font-serif text-3xl">{i + 1}.</span>
                <span className={`pill ${i === 0 ? "bg-claude-bg text-claude" : "bg-line-2 text-ink-2"}`}>{s.tag}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.k}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 rounded-xl bg-ink p-8 text-paper md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-paper/60">The economics</p>
            <p className="mt-3 font-serif text-[34px] leading-tight">AI once. Rules forever.</p>
            <p className="mt-3 max-w-lg text-paper/75">
              The expensive thinking happens a few times a year, when the policy changes — on the customer&apos;s own Claude plan.
              The thousands of checks in between cost what a database query costs.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 self-center font-mono">
            <div><dt className="text-xs text-paper/50">AI cost to us</dt><dd className="text-3xl">$0</dd></div>
            <div><dt className="text-xs text-paper/50">Per decision</dt><dd className="text-3xl">&lt;1 ms</dd></div>
            <div><dt className="text-xs text-paper/50">Hosting / customer</dt><dd className="text-3xl">~$0.40</dd></div>
            <div><dt className="text-xs text-paper/50">Gross margin</dt><dd className="text-3xl">97%</dd></div>
          </dl>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 font-serif text-[40px] leading-tight">Priced per employee, like the policy it enforces.</h2>
            <p className="mt-4 text-ink-2">Cheaper than one hour a month of a finance manager answering “can I expense this?” in Slack.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <p className="font-medium">Starter</p>
              <p className="mt-2 font-serif text-4xl">Free</p>
              <p className="mt-1 text-sm text-muted">Up to 15 employees</p>
              <ul className="mt-5 space-y-2 text-sm text-ink-2">
                <li>Claude connector (MCP)</li><li>Employee portal</li><li>Approvals</li>
              </ul>
            </div>
            <div className="card border-ink p-6">
              <p className="font-medium">Team</p>
              <p className="mt-2 font-serif text-4xl">$4<span className="text-lg text-muted"> / employee / mo</span></p>
              <p className="mt-1 text-sm text-muted">Minimum $49 / month</p>
              <ul className="mt-5 space-y-2 text-sm text-ink-2">
                <li>Unlimited versions & tests</li><li>Impact replay on real history</li><li>Audit export · Slack approvals</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted">
        <Logo small />
        <span>No OpenAI or Anthropic keys anywhere in this app. The thinking is Claude&apos;s; the enforcing is ours.</span>
      </footer>
    </div>
  );
}
