import { readJson, toResponse } from "@/lib/progress/api-deps";
import { sameOrigin } from "@/lib/progress/server";
import { reviewApiDeps } from "@/lib/review/api-deps";
import { getReview, postReview } from "@/lib/review/server";

/** The signed-in user's review schedule (GET) and one change to it: "Reviewed" or "Snooze 3 days" (POST). */
export async function GET() {
  return toResponse(await getReview(await reviewApiDeps()));
}

export async function POST(request: Request) {
  const body = await readJson(request, sameOrigin(request));
  if (body instanceof Response) return body;
  return toResponse(await postReview(await reviewApiDeps(), body));
}
