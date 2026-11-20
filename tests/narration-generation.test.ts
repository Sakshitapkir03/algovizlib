import { describe, expect, it } from "vitest";

import { GenerationConfigError, OverloadedError, RateLimitError } from "@/lib/generation/errors";
import {
  narrationExitStatus,
  parseNarrationCli,
  selectNarrationTargets,
  suggestDrop,
  type NarrationCatalog,
} from "@/lib/generation/narration/cli";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICE_ID,
  readApiKey,
  readNarrationConfig,
} from "@/lib/generation/narration/config";
import {
  classifyResponse,
  createElevenLabs,
  PaidPlanError,
  QuotaExceededError,
  SynthesisRequestError,
} from "@/lib/generation/narration/elevenlabs";
import { mp3DurationMs } from "@/lib/generation/narration/mp3";
import {
  clipFile,
  DEFAULT_MAX_CHARS,
  needsWork,
  plannedChars,
  runNarration,
  trackFile,
  type AudioStore,
  type NarrationDeps,
  type NarrationTarget,
} from "@/lib/generation/narration/pipeline";
import type { SynthesisContext } from "@/lib/generation/narration/elevenlabs";
import { narrationCatalog } from "@/lib/generation/narration/catalog";
import { narrationHash, type VoiceSpec } from "@/lib/narration/hash";
import { emptyManifest, type NarrationManifest } from "@/lib/narration/manifest";

// ── test doubles ────────────────────────────────────────────────────────────────────────────────────────────

const VOICE: VoiceSpec = { voiceId: "voice-a", modelId: "eleven_flash_v2_5", outputFormat: "mp3_44100_64" };

/** An MPEG-1 layer III file: `frames` frames of 1152 samples at 44.1 kHz, 64 kbps, mono. */
function fakeMp3(frames: number, { id3 = false, xing = false } = {}): Uint8Array {
  const frameLength = Math.floor((144 * 64000) / 44100); // 208 bytes
  const parts: number[] = [];
  if (id3) parts.push(0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0));
  for (let f = 0; f < frames + (xing ? 1 : 0); f++) {
    const frame = new Array(frameLength).fill(0);
    frame.splice(0, 4, 0xff, 0xfb, 0x50, 0xc4);
    if (xing && f === 0) frame.splice(4 + 17, 4, ..."Xing".split("").map((c) => c.charCodeAt(0)));
    parts.push(...frame);
  }
  return new Uint8Array(parts);
}

function memoryStore(manifest: NarrationManifest = emptyManifest(), files: string[] = []) {
  const saved = new Map<string, Uint8Array>(files.map((f) => [f, new Uint8Array([1])]));
  let current = structuredClone(manifest);
  const store: AudioStore & {
    saved: Map<string, Uint8Array>;
    manifest: () => NarrationManifest;
    writes: number;
  } = {
    saved,
    writes: 0,
    manifest: () => current,
    readManifest: () => structuredClone(current),
    writeManifest(m) {
      current = structuredClone(m);
      store.writes++;
    },
    writeClip: (file, bytes) => void saved.set(file, bytes),
    clipExists: (file) => saved.has(file),
    removeClip: (file) => void saved.delete(file),
    writeTrack: (file, bytes) => void saved.set(file, bytes),
    trackExists: (file) => saved.has(file),
    removeTrack: (file) => void saved.delete(file),
  };
  return store;
}

/**
 * A synthesizer that plays back scripted results (errors are thrown) and records every text it was sent, with
 * its continuity context. Each success gets a request id ("req-1", …).
 */
function fakeSynth(script: (Error | "ok")[] = [], { cost }: { cost?: number } = {}) {
  const queue = [...script];
  const calls: string[] = [];
  const contexts: (SynthesisContext | undefined)[] = [];
  let ok = 0;
  const synthesize: NarrationDeps["synthesize"] = async (text, _voice, context) => {
    calls.push(text);
    contexts.push(context);
    const next = queue.shift() ?? "ok";
    if (next instanceof Error) throw next;
    return {
      bytes: fakeMp3(Math.max(1, Math.round(text.length / 5))),
      requestId: `req-${++ok}`,
      characterCost: cost,
    };
  };
  return { synthesize, calls, contexts };
}

