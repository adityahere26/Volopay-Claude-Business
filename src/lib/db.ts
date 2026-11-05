import "server-only";
import postgres from "postgres";

// One tiny query interface over two drivers:
//  - production: Postgres (Neon) via DATABASE_URL
//  - local dev:  embedded PGlite (Postgres compiled to WASM), zero setup
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Q = (text: string, params?: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { __clauseQ?: Promise<Q>; __clauseReady?: Promise<void> };

async function makeQ(): Promise<Q> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = postgres(url, { ssl: url.includes("localhost") ? false : "require", prepare: false, max: 5, idle_timeout: 20 });
    return async (text, params = []) => (await sql.unsafe(text, params as never[])) as unknown as Row[];
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return async (text, params = []) => (await db.query<Row>(text, params)).rows;
}

const SCHEMA = `
create table if not exists workspaces (
  id text primary key,
  name text not null,
  slug text unique not null,
  admin_name text not null,
  admin_email text unique not null,
  password_hash text not null,
  mcp_key text unique not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists policy_versions (
  id text primary key,
  workspace_id text not null,
  version int not null,
  status text not null,            -- draft | published | archived
  source text not null,            -- claude | human
  policy jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by text
);
create index if not exists pv_ws on policy_versions(workspace_id, status);
create table if not exists requests (
  id text primary key,
  workspace_id text not null,
  ref text not null,
  employee_name text not null,
  employee_email text not null,
  input jsonb not null,
  decision jsonb not null,
  policy_version int not null,
  status text not null,            -- approved | pending | rejected | blocked
  auto boolean not null default true,
  reviewer text,
  review_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists rq_ws on requests(workspace_id, created_at desc);
create table if not exists events (
  id text primary key,
  workspace_id text not null,
  actor text not null,             -- claude | admin | employee | system
  kind text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index if not exists ev_ws on events(workspace_id, created_at desc);
`;

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  g.__clauseQ ??= makeQ().catch((e) => {
    g.__clauseQ = undefined;
    throw e;
  });
  const run = await g.__clauseQ;
  g.__clauseReady ??= (async () => {
    for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await run(stmt);
    const { ensureDemo } = await import("./seed");
    await ensureDemo(run);
  })().catch((e) => {
    g.__clauseReady = undefined;
    throw e;
  });
  await g.__clauseReady;
  return run(text, params);
}

export function newId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return prefix + "_" + Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}
