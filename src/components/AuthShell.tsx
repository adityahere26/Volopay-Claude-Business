import { Logo } from "@/components/ui";
import { demoLogin } from "@/app/actions";
import { DEMO } from "@/lib/seed";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <Logo />
      <h1 className="mt-8 font-serif text-4xl">{title}</h1>
      <div className="card mt-6 p-6">{children}</div>
      <div className="mt-6 rounded-xl border border-dashed border-line p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">Reviewing Clause?</p>
        <p className="mt-1">Demo login: <span className="font-mono">{DEMO.email}</span> / <span className="font-mono">{DEMO.password}</span></p>
        <form action={demoLogin} className="mt-3"><button className="btn-line">Open demo workspace →</button></form>
      </div>
    </main>
  );
}
