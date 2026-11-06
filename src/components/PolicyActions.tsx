"use client";
import { useState, useTransition } from "react";
import { discard, publish, startDraft } from "@/app/actions";

export function PublishBar({ blocked }: { version: number; blocked: string | null; impact: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {err && <span className="text-sm text-bad">{err}</span>}
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await discard(); })}>Discard</button>
      {confirming ? (
        <>
          <span className="text-sm font-medium">Make this live for everyone?</span>
          <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
          <button className="btn-ink" disabled={pending} onClick={() => start(async () => { const r = await publish(); if (r.error) setErr(r.error); setConfirming(false); })}>
            {pending ? "Publishing…" : "Yes, publish"}
          </button>
        </>
      ) : (
        <button className="btn-ink px-6 py-2.5 text-base" disabled={!!blocked || pending} title={blocked ?? ""} onClick={() => setConfirming(true)}>
          Publish →
        </button>
      )}
    </div>
  );
}

export function EditPolicyButton() {
  const [pending, start] = useTransition();
  return <button className="btn-line" disabled={pending} onClick={() => start(async () => { await startDraft(); })}>{pending ? "…" : "✎ Edit rules"}</button>;
}
