import type { VoiceSpec } from "@/lib/narration/hash";

import { GenerationConfigError, OverloadedError, RateLimitError } from "../errors";

/** The account's character quota is used up: retrying is pointless until it resets, so the run stops. */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

/** The request needs a paid plan (e.g. a Voice Library voice or a higher bitrate). Stops the run. */
export class PaidPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaidPlanError";
  }
}

/** ElevenLabs refused this one request (bad text, validation error). The run moves on to the next video. */
export class SynthesisRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SynthesisRequestError";
  }
}

/**
 * Context for continuity between adjacent scenes (ElevenLabs "request stitching"): the neighbors' text, and the ids
 * of the requests just before this one (at most 3, newest last, less than two hours old). When ids are sent,
 * ElevenLabs ignores `previous_text`, so it's left out.
 */
export type SynthesisContext = {
  previousText?: string;
  nextText?: string;
  previousRequestIds?: readonly string[];
};

export type SynthesisResult = {
  bytes: Uint8Array;
  /** The `request-id` response header, for the next scene's `previous_request_ids`. */
  requestId?: string;
  /** The `character-cost` response header: what ElevenLabs billed. */
  characterCost?: number;
};

export type Synthesize = (
  text: string,
  voice: VoiceSpec,
  context?: SynthesisContext,
) => Promise<SynthesisResult>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const API = "https://api.elevenlabs.io/v1/text-to-speech";

/** `{ detail: { status, message } }` from an error body; never contains the key. */
async function errorDetail(response: Response): Promise<{ status: string; message: string }> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { detail?: { status?: string; message?: string } | string };
    if (typeof body.detail === "string") return { status: "", message: body.detail };
    return { status: body.detail?.status ?? "", message: body.detail?.message ?? "" };
  } catch {
    return { status: "", message: text.slice(0, 200) };
  }
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  return header && Number.isFinite(Number(header)) ? Number(header) * 1000 : undefined;
}

/**
 * Map an ElevenLabs error response onto what the pipeline does next:
 * - quota exhausted (`quota_exceeded`, usually 401) → `QuotaExceededError` (stop, no retry)
 * - other 401 → bad key or missing permission (`GenerationConfigError`, stop)
 * - 402 → `PaidPlanError` (stop)
 * - 429 (`too_many_concurrent_requests`, `system_busy`) → `RateLimitError` (retry with backoff)
 * - 5xx → `OverloadedError` (retry with backoff)
 * - anything else (400, 422) → `SynthesisRequestError` (this video fails)
 */
export async function classifyResponse(response: Response): Promise<Error> {
  const { status, message } = await errorDetail(response);
  const said = [status, message].filter(Boolean).join(": ");
  if (/quota/i.test(status) || /quota|credits? (remaining|left)/i.test(message))
    return new QuotaExceededError(`ElevenLabs quota exhausted (${said || response.status}).`);
  if (response.status === 401)
    return new GenerationConfigError(
      `ElevenLabs rejected the request (401${said ? `, ${said}` : ""}). Check ELEVENLABS_API_KEY in .env.local and that it has text-to-speech access.`,
    );
  if (response.status === 402)
    return new PaidPlanError(
      `ElevenLabs says this needs a paid plan (402${said ? `, ${said}` : ""}). Pick a default voice with ELEVENLABS_VOICE_ID.`,
    );
  if (response.status === 429)
    return new RateLimitError(`Rate limited by ElevenLabs (${said || "429"}).`, retryAfterMs(response));
  if (response.status >= 500)
    return new OverloadedError(`ElevenLabs is unavailable (${response.status}).`, retryAfterMs(response));
  return new SynthesisRequestError(
    `ElevenLabs refused the request (${response.status}${said ? `, ${said}` : ""}).`,
  );
}

/** Text-to-speech over the REST API (`POST /v1/text-to-speech/{voice_id}`), returning the MP3 bytes. */
export function createElevenLabs({
  apiKey,
  timeoutMs,
  fetch: fetchImpl = fetch,
}: {
  apiKey: string;
  timeoutMs: number;
  fetch?: FetchLike;
}): Synthesize {
  return async (text, voice, context = {}) => {
    const ids = context.previousRequestIds?.slice(-3) ?? [];
    const body = {
      text,
      model_id: voice.modelId,
      ...(ids.length > 0
        ? { previous_request_ids: ids }
        : context.previousText
          ? { previous_text: context.previousText }
          : {}),
      ...(context.nextText ? { next_text: context.nextText } : {}),
    };
    let response: Response;
    try {
      response = await fetchImpl(
        `${API}/${encodeURIComponent(voice.voiceId)}?output_format=${encodeURIComponent(voice.outputFormat)}`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
    } catch (error) {
      // Timeout, or the connection dropping: worth retrying like an overload. The error never carries the key.
      const reason = error instanceof Error ? error.name : "network error";
      throw new OverloadedError(`Couldn't reach ElevenLabs (${reason}).`);
    }
    if (!response.ok) throw await classifyResponse(response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) throw new SynthesisRequestError("ElevenLabs returned an empty file.");
    const cost = Number(response.headers.get("character-cost"));
    return {
      bytes,
      requestId: response.headers.get("request-id") ?? undefined,
      characterCost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
    };
  };
}
