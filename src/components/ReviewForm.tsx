"use client";
import { useState, useTransition } from "react";
import { review } from "@/app/actions";

export function ReviewForm({ refId, approver }: { refId: string; approver: string }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card p-5">
      <p className="font-medium">Your decision</p>
      <p className="text-sm text-muted">Policy routed this to <b className="text-ink">{approver}</b>. Your note is shown to the employee.</p>
      <textarea className="input mt-3" rows={2} placeholder="Optional note, e.g. “OK — client meeting was confirmed.”" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <button className="btn bg-ok text-white hover:bg-ok/90" disabled={pending} onClick={() => start(() => review(refId, "approved", note))}>Approve</button>
        <button className="btn bg-bad text-white hover:bg-bad/90" disabled={pending} onClick={() => start(() => review(refId, "rejected", note))}>Reject</button>
      </div>
    </div>
  );
}
