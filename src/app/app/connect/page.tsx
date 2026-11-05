import { headers } from "next/headers";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { CopyField } from "@/components/Copy";
import { ClaudeMark } from "@/components/ui";

const PROMPTS = [
  "Here's our new travel & expense policy (attached). Set it up in Clause.",
  "Raise the meal limit to $70 per person in Clause.",
  "Would a $640 hotel in Tokyo for 2 nights be approved?",
  "Which policy rules sent the most requests to approval this month? Suggest changes.",
  "Show me pending approvals in Clause and approve the ones under $100.",
];

export default async function Connect() {
  const ws = await requireWorkspace();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/mcp/${ws.mcp_key}`;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">Connect Claude</p>
      <h1 className="mt-2 font-serif text-4xl">Plug your Claude into Clause</h1>
      <p className="mt-2 text-ink-2">Your Claude plan does the reading and drafting. Clause stores, tests and enforces. We never run an AI model or hold an AI key.</p>

      <div className="card mt-6 p-5">
        <label className="label">Your private connector URL</label>
        <CopyField value={url} />
        <p className="mt-2 text-xs text-muted">Treat it like a password — anyone with it can draft policy changes for {ws.name} (but only you can publish them).</p>
      </div>

      <ol className="mt-6 space-y-3">
        {[
          <>Open <b>claude.ai</b> → <b>Settings</b> → <b>Connectors</b> (on Team/Enterprise plans an owner does this under <b>Organization settings</b>).</>,
          <>Click <b>Add custom connector</b>. Name it <b>Clause</b> and paste the URL above. No OAuth needed.</>,
          <>In a new chat, open the <b>+</b> / tools menu and make sure <b>Clause</b> is switched on.</>,
          <>Drop in your policy PDF and say <i>“Set this up in Clause.”</i> Watch it appear on the Policy page — it updates live.</>,
        ].map((s, i) => (
          <li key={i} className="card flex gap-4 p-4">
            <span className="font-serif text-2xl leading-none">{i + 1}</span>
            <p className="text-ink-2">{s}</p>
          </li>
        ))}
      </ol>

      <div className="card mt-6 p-5">
        <p className="font-medium">Claude Code or Claude Desktop</p>
        <p className="mt-1 text-sm text-muted">Claude Code:</p>
        <div className="mt-1"><CopyField value={`claude mcp add --transport http clause ${url}`} /></div>
      </div>

      <div className="mt-8">
        <h2 className="font-serif text-2xl">Things to ask</h2>
        <ul className="mt-3 space-y-2">
          {PROMPTS.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-lg border border-line bg-card px-4 py-3 text-sm">
              <ClaudeMark className="mt-0.5 h-4 w-4 shrink-0 text-claude" /> {p}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          No policy document handy? Use our <Link href="/sample-policy" target="_blank" className="underline">sample Northwind Labs policy</Link> — copy it into Claude.
        </p>
      </div>
    </div>
  );
}
