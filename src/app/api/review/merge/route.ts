import { readJson, toResponse } from "@/lib/progress/api-deps";
import { sameOrigin } from "@/lib/progress/server";
import { reviewApiDeps } from "@/lib/review/api-deps";
import { mergeReview } from "@/lib/review/server";

/** A guest's review schedule from this browser, merged into the account on sign-in; returns the merged schedule. */
export async function POST(request: Request) {
  const body = await readJson(request, sameOrigin(request));
  if (body instanceof Response) return body;
  return toResponse(await mergeReview(await reviewApiDeps(), body));
}
