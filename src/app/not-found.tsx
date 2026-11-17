import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">We don&apos;t have that video yet</h1>
      <p className="mt-2 text-muted-foreground">It may not be in the library yet.</p>
      <Button asChild className="mt-6">
        <Link href="/">Browse the library</Link>
      </Button>
    </div>
  );
}
