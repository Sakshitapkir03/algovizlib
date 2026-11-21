import { progressApiDeps, readJson, toResponse } from "@/lib/progress/api-deps";
import { mergeProgress, sameOrigin } from "@/lib/progress/server";

/** Merge a guest's browser progress into the signed-in account; answers with the merged records. */
export async function POST(request: Request) {
  const body = await readJson(request, sameOrigin(request));
  if (body instanceof Response) return body;
  return toResponse(await mergeProgress(await progressApiDeps(), body));
}
