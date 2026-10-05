import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NAV } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <p className="eyebrow">Exit code 404</p>
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        This byte range is empty
      </h1>
      <pre className="w-full overflow-x-auto rounded-lg border bg-card p-4 font-mono text-xs text-muted-foreground">
        <code>
          {`slurmstepd: error: *** JOB CANCELLED ***\nchunk_start >= file_size: nothing to scan here`}
        </code>
      </pre>
      <p className="text-muted-foreground">
        The page you asked for does not exist. Try one of these instead:
      </p>
      <ul className="grid w-full gap-2 sm:grid-cols-2">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className="panel block p-3 transition-colors hover:border-primary/50"
            >
              <span className="block font-medium">{n.label}</span>
              <span className="block text-xs text-muted-foreground">{n.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline">
        <Link href="/">
          <ArrowLeft aria-hidden /> Back to the overview
        </Link>
      </Button>
    </div>
  );
}
