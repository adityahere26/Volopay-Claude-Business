import { evaluate, type Policy, type RequestInput } from "./engine";
import { hashPassword } from "./password";

type Q = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export const DEMO = {
  workspaceId: "ws_demo",
  name: "Northwind Labs",
  slug: "northwind",
  adminName: "Alex Rivera",
  email: "demo@clause.dev",
  password: "clause-demo",
  mcpKey: "ck_demo_northwind_7f3k",
};

// The policy that is live in the demo workspace (last year's version).
export const DEMO_POLICY_V1: Policy = {
  title: "Northwind Labs Travel & Expense Policy (2025)",
  summary: "Last year's policy. Flat hotel cap, $50 meals, no SaaS controls.",
  currency: "USD",
  defaults: { unmatched: "allow", approver: "manager" },
  rules: [
    { id: "receipts", clause: "2.1", title: "Receipts over $75", quote: "Receipts are required for every expense above $75.", categories: [], when: [{ field: "amount", op: "gt", value: 75 }, { field: "has_receipt", op: "eq", value: false }], action: "require_approval", approver: "finance", message: "Attach a receipt, or Finance will review this manually." },
    { id: "cfo-5000", clause: "2.2", title: "Large expenses", quote: "Any single expense above $5,000 requires CFO approval.", categories: [], when: [{ field: "amount", op: "gt", value: 5000 }], action: "require_approval", approver: "cfo", message: "Expenses above $5,000 go to the CFO." },
    { id: "no-alcohol", clause: "2.3", title: "No alcohol", quote: "Alcohol is not reimbursable.", categories: ["meals"], when: [{ field: "description", op: "contains_any", value: ["alcohol", "wine", "beer", "bar", "cocktail"] }], action: "block", approver: null, message: "Alcohol isn't reimbursable on regular meals." },
    { id: "cabin", clause: "3.1", title: "Economy only", quote: "Book economy class. Business and first class require CFO approval in advance.", categories: ["flights"], when: [{ field: "cabin_class", op: "in", value: ["business", "first"] }], action: "require_approval", approver: "cfo", message: "Business/first class needs CFO sign-off." },
    { id: "advance", clause: "3.2", title: "Book 7 days ahead", quote: "Flights must be booked at least 7 days in advance.", categories: ["flights"], when: [{ field: "advance_days", op: "lt", value: 7 }], action: "require_approval", approver: "manager", message: "Late bookings need your manager's OK." },
    { id: "hotel-cap", clause: "4.1", title: "Hotel nightly cap", quote: "Hotel rates up to $250 per night.", categories: ["hotels"], when: [{ field: "per_night", op: "gt", value: 250 }], action: "require_approval", approver: "manager", message: "Above $250/night needs manager approval." },
    { id: "meal-cap", clause: "5.1", title: "Meals per person", quote: "Meals up to $50 per person.", categories: ["meals"], when: [{ field: "per_person", op: "gt", value: 50 }], action: "require_approval", approver: "manager", message: "Above $50 per person needs manager approval." },
    { id: "client-ent", clause: "5.2", title: "Client entertainment", quote: "Client entertainment up to $150 per person.", categories: ["client_entertainment"], when: [{ field: "per_person", op: "gt", value: 150 }], action: "require_approval", approver: "finance", message: "Above $150 per person needs Finance approval." },
    { id: "software", clause: "7.1", title: "Software purchases", quote: "Software purchases above $100 require manager approval.", categories: ["software"], when: [{ field: "amount", op: "gt", value: 100 }], action: "require_approval", approver: "manager", message: "Software above $100 needs manager approval." },
    { id: "equipment", clause: "8.1", title: "Equipment", quote: "Equipment purchases above $500 require manager approval.", categories: ["equipment"], when: [{ field: "amount", op: "gt", value: 500 }], action: "require_approval", approver: "manager", message: "Equipment above $500 needs manager approval." },
  ],
  tests: [
    { id: "t1", name: "Team lunch, $40/person", input: { category: "meals", amount: 160, attendees: 4, has_receipt: true }, expect: "allow" },
    { id: "t2", name: "Business class to London", input: { category: "flights", amount: 3400, cabin_class: "business", has_receipt: true }, expect: "require_approval", expect_approver: "cfo" },
    { id: "t3", name: "Wine with dinner", input: { category: "meals", amount: 90, description: "dinner with wine", has_receipt: true }, expect: "block" },
  ],
};

