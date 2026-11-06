import { SAMPLE_POLICY_TEXT } from "@/lib/seed";
import { CopyBlock } from "@/components/Copy";
import { Logo } from "@/components/ui";

export default function SamplePolicy() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <CopyBlock value={SAMPLE_POLICY_TEXT} label="Copy policy text" />
      </div>
      <p className="eyebrow mt-10">Sample document · paste into Claude with “Set this up in Clause”</p>
      <article className="card mt-3 p-8">
        <pre className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-ink-2">{SAMPLE_POLICY_TEXT}</pre>
      </article>
    </main>
  );
}
