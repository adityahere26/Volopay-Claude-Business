# §Clause — your expense policy, enforced (not interpreted)

**Claude reads the policy once. Clause enforces it on every request — instantly, identically, with the clause cited. No AI inside.**

Finance teams write expense policies as PDFs nobody reads. Employees ask "can I expense this?" in Slack, managers answer inconsistently, and auditors can't reproduce why something was approved.

Clause splits the job:

| Claude (customer's own plan, via MCP) | Clause (this app, zero AI) |
|---|---|
| Reads the policy document | Stores the rules as versioned, deterministic logic |
| Writes the rules + edge-case test cases | Runs the tests, diffs against what's live, **replays real past expenses** to show what would change |
| Explains, summarises, suggests tweaks | Lets a human edit and publish |
| | Gives every employee a link that answers instantly with the clause quoted |
| | Tracks state Claude can't: monthly allowances per employee, approval queue, audit trail |

## Try it

- **Live app:** `https://clause-zeta.vercel.app` → click **Open the live demo** (or log in with `demo@clause.dev` / `clause-demo`)
- **Employee portal (no login):** `https://clause-zeta.vercel.app/r/northwind`
- **Sample policy to give Claude:** `https://clause-zeta.vercel.app/sample-policy`

### Connect Claude (60 seconds)

1. claude.ai → **Settings → Connectors → Add custom connector**
2. Name: `Clause` · URL: `https://clause-zeta.vercel.app/api/mcp/ck_demo_northwind_7f3k` (demo workspace; every workspace gets its own on the *Connect Claude* page). No OAuth.
3. In a chat, enable Clause from the tools menu, paste the sample policy, and say **"Set this up in Clause."**
4. Watch the Policy page update live → review tests, diff and impact → edit a rule → **Publish**.
5. Open the employee portal and submit an expense.

Claude Code: `claude mcp add --transport http clause https://clause-zeta.vercel.app/api/mcp/ck_demo_northwind_7f3k`

### MCP tools

| Tool | What it does |
|---|---|
| `get_workspace` | Company, enforced policy, pending draft, 30-day stats |
| `propose_policy` | Save rules + tests as a **draft**. Returns validation errors, test results, diff vs live, and which real past requests would change, so Claude can fix its own mistakes |
| `update_rule` / `remove_rule` | Small edits ("raise meals to $70") |
| `check_spend` | "Would this be approved?" against the live policy or the draft |
| `list_requests` | Real requests with decisions and cited clauses, for analysis |
| `review_request` | Approve/reject on the admin's behalf, only when asked |

Drafts are never enforced until a human publishes them.

## How it works

- `src/lib/engine.ts`: the rules engine. Pure functions: evaluate, validate (including a check that flags when a rule's limit no longer matches the policy text it quotes), run tests, diff. Same input + same version → same answer.
- `src/lib/mcp.ts`: a dependency-free MCP server (Streamable HTTP, stateless JSON-RPC).
- `src/lib/store.ts`: Postgres data layer: versions, requests, month-to-date ledger, events.
- Next.js 16 App Router UI, Tailwind v4. Postgres (Neon) in production; embedded PGlite locally (no setup).

```bash
npm install
npm run dev        # http://localhost:3000, local DB auto-created and seeded
```

Env (production): `DATABASE_URL` (Postgres), `SESSION_SECRET` (random string).

**No OpenAI, Anthropic or other AI keys exist anywhere in this codebase.**