/** A stitcher that records the clips it joined; `problems` makes its check fail. */
function fakeStitch(problems: string[] = []) {
  const calls: string[][] = [];
  const stitch: NarrationDeps["stitch"] = (files) => {
    calls.push([...files]);
    return {
      bytes: new Uint8Array([9]),
      durationMs: 300 + files.length * 1600,
      scenes: files.map((_, i) => ({ startMs: 300 + i * 1600, speechMs: 1000 })),
      problems,
    };
  };
  return { stitch, calls };
}

function deps(store: AudioStore, synthesize: NarrationDeps["synthesize"], stitch = fakeStitch().stitch) {
  const sleeps: number[] = [];
  const lines: string[] = [];
  const d: NarrationDeps = {
    synthesize,
    stitch,
    store,
    measureMs: mp3DurationMs,
    sleep: async (ms) => void sleeps.push(ms),
    log: (line) => void lines.push(line),
  };
  return { deps: d, sleeps, lines };
}

const target = (id: string, narrations: string[]): NarrationTarget => ({
  storyboardId: id,
  problemKey: `pattern/${id}`,
  scenes: narrations.map((narration, i) => ({ id: `s${i + 1}`, narration })),
});

const options = (overrides: Partial<{ dryRun: boolean; stitchOnly: boolean; maxChars: number }> = {}) => ({
  dryRun: false,
  maxChars: DEFAULT_MAX_CHARS,
  delayMs: 0,
  voice: VOICE,
  ...overrides,
});

// ── hashing and caching ─────────────────────────────────────────────────────────────────────────────────────

describe("narration hash", () => {
  it("covers the narration text, the voice, and the model", () => {
    const base = narrationHash("Two friends start at both ends.", VOICE);
    expect(narrationHash("Two friends start at both ends.", VOICE)).toBe(base);
    expect(narrationHash("Two friends start at either end.", VOICE)).not.toBe(base);
    expect(narrationHash("Two friends start at both ends.", { ...VOICE, voiceId: "voice-b" })).not.toBe(base);
    expect(
      narrationHash("Two friends start at both ends.", { ...VOICE, modelId: "eleven_flash_v2" }),
    ).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{14}$/);
  });

  it("names each clip and track after its hash", () => {
    expect(clipFile("two-pointers", "intro", "00ab")).toBe("two-pointers/intro-00ab.mp3");
    expect(trackFile("two-pointers", "00cd")).toBe("/audio/two-pointers/narration-00cd.mp3");
  });
});