// The new policy document. Reviewers paste this into Claude.
export const SAMPLE_POLICY_TEXT = `NORTHWIND LABS — TRAVEL & EXPENSE POLICY
Effective 1 January 2026 · Owner: Finance

1. PRINCIPLES
Spend Northwind's money as if it were your own. When in doubt, ask before you spend.

2. GENERAL RULES
2.1 Receipts. A receipt is required for every expense above $75. Anything above $75 submitted without a receipt will be reviewed by Finance.
2.2 Large expenses. Any single expense above $5,000 requires CFO approval, whatever the category.
2.3 Not reimbursable. Fines and penalties, personal items, gifts to colleagues and alcohol are not reimbursable. The only exception is alcohol during client entertainment (see 5.2).

3. AIR TRAVEL
3.1 Cabin class. Book economy. Premium economy needs your manager's approval. Business and first class are only allowed with prior CFO approval.
3.2 Booking window. Book flights at least 14 days before departure. Anything booked with less notice needs manager approval.
3.3 Expensive fares. Any flight above $1,200 requires Finance approval.

4. HOTELS
4.1 Nightly cap. Hotels are covered up to $250 per night. In high-cost cities — New York, San Francisco, London, Singapore and Tokyo — the cap is $350 per night. Anything above the cap needs manager approval.
4.2 Long stays. Stays longer than 14 nights need Finance approval.

5. MEALS & ENTERTAINMENT
5.1 Meals. Meals while travelling or working late are covered up to $60 per person. Above that needs manager approval.
5.2 Client entertainment. Entertaining clients is covered up to $150 per person, and alcohol is allowed. Above $150 per person needs Finance approval.

6. GROUND TRANSPORT
6.1 Taxis, rideshare and public transport are covered. Luxury car services — Uber Black, limousines, chauffeured cars — are not reimbursable.

7. SOFTWARE & SUBSCRIPTIONS
7.1 Each employee may expense up to $200 per month of software and SaaS in total. Once your monthly total goes above $200, Finance must approve, so we can avoid paying for the same tool twice.

8. EQUIPMENT
8.1 Equipment above $500 needs manager approval. Equipment above $2,000 needs Finance approval.

9. TRAINING
9.1 Courses and conference tickets above $1,000 need manager approval.`;

const PEOPLE = [
  { name: "Priya Nair", email: "priya@northwind.dev", dept: "Sales" },
  { name: "Marcus Lee", email: "marcus@northwind.dev", dept: "Engineering" },
  { name: "Sofia Alvarez", email: "sofia@northwind.dev", dept: "Marketing" },
  { name: "Daniel Okafor", email: "daniel@northwind.dev", dept: "Sales" },
  { name: "Hannah Kim", email: "hannah@northwind.dev", dept: "Design" },
  { name: "Tom Becker", email: "tom@northwind.dev", dept: "Engineering" },
];

type SeedReq = { who: number; daysAgo: number; input: Omit<RequestInput, "department">; review?: ["approved" | "rejected", string] };
const D = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
const SEED_REQUESTS: SeedReq[] = [
  { who: 0, daysAgo: 26, input: { category: "flights", amount: 486, merchant: "United Airlines", description: "SFO → NYC for Acme renewal", cabin_class: "economy", expense_date: D(-6), city: "New York", has_receipt: true } },
  { who: 0, daysAgo: 25, input: { category: "hotels", amount: 900, merchant: "Arlo SoHo", description: "3 nights for Acme renewal", nights: 3, city: "New York", has_receipt: true }, review: ["approved", "NYC rates — fine this time."] },
  { who: 1, daysAgo: 24, input: { category: "software", amount: 129, merchant: "JetBrains", description: "IntelliJ annual licence", has_receipt: true }, review: ["approved", "OK"] },
  { who: 2, daysAgo: 22, input: { category: "meals", amount: 165, merchant: "Nopa", description: "Late launch night, team dinner", attendees: 3, has_receipt: true }, review: ["approved", ""] },
  { who: 3, daysAgo: 21, input: { category: "client_entertainment", amount: 540, merchant: "Zuma", description: "Dinner with Globex procurement, drinks included", attendees: 4, has_receipt: true } },
  { who: 4, daysAgo: 19, input: { category: "equipment", amount: 1899, merchant: "Apple", description: "Studio Display for design work", has_receipt: true }, review: ["approved", "Budgeted in Q1 design plan."] },
  { who: 5, daysAgo: 18, input: { category: "ground_transport", amount: 64, merchant: "Uber", description: "Uber Black to airport", has_receipt: true } },
  { who: 1, daysAgo: 16, input: { category: "software", amount: 20, merchant: "Anthropic", description: "Claude Pro", has_receipt: true } },
  { who: 1, daysAgo: 15, input: { category: "software", amount: 96, merchant: "Linear", description: "Linear seat, annual", has_receipt: true } },
  { who: 0, daysAgo: 14, input: { category: "meals", amount: 112, merchant: "Joe's Pizza", description: "Working dinner, 2 people", attendees: 2, has_receipt: true }, review: ["approved", ""] },
  { who: 2, daysAgo: 12, input: { category: "training", amount: 1290, merchant: "SaaStr", description: "SaaStr Annual ticket", expense_date: D(40), has_receipt: true } },
  { who: 3, daysAgo: 11, input: { category: "flights", amount: 3480, merchant: "British Airways", description: "Business class SFO → LHR", cabin_class: "business", expense_date: D(9), city: "London", has_receipt: true }, review: ["rejected", "Please rebook in economy per §3.1."] },
  { who: 3, daysAgo: 10, input: { category: "flights", amount: 920, merchant: "British Airways", description: "Economy SFO → LHR (rebooked)", cabin_class: "economy", expense_date: D(9), city: "London", has_receipt: true } },
  { who: 3, daysAgo: 10, input: { category: "hotels", amount: 1240, merchant: "The Hoxton", description: "4 nights, London customer visits", nights: 4, city: "London", has_receipt: true } },
  { who: 4, daysAgo: 8, input: { category: "meals", amount: 58, merchant: "Sweetgreen", description: "Lunch while travelling", has_receipt: true } },
  { who: 5, daysAgo: 6, input: { category: "meals", amount: 95, merchant: "The Pub", description: "Dinner and beer after on-call incident", attendees: 2, has_receipt: true } },
  { who: 1, daysAgo: 5, input: { category: "software", amount: 79, merchant: "Vercel", description: "Pro plan for side-project demos", has_receipt: true } },
  { who: 2, daysAgo: 4, input: { category: "hotels", amount: 280, merchant: "Hotel Zetta", description: "1 night SF offsite", nights: 1, city: "San Francisco", has_receipt: true } },
  { who: 0, daysAgo: 3, input: { category: "office_supplies", amount: 140, merchant: "Staples", description: "Whiteboard and markers", has_receipt: false } },
  { who: 4, daysAgo: 2, input: { category: "flights", amount: 412, merchant: "Delta", description: "Design conference, Austin", cabin_class: "economy", expense_date: D(10), city: "Austin", has_receipt: true } },
  { who: 5, daysAgo: 1, input: { category: "equipment", amount: 349, merchant: "Logitech", description: "Keyboard and mouse", has_receipt: true } },
];

