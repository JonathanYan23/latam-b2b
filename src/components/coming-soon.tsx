import Link from "next/link";
import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-[var(--color-bg-muted)]">
        <Construction className="size-6 text-[var(--color-ink-3)]" strokeWidth={1.6} />
      </span>
      <h1 className="text-h2 mt-5">{title}</h1>
      <p className="text-body mt-2 max-w-sm">{description}</p>
      <Link href={backHref} className="btn btn-primary mt-7 px-5 py-2 text-sm">
        {backLabel}
      </Link>
    </div>
  );
}