describe("runNarration caching", () => {
  it("voices every scene once and records its measured length", async () => {
    const store = memoryStore();
    const synth = fakeSynth();
    const { deps: d } = deps(store, synth.synthesize);
    const summary = await runNarration([target("video", ["One two three.", "Four five."])], options(), d);

    expect(synth.calls).toEqual(["One two three.", "Four five."]);
    expect(summary.rows[0]).toMatchObject({ status: "saved", voicedScenes: 2, chars: 24 });
    expect(summary.charsUsed).toBe(24);
    const entry = store.manifest().storyboards.video.clips.s1;
    expect(entry).toMatchObject({ hash: narrationHash("One two three.", VOICE), chars: 14, ...VOICE });
    expect(entry.durationMs).toBe(mp3DurationMs(fakeMp3(3)));
    expect(store.saved.has(entry.file)).toBe(true);
    // The manifest is written after every clip (so a stop keeps what was saved), then once for the track.
    expect(store.writes).toBe(3);
  });

  it("skips unchanged narration: a second run makes no requests and costs nothing", async () => {
    const store = memoryStore();
    await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize).deps,
    );
    const again = fakeSynth();
    const summary = await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, again.synthesize).deps,
    );
    expect(again.calls).toEqual([]);
    expect(summary.rows[0]).toMatchObject({ status: "up to date", chars: 0 });
    expect(summary.charsUsed).toBe(0);
  });

  it("regenerates only the scene whose narration changed, and removes its old clip", async () => {
    const store = memoryStore();
    await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize).deps,
    );
    const oldFile = store.manifest().storyboards.video.clips.s2.file;

    const again = fakeSynth();
    const summary = await runNarration(
      [target("video", ["One.", "Two, edited."])],
      options(),
      deps(store, again.synthesize).deps,
    );
    expect(again.calls).toEqual(["Two, edited."]);
    expect(summary.charsUsed).toBe("Two, edited.".length);
    expect(store.saved.has(oldFile)).toBe(false);
    expect(store.manifest().storyboards.video.clips.s2.hash).toBe(narrationHash("Two, edited.", VOICE));
  });

  it("regenerates when the voice changes, and when a clip file is missing", async () => {
    const store = memoryStore();
    await runNarration([target("video", ["One."])], options(), deps(store, fakeSynth().synthesize).deps);
    const newVoice = fakeSynth();
    await runNarration(
      [target("video", ["One."])],
      { ...options(), voice: { ...VOICE, voiceId: "voice-b" } },
      deps(store, newVoice.synthesize).deps,
    );
    expect(newVoice.calls).toEqual(["One."]);

    store.saved.clear();
    const missing = fakeSynth();
    await runNarration(
      [target("video", ["One."])],
      { ...options(), voice: { ...VOICE, voiceId: "voice-b" } },
      deps(store, missing.synthesize).deps,
    );
    expect(missing.calls).toEqual(["One."]);
  });

  it("plannedChars counts only what still needs voicing", async () => {
    const store = memoryStore();
    await runNarration([target("video", ["One."])], options(), deps(store, fakeSynth().synthesize).deps);
    expect(plannedChars(target("video", ["One.", "Second scene."]), store, VOICE)).toBe(
      "Second scene.".length,
    );
  });
});

// ── stitching and continuity ────────────────────────────────────────────────────────────────────────────────

