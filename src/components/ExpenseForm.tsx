"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { previewExpense, submitExpense } from "@/app/actions";
import { CABIN_CLASSES, CATEGORIES } from "@/lib/engine";
import { OutcomePill } from "./ui";

type Preview = Awaited<ReturnType<typeof previewExpense>>;

export function ExpenseForm({ slug }: { slug: string }) {
  const [state, action, submitting] = useActionState(submitExpense.bind(null, slug), undefined);
  const [category, setCategory] = useState("meals");
  const [preview, setPreview] = useState<Preview>(null);
  const [, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recheck = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      start(async () => setPreview(await previewExpense(slug, fd)));
    }, 250);
  };
  useEffect(recheck, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (cats: string[]) => cats.includes(category);
  return (
    <form ref={formRef} action={action} onChange={recheck} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Your name</label><input name="name" className="input" placeholder="Priya Nair" required /></div>
          <div><label className="label">Work email</label><input name="email" type="email" className="input" placeholder="priya@company.com" required /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Department</label><input name="department" className="input" placeholder="Sales" /></div>
          <div>
            <label className="label">What is it?</label>
            <select name="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <div className="relative">
            <label className="label">Amount (USD)</label>
            <span className="pointer-events-none absolute bottom-2 left-3 text-sm text-muted">$</span>
            <input name="amount" type="number" step="0.01" min="0" className="input pl-7 font-mono" placeholder="0.00" required />
          </div>
          <div><label className="label">Merchant</label><input name="merchant" className="input" placeholder="e.g. The Hoxton" /></div>
        </div>
        <div><label className="label">Description</label><input name="description" className="input" placeholder="What and why — e.g. dinner with Acme's procurement team" /></div>

        <div className="grid gap-3 sm:grid-cols-3">
          {show(["flights", "hotels", "training"]) && (
            <div><label className="label">{category === "flights" ? "Departure date" : "Date"}</label><input name="expense_date" type="date" className="input" /></div>
          )}
          {show(["flights", "hotels", "meals", "client_entertainment"]) && (
            <div><label className="label">City</label><input name="city" className="input" placeholder="London" /></div>
          )}
          {show(["meals", "client_entertainment"]) && (
            <div><label className="label">People (incl. you)</label><input name="attendees" type="number" min="1" className="input" placeholder="1" /></div>
          )}
          {show(["hotels"]) && <div><label className="label">Nights</label><input name="nights" type="number" min="1" className="input" placeholder="1" /></div>}
          {show(["flights"]) && (
            <div>
              <label className="label">Cabin</label>
              <select name="cabin_class" className="input" defaultValue="economy">
                {CABIN_CLASSES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="has_receipt" defaultChecked className="h-4 w-4 accent-brand" /> I have a receipt</label>
        {state?.error && <p className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{state.error}</p>}
        <button className="btn-ink w-full py-2.5" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>
      </div>

      <aside className="h-fit lg:sticky lg:top-6">
        <p className="eyebrow mb-2">Before you submit</p>
        <div className="card p-5">
          {!preview ? (
            <p className="text-sm text-muted">Enter an amount and Clause will tell you instantly what the policy says — before you spend.</p>
          ) : (
            <>
              <OutcomePill outcome={preview.outcome} approver={preview.approver} />
              <p className="mt-2 font-serif text-2xl leading-tight">{preview.headline}</p>
              <ul className="mt-3 space-y-3">
                {preview.hits.map((h) => (
                  <li key={h.rule_id} className="text-sm">
                    <span className="clause">§{h.clause}</span> {h.message || h.title}
                    {h.quote && <p className="quote mt-1 text-[15px]">“{h.quote}”</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">Policy v{preview.version} · checked in under a millisecond</p>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}