export async function ensureDemo(q: Q) {
  const exists = await q(`select id from workspaces where id = $1`, [DEMO.workspaceId]);
  if (exists.length) return;
  await resetDemo(q);
}

export async function resetDemo(q: Q) {
  const ws = DEMO.workspaceId;
  await q(`delete from requests where workspace_id = $1`, [ws]);
  await q(`delete from policy_versions where workspace_id = $1`, [ws]);
  await q(`delete from events where workspace_id = $1`, [ws]);
  await q(
    `insert into workspaces (id, name, slug, admin_name, admin_email, password_hash, mcp_key, is_demo)
     values ($1,$2,$3,$4,$5,$6,$7,true) on conflict (id) do nothing`,
    [ws, DEMO.name, DEMO.slug, DEMO.adminName, DEMO.email, hashPassword(DEMO.password), DEMO.mcpKey],
  );
  const publishedAt = new Date(Date.now() - 40 * 86400000);
  await q(
    `insert into policy_versions (id, workspace_id, version, status, source, policy, note, created_at, updated_at, published_at, published_by)
     values ($1,$2,1,'published','human',$3::jsonb,$4,$5,$5,$5,$6)`,
    [`pv_${ws}_1`, ws, JSON.stringify(DEMO_POLICY_V1), "Imported from the 2025 handbook", publishedAt, DEMO.adminName],
  );
  await q(`insert into events (id, workspace_id, actor, kind, detail, created_at) values ($1,$2,'admin','published','Published v1 — 2025 policy',$3)`, [
    `ev_${ws}_seed`,
    ws,
    publishedAt,
  ]);

  // Replay history through the real engine so every decision is genuine.
  const mtd = new Map<string, number>();
  let n = 1001;
  for (const s of [...SEED_REQUESTS].sort((a, b) => b.daysAgo - a.daysAgo)) {
    const p = PEOPLE[s.who];
    const created = new Date(Date.now() - s.daysAgo * 86400000 - (s.who * 37 + 9) * 60000);
    const input: RequestInput = { ...s.input, department: p.dept };
    const key = `${p.email}|${input.category}|${created.toISOString().slice(0, 7)}`;
    const prior = mtd.get(key) ?? 0;
    const d = evaluate(DEMO_POLICY_V1, input, { now: created, priorMonthSpend: prior });
    let status = d.outcome === "allow" ? "approved" : d.outcome === "block" ? "blocked" : "pending";
    let reviewer: string | null = null;
    let note: string | null = null;
    let decidedAt: Date | null = d.outcome === "allow" || d.outcome === "block" ? created : null;
    if (status === "pending" && s.review) {
      status = s.review[0];
      reviewer = DEMO.adminName;
      note = s.review[1] || null;
      decidedAt = new Date(created.getTime() + 5 * 3600000);
    }
    if (status !== "blocked" && status !== "rejected") mtd.set(key, prior + input.amount);
    await q(
      `insert into requests (id, workspace_id, ref, employee_name, employee_email, input, decision, policy_version, status, auto, reviewer, review_note, created_at, decided_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,1,$8,$9,$10,$11,$12,$13)`,
      [`rq_${ws}_${n}`, ws, `EXP-${n}`, p.name, p.email, JSON.stringify(input), JSON.stringify(d), status, !reviewer, reviewer, note, created, decidedAt],
    );
    n++;
  }
}