describe("runNarration stitching", () => {
  it("stitches a fully voiced video's clips, in scene order, into one recorded track", async () => {
    const store = memoryStore();
    const stitcher = fakeStitch();
    const summary = await runNarration(
      [target("video", ["One.", "Two.", "Three."])],
      options(),
      deps(store, fakeSynth().synthesize, stitcher.stitch).deps,
    );
    const { clips, track } = store.manifest().storyboards.video;
    expect(stitcher.calls).toEqual([["s1", "s2", "s3"].map((id) => clips[id].file)]);
    expect(summary.rows[0]).toMatchObject({ status: "saved", track: "stitched" });
    expect(track).toMatchObject({ durationMs: 300 + 3 * 1600 });
    expect(track!.file).toMatch(/^\/audio\/video\/narration-[0-9a-f]+\.mp3$/);
    expect(track!.scenes).toEqual(
      ["s1", "s2", "s3"].map((id, i) => ({
        id,
        hash: clips[id].hash,
        startMs: 300 + i * 1600,
        speechMs: 1000,
      })),
    );
    expect(store.saved.has(track!.file)).toBe(true);
  });

  it("restitches only when a clip changes, and removes the old track", async () => {
    const store = memoryStore();
    await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize).deps,
    );
    const first = store.manifest().storyboards.video.track!.file;
    const unchanged = fakeStitch();
    await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize, unchanged.stitch).deps,
    );
    expect(unchanged.calls).toEqual([]);
    expect(needsWork(target("video", ["One.", "Two."]), store, VOICE)).toBe(false);
    expect(needsWork(target("video", ["One.", "Two, edited."]), store, VOICE)).toBe(true);
    await runNarration(
      [target("video", ["One.", "Two, edited."])],
      options(),
      deps(store, fakeSynth().synthesize).deps,
    );
    const second = store.manifest().storyboards.video.track!.file;
    expect(second).not.toBe(first);
    expect(store.saved.has(first)).toBe(false);
  });

  it("--stitch-only builds tracks from existing clips without a single request", async () => {
    const store = memoryStore();
    await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize).deps,
    );
    const m = store.manifest();
    delete m.storyboards.video.track;
    store.writeManifest(m);
    const synth = fakeSynth();
    const summary = await runNarration(
      [target("video", ["One.", "Two."]), target("other", ["Not voiced."])],
      options({ stitchOnly: true }),
      deps(store, synth.synthesize).deps,
    );
    expect(synth.calls).toEqual([]);
    expect(summary.rows.map((r) => [r.status, r.track])).toEqual([
      ["stitched", "stitched"],
      ["not voiced", "-"],
    ]);
  });

  it("never records a track that fails its check", async () => {
    const store = memoryStore();
    const summary = await runNarration(
      [target("video", ["One.", "Two."])],
      options(),
      deps(store, fakeSynth().synthesize, fakeStitch(["scene 2 sits 25.1 ms off"]).stitch).deps,
    );
    expect(summary.rows[0]).toMatchObject({ status: "failed", track: "failed" });
    expect(summary.rows[0].detail).toMatch(/25.1 ms off/);
    expect(store.manifest().storyboards.video.track).toBeUndefined();
    expect(narrationExitStatus(summary).code).toBe(1);
  });

  it("a dry run reports a missing track without stitching", async () => {
    const store = memoryStore();
    await runNarration([target("video", ["One."])], options(), deps(store, fakeSynth().synthesize).deps);
    const m = store.manifest();
    delete m.storyboards.video.track;
    store.writeManifest(m);
    const stitcher = fakeStitch();
    const summary = await runNarration(
      [target("video", ["One."])],
      options({ dryRun: true }),
      deps(store, fakeSynth().synthesize, stitcher.stitch).deps,
    );
    expect(stitcher.calls).toEqual([]);
    expect(summary.rows[0].track).toBe("needs stitching");
  });

  it("sends each scene its neighbors' text and the ids of the adjacent requests before it", async () => {
    const store = memoryStore();
    const synth = fakeSynth();
    await runNarration(
      [target("video", ["A.", "B.", "C.", "D.", "E."])],
      options(),
      deps(store, synth.synthesize).deps,
    );
    expect(synth.contexts[0]).toEqual({ previousText: undefined, nextText: "B.", previousRequestIds: [] });
    expect(synth.contexts[1]).toEqual({ previousText: "A.", nextText: "C.", previousRequestIds: ["req-1"] });
    // At most 3, newest last.
    expect(synth.contexts[4]?.previousRequestIds).toEqual(["req-2", "req-3", "req-4"]);

    // Regenerating one scene in the middle: its neighbors' text, but no stale ids.
    const again = fakeSynth();
    await runNarration(
      [target("video", ["A.", "B.", "C, edited.", "D.", "E."])],
      options(),
      deps(store, again.synthesize).deps,
    );
    expect(again.contexts).toEqual([{ previousText: "B.", nextText: "D.", previousRequestIds: [] }]);
  });

  it("counts what ElevenLabs billed (character-cost) when it says", async () => {
    const store = memoryStore();
    const summary = await runNarration(
      [target("video", ["Hello."])],
      options(),
      deps(store, fakeSynth([], { cost: 9 }).synthesize).deps,
    );
    expect(summary.charsUsed).toBe(9);
  });
});

// ── budget and dry run ──────────────────────────────────────────────────────────────────────────────────────

