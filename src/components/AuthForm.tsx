"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, signup } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  return (
    <form action={action} className="space-y-4">
      {mode === "signup" && (
        <>
          <div><label className="label">Company</label><input name="company" className="input" placeholder="Northwind Labs" required /></div>
          <div><label className="label">Your name</label><input name="name" className="input" placeholder="Alex Rivera" required /></div>
        </>
      )}
      <div><label className="label">Work email</label><input name="email" type="email" className="input" placeholder="you@company.com" required /></div>
      <div><label className="label">Password</label><input name="password" type="password" className="input" required minLength={mode === "signup" ? 8 : 1} /></div>
      {state?.error && <p className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-ink w-full py-2.5" disabled={pending}>{pending ? "…" : mode === "login" ? "Sign in" : "Create workspace"}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New here? <Link className="text-ink underline" href="/signup">Create a workspace</Link></> : <>Have an account? <Link className="text-ink underline" href="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
