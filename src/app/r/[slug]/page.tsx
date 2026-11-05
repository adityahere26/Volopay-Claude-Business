import { notFound } from "next/navigation";
import { getPublished, getWorkspaceBySlug } from "@/lib/store";
import { ExpenseForm } from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function Portal({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const ws = await getWorkspaceBySlug(slug);
  if (!ws) notFound();
  const pub = await getPublished(ws.id);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between">
        <p className="font-medium">{ws.name}</p>
        <p className="text-xs text-muted">Spend requests · powered by <span className="font-serif text-base"><span className="text-mark">§</span>Clause</span></p>
      </div>
      <h1 className="mt-8 font-serif text-5xl">Can I expense this?</h1>
      <p className="mt-2 max-w-xl text-ink-2">Tell us what you&apos;re spending. You&apos;ll get an answer straight away, with the part of {ws.name}&apos;s policy that applies.</p>
      <div className="mt-8">
        {pub ? <ExpenseForm slug={slug} /> : <p className="card p-6 text-muted">{ws.name} hasn&apos;t published a spend policy yet.</p>}
      </div>
    </main>
  );
}
