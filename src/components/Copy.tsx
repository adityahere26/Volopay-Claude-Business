"use client";
import { useState } from "react";

export function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-paper">
      <code className={`min-w-0 flex-1 truncate px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}>{value}</code>
      <button
        className="border-l border-line bg-card px-3 text-sm hover:bg-line-2 cursor-pointer"
        onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CopyBlock({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn-line" onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied ✓" : label}
    </button>
  );
}