describe("runNarration budget", () => {
  it("never starts a video whose remaining characters don't fit, and lists what's left", async () => {
    const store = memoryStore();
    const synth = fakeSynth();
    const targets = [
      target("a", ["x".repeat(40)]),
      target("b", ["y".repeat(40)]),
      target("c", ["z".repeat(10)]),
    ];
    const summary = await runNarration(
      targets,
      options({ maxChars: 60 }),
      deps(store, synth.synthesize).deps,
    );

    expect(synth.calls).toEqual(["x".repeat(40)]);
    expect(summary.charsUsed).toBe(40);
    expect(summary.stoppedBy).toBe("budget");
    expect(summary.rows.map((r) => r.status)).toEqual(["saved", "not started", "not started"]);
    expect(summary.remaining).toEqual(["b", "c"]);
    expect(narrationExitStatus(summary).code).toBe(2);
  });

  it("counts cached scenes as free", async () => {
    const store = memoryStore();
    await runNarration([target("a", ["x".repeat(50)])], options(), deps(store, fakeSynth().synthesize).deps);
    const synth = fakeSynth();
    const summary = await runNarration(
      [target("a", ["x".repeat(50), "new"])],
      options({ maxChars: 10 }),
      deps(store, synth.synthesize).deps,
    );
    expect(synth.calls).toEqual(["new"]);
    expect(summary.rows[0].status).toBe("saved");
  });

  it("--dry-run calls nothing and writes nothing, and totals the characters", async () => {
    const store = memoryStore();
    const synth = fakeSynth();
    const summary = await runNarration(
      [target("a", ["x".repeat(30), "y".repeat(20)]), target("b", ["z".repeat(70)])],
      options({ dryRun: true, maxChars: 60 }),
      deps(store, synth.synthesize).deps,
    );
    expect(synth.calls).toEqual([]);
    expect(store.writes).toBe(0);
    expect(store.saved.size).toBe(0);
    expect(summary.rows.map((r) => [r.storyboardId, r.chars, r.status])).toEqual([
      ["a", 50, "dry run"],
      ["b", 70, "dry run"],
    ]);
    // A dry run reports the whole selection, even over budget, so it can suggest what to drop.
    expect(summary.charsUsed).toBe(120);
    expect(narrationExitStatus(summary).code).toBe(0);
  });

  it("suggests the one video to drop that brings a selection under budget, keeping the most", () => {
    const rows = [
      { storyboardId: "a", chars: 1700 },
      { storyboardId: "b", chars: 1500 },
      { storyboardId: "c", chars: 1900 },
    ];
    expect(suggestDrop(rows, 5100)).toBeUndefined();
    expect(suggestDrop(rows, 3500)?.storyboardId).toBe("a"); // over by 1600: b is too small, a is the smallest that fits
    expect(suggestDrop(rows, 1000)).toBeUndefined(); // no single video covers 4100
  });
});

// ── quota, limits, and errors ───────────────────────────────────────────────────────────────────────────────

describe("runNarration errors", () => {
  it("stops on an exhausted quota without retrying, keeping what was saved", async () => {
    const store = memoryStore();
    const synth = fakeSynth(["ok", new QuotaExceededError("ElevenLabs quota exhausted (quota_exceeded).")]);
    const { deps: d, sleeps } = deps(store, synth.synthesize);
    const summary = await runNarration(
      [target("a", ["One.", "Two."]), target("b", ["Three."])],
      options(),
      d,
    );

    expect(synth.calls).toEqual(["One.", "Two."]);
    expect(sleeps).toEqual([]);
    expect(summary.stoppedBy).toBe("quota");
    expect(summary.charsUsed).toBe(4);
    expect(summary.rows.map((r) => r.status)).toEqual(["partial", "not started"]);
    expect(Object.keys(store.manifest().storyboards.a.clips)).toEqual(["s1"]);
    expect(summary.remaining).toEqual(["a", "b"]);
    expect(narrationExitStatus(summary)).toMatchObject({ code: 2 });
    expect(narrationExitStatus(summary).reason).toMatch(/quota/);
  });

  it("retries per-minute limits and overloads with backoff, then succeeds", async () => {
    const store = memoryStore();
    const synth = fakeSynth([new RateLimitError("busy", 2000), new OverloadedError("503"), "ok"]);
    const { deps: d, sleeps } = deps(store, synth.synthesize);
    const summary = await runNarration([target("a", ["One."])], options(), d);
    expect(sleeps).toEqual([2000, 15_000]);
    expect(summary.rows[0].status).toBe("saved");
    expect(summary.requests).toBe(3);
    // Refused requests aren't billed.
    expect(summary.charsUsed).toBe(4);
  });

  it("stops as unavailable after the last retry", async () => {
    const store = memoryStore();
    const synth = fakeSynth(new Array(4).fill(null).map(() => new OverloadedError("503")));
    const summary = await runNarration(
      [target("a", ["One."])],
      options(),
      deps(store, synth.synthesize).deps,
    );
    expect(synth.calls).toHaveLength(4);
    expect(summary.stoppedBy).toBe("unavailable");
  });

  it("stops on a paid-plan error, and fails just the video on a refused request", async () => {
    const paid = await runNarration(
      [target("a", ["One."]), target("b", ["Two."])],
      options(),
      deps(memoryStore(), fakeSynth([new PaidPlanError("402")]).synthesize).deps,
    );
    expect(paid.stoppedBy).toBe("paid-plan");

    const refused = await runNarration(
      [target("a", ["One."]), target("b", ["Two."])],
      options(),
      deps(memoryStore(), fakeSynth([new SynthesisRequestError("422")]).synthesize).deps,
    );
    expect(refused.rows.map((r) => r.status)).toEqual(["failed", "saved"]);
    expect(narrationExitStatus(refused).code).toBe(1);
  });

  it("a bad key aborts the run", async () => {
    await expect(
      runNarration(
        [target("a", ["One."])],
        options(),
        deps(memoryStore(), fakeSynth([new GenerationConfigError("401")]).synthesize).deps,
      ),
    ).rejects.toBeInstanceOf(GenerationConfigError);
  });
});

