import Link from "next/link";
import { Fragment } from "react";

/**
 * Path-style breadcrumb: `dsa / two-pointers / pair-with-target-sum`. Every segment but the last is a link.
 */
export function PathBreadcrumb({ segments }: { segments: { label: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <li>
          <Link href="/" className="rounded-sm hover:text-foreground">
            ~
          </Link>
        </li>
        {segments.map((segment, i) => {
          const last = i === segments.length - 1;
          return (
            <Fragment key={segment.href}>
              <li aria-hidden>/</li>
              <li>
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {segment.label}
                  </span>
                ) : (
                  <Link href={segment.href} className="rounded-sm hover:text-foreground">
                    {segment.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
