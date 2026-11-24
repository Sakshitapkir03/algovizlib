import { readJson, toResponse } from "@/lib/progress/api-deps";
import { sameOrigin } from "@/lib/progress/server";
import { checksApiDeps } from "@/lib/quickcheck/api-deps";
import { getChecks, postChecks } from "@/lib/quickcheck/server";

/** The signed-in user's quick check answers (GET, the latest) and a batch of new ones (POST). */
export async function GET() {
  return toResponse(await getChecks(await checksApiDeps()));
}

export async function POST(request: Request) {
  const body = await readJson(request, sameOrigin(request));
  if (body instanceof Response) return body;
  return toResponse(await postChecks(await checksApiDeps(), body));
}