describe("ElevenLabs client", () => {
  const json = (status: number, detail: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ detail }), { status, headers });

  it("sends the text, model, and format, with the key only in the xi-api-key header", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const synthesize = createElevenLabs({
      apiKey: "sk-secret",
      timeoutMs: 1000,
      fetch: async (url, init) => {
        requests.push({ url, init });
        return new Response(new Blob([fakeMp3(2).slice().buffer as ArrayBuffer]), { status: 200 });
      },
    });
    const { bytes } = await synthesize("Hello there.", VOICE);
    expect(bytes.length).toBeGreaterThan(0);
    expect(requests[0].url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-a?output_format=mp3_44100_64",
    );
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      text: "Hello there.",
      model_id: "eleven_flash_v2_5",
    });
    expect((requests[0].init.headers as Record<string, string>)["xi-api-key"]).toBe("sk-secret");
  });

  it("sends continuity context, preferring request ids over previous text, and reads the id and cost", async () => {
    const bodies: unknown[] = [];
    const synthesize = createElevenLabs({
      apiKey: "sk-secret",
      timeoutMs: 1000,
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(new Blob([fakeMp3(2).slice().buffer as ArrayBuffer]), {
          status: 200,
          headers: { "request-id": "abc123", "character-cost": "12" },
        });
      },
    });
    const result = await synthesize("Two.", VOICE, { previousText: "One.", nextText: "Three." });
    expect(result).toMatchObject({ requestId: "abc123", characterCost: 12 });
    await synthesize("Three.", VOICE, {
      previousText: "Two.",
      nextText: "Four.",
      previousRequestIds: ["r1", "r2", "r3", "r4"],
    });
    expect(bodies).toEqual([
      { text: "Two.", model_id: "eleven_flash_v2_5", previous_text: "One.", next_text: "Three." },
      {
        text: "Three.",
        model_id: "eleven_flash_v2_5",
        previous_request_ids: ["r2", "r3", "r4"],
        next_text: "Four.",
      },
    ]);
  });

  it("classifies quota, auth, plan, rate-limit, overload, and validation errors", async () => {
    expect(
      await classifyResponse(
        json(401, { status: "quota_exceeded", message: "This request exceeds your quota." }),
      ),
    ).toBeInstanceOf(QuotaExceededError);
    expect(
      await classifyResponse(json(401, { status: "invalid_api_key", message: "Invalid API key" })),
    ).toBeInstanceOf(GenerationConfigError);
    expect(
      await classifyResponse(json(402, { status: "payment_required", message: "paid plan" })),
    ).toBeInstanceOf(PaidPlanError);
    const limited = await classifyResponse(
      json(429, { status: "too_many_concurrent_requests", message: "Too many" }, { "retry-after": "3" }),
    );
    expect(limited).toBeInstanceOf(RateLimitError);
    expect((limited as RateLimitError).retryAfterMs).toBe(3000);
    expect(await classifyResponse(json(429, { status: "system_busy", message: "busy" }))).toBeInstanceOf(
      RateLimitError,
    );
    expect(await classifyResponse(new Response("oops", { status: 503 }))).toBeInstanceOf(OverloadedError);
    expect(await classifyResponse(json(422, [{ msg: "bad" }]))).toBeInstanceOf(SynthesisRequestError);
  });

  it("never puts the key in an error message", async () => {
    const synthesize = createElevenLabs({
      apiKey: "sk-secret",
      timeoutMs: 1000,
      fetch: async () => json(401, { status: "invalid_api_key", message: "Invalid API key" }),
    });
    const error = await synthesize("Hi.", VOICE).catch((e: Error) => e);
    expect(error).toBeInstanceOf(GenerationConfigError);
    expect(String((error as Error).message)).not.toContain("sk-secret");
    const offline = createElevenLabs({
      apiKey: "sk-secret",
      timeoutMs: 1000,
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(await offline("Hi.", VOICE).catch((e: Error) => e)).toBeInstanceOf(OverloadedError);
  });
});

