import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">That pattern or problem isn&apos;t in the library.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/dsa">Browse patterns</Link>
      </Button>
    </div>
  );
}
