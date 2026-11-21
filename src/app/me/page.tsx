import type { Metadata } from "next";

import { MyProgress } from "@/components/account/my-progress";
import { getProgressIndex } from "@/lib/catalog/repository";

export const metadata: Metadata = { title: "My progress", robots: { index: false } };

/** Static shell; the progress itself is read in the browser (this browser's copy, or the account's). */
export default function MePage() {
  return <MyProgress index={getProgressIndex()} />;
}