describe("config", () => {
  it("defaults to one voice and the Flash model, and names a missing key without echoing values", () => {
    const config = readNarrationConfig({});
    expect(config.voice).toEqual({
      voiceId: DEFAULT_VOICE_ID,
      modelId: DEFAULT_MODEL_ID,
      outputFormat: "mp3_44100_64",
    });
    expect(readNarrationConfig({ ELEVENLABS_VOICE_ID: "v2" }).voice.voiceId).toBe("v2");
    expect(() => readApiKey({})).toThrow(/ELEVENLABS_API_KEY is not set/);
    expect(readApiKey({ ELEVENLABS_API_KEY: " k " })).toBe("k");
  });
});

describe("mp3 duration", () => {
  it("adds up frame lengths, skipping an ID3 tag and a Xing header frame", () => {
    expect(mp3DurationMs(fakeMp3(100))).toBe(Math.round((100 * 1152 * 1000) / 44100));
    expect(mp3DurationMs(fakeMp3(100, { id3: true, xing: true }))).toBe(
      Math.round((100 * 1152 * 1000) / 44100),
    );
    expect(() => mp3DurationMs(new Uint8Array([1, 2, 3]))).toThrow(/no audio frames/);
  });
});

describe("CLI", () => {
  const catalog: NarrationCatalog = [
    {
      ...target("two-pointers", ["a"]),
      problemKey: "two-pointers/pair-with-target-sum",
      pattern: "two-pointers",
    },
    { ...target("sorting-bubble-sort", ["b"]), problemKey: "sorting/bubble-sort", pattern: "sorting" },
    { ...target("sorting-heap-sort", ["c"]), problemKey: "sorting/heap-sort", pattern: "sorting" },
  ];

  it("takes several --storyboard flags, by storyboard id or problem key, in the order given", () => {
    const options = parseNarrationCli([
      "--storyboard",
      "sorting/heap-sort",
      "--storyboard",
      "two-pointers",
      "--storyboard",
      "sorting-heap-sort",
      "--dry-run",
    ]);
    expect(options).toMatchObject({ dryRun: true, maxChars: 9000 });
    const ids = selectNarrationTargets(options, catalog, () => true).map((t) => t.storyboardId);
    expect(ids).toEqual(["sorting-heap-sort", "two-pointers"]);
  });

  it("narrows by pattern and by what's missing, and rejects unknown names and bad budgets", () => {
    const missing = parseNarrationCli(["--missing", "--pattern", "sorting"]);
    expect(
      selectNarrationTargets(missing, catalog, (t) => t.storyboardId !== "sorting-bubble-sort").map(
        (t) => t.storyboardId,
      ),
    ).toEqual(["sorting-heap-sort"]);
    expect(() =>
      selectNarrationTargets(parseNarrationCli(["--storyboard", "nope"]), catalog, () => true),
    ).toThrow(/Unknown storyboard/);
    expect(() => parseNarrationCli([])).toThrow(/Choose what to voice/);
    expect(() => parseNarrationCli(["--missing", "--max-chars", "0"])).toThrow(/--max-chars/);
  });

  it("lists every video in the catalog once, with its problem", () => {
    const all = narrationCatalog();
    expect(new Set(all.map((t) => t.storyboardId)).size).toBe(all.length);
    expect(all.find((t) => t.storyboardId === "two-pointers")?.problemKey).toBe(
      "two-pointers/pair-with-target-sum",
    );
  });
});
