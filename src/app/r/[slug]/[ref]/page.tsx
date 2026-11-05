import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequest, getWorkspaceBySlug } from "@/lib/store";
import { categoryLabel, money } from "@/lib/engine";
import { Reasons, Verdict } from "@/components/Decision";

export const dynamic = "force-dynamic";

export default async function Result({ params, searchParams }: PageProps<"/r/[slug]/[ref]">) {
  const { slug, ref } = await params;
  const { email } = await searchParams;
  const ws = await getWorkspaceBySlug(slug);
  if (!ws) notFound();
  const r = await getRequest(ws.id, ref);
  // Light privacy guard: you need the submitter's email (it's in the link we redirect you to).
  if (!r || typeof email !== "string" || email.toLowerCase() !== r.employee_email.toLowerCase()) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="font-medium">{ws.name}</p>
      <p className="eyebrow mt-8">{r.ref} · {categoryLabel(r.input.category)}</p>
      <h1 className="mt-2 font-serif text-4xl">{money(r.input.amount)} at {r.input.merchant ?? "—"}</h1>
      <div className="mt-6"><Verdict d={r.decision} status={r.status} /></div>
      {r.review_note && <p className="card mt-3 p-4 text-sm"><b>{r.reviewer}:</b> “{r.review_note}”</p>}
      <section className="card mt-6 p-5">
        <p className="eyebrow mb-3">What the policy says</p>
        <Reasons d={r.decision} />
      </section>
      <p className="mt-6 text-sm text-muted">Bookmark this page to check the status. <Link href={`/r/${slug}`} className="underline">Submit another →</Link></p>
    </main>
  );
}
