import { sameOrigin } from "@/lib/progress/server";
import { tutorDeps } from "@/lib/tutor/deps";
import { ask, stepInfo, type TutorRefusal } from "@/lib/tutor/service";

/**
 * "Ask about this step". GET ?problem=<pattern/slug>&scene=<id>: the panel's step label, suggested questions, and
 * questions left today (no model call). POST { problemKey, sceneId, question, history }: the answer, streamed as plain
 * text (or JSON with a message and, for a cap, when it resets). Signed-in, verified users only; same-origin POSTs only.
 */
const NO_STORE = { "Cache-Control": "private, no-store" };
const refusal = (r: TutorRefusal) => Response.json(r, { status: r.status, headers: NO_STORE });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const info = await stepInfo(
    await tutorDeps(true),
    url.searchParams.get("problem") ?? "",
    url.searchParams.get("scene") ?? "",
  );
  if ("status" in info) return refusal(info);
  return Response.json(info, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const origin = sameOrigin(request);
  let body: unknown;
  try {
    const text = await request.text();
    body = text.length > 8_000 ? undefined : JSON.parse(text);
  } catch {
    body = undefined;
  }
  const result = await ask(await tutorDeps(origin), body);
  if ("status" in result) return refusal(result);
  const headers = {
    ...NO_STORE,
    "Content-Type": "text/plain; charset=utf-8",
    "X-Tutor-Remaining": String(result.remaining),
  };
  if (result.kind === "text")
    return new Response(result.text, { headers: { ...headers, "X-Tutor-Cached": String(result.cached) } });
  const encoder = new TextEncoder();
  const chunks = result.chunks;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      } catch {
        // The answer stopped partway (the provider dropped it): say so at the end of what arrived.
        controller.enqueue(encoder.encode("\n\n(The tutor stopped early. Try asking again.)"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers });
}
