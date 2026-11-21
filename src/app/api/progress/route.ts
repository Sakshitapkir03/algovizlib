import { progressApiDeps, readJson, toResponse } from "@/lib/progress/api-deps";
import { getProgress, postProgress, sameOrigin } from "@/lib/progress/server";

/** The signed-in user's progress (GET) and one change to it (POST; also what `sendBeacon` sends on page hide). */
export async function GET() {
  return toResponse(await getProgress(await progressApiDeps()));
}

export async function POST(request: Request) {
  const body = await readJson(request, sameOrigin(request));
  if (body instanceof Response) return body;
  return toResponse(await postProgress(await progressApiDeps(), body));
}
