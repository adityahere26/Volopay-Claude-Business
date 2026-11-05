"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Polls a cheap stamp; when Claude (or anyone) changes something, the page refreshes itself. */
export function LiveRefresh() {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/live", { cache: "no-store" });
        const { stamp } = await r.json();
        if (!alive || !stamp) return;
        if (last.current && last.current !== stamp) {
          router.refresh();
          setFlash(true);
          setTimeout(() => setFlash(false), 2500);
        }
        last.current = stamp;
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${flash ? "text-claude" : "text-muted"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${flash ? "bg-claude" : "bg-ok"} animate-pulse`} />
      {flash ? "Updated" : "Live"}
    </span>
  );
}
