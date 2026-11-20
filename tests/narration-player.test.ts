import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import manifestJson from "@/content/narration/manifest.json";
import {
  chooseVoice,
  DRIFT_SECONDS,
  NarrationEngine,
  NUDGE,
  sentenceStarts,
  splitSentences,
  type AudioLike,
  type NarrationScene,
  type NarrationTrack,
  type PlaybackState,
  type SpeechAdapter,
  type UtteranceLike,
} from "@/lib/narration/engine";
import { narrationHash } from "@/lib/narration/hash";
import {
  currentTrack,
  narrationManifestSchema,
  withNarration,
  type NarrationManifest,
} from "@/lib/narration/manifest";
import {
  estimateDurationInFrames,
  FPS,
  getSceneTimeline,
  sceneIndexAtFrame,
  TRACK_LEAD_MS,
  trackSceneDurations,
} from "@/lib/storyboard";

// ── timing from the stitched track ──────────────────────────────────────────────────────────────────────────

const VOICE = { voiceId: "v", modelId: "m", outputFormat: "mp3_44100_64" };
// The real manifest voices this video, so start from an unvoiced copy (estimated durations, no track).
const voicedBase = storyboards.find((sb) => sb.id === "two-pointers")!;
const { narrationTrack: _, ...unvoiced } = voicedBase;
const base = {
  ...unvoiced,
  scenes: voicedBase.scenes.map((scene) => ({
    ...scene,
    durationInFrames: estimateDurationInFrames(scene.narration),
  })),
};

/** A manifest whose track gives every scene `speechMs` of speech with 600 ms pauses. */
function manifestFor(scenes: { id: string; narration: string }[], speechMs: number): NarrationManifest {
  const startsMs = scenes.map((_, i) => TRACK_LEAD_MS + i * (speechMs + 600));
  return {
    version: 2,
    storyboards: {
      [base.id]: {
        clips: Object.fromEntries(
          scenes.map((s) => [
            s.id,
            {
              hash: narrationHash(s.narration, VOICE),
              file: `${base.id}/${s.id}-0a.mp3`,
              durationMs: speechMs + 40,
              chars: s.narration.length,
              ...VOICE,
            },
          ]),
        ),
        track: {
          hash: "t",
          file: `/audio/${base.id}/narration-t.mp3`,
          durationMs: startsMs.at(-1)! + speechMs + 600,
          scenes: scenes.map((s, i) => ({
            id: s.id,
            hash: narrationHash(s.narration, VOICE),
            startMs: startsMs[i],
            speechMs,
          })),
        },
      },
    },
  };
}

describe("scene timing from the stitched track", () => {
  it("every scene's narration starts exactly where its speech starts in the track", () => {
    const manifest = manifestFor(base.scenes, 7_000);
    const sb = withNarration(base, manifest);
    const track = manifest.storyboards[base.id].track!;
    expect(sb.narrationTrack).toEqual({
      src: track.file,
      durationMs: track.durationMs,
      sceneStartsMs: track.scenes.map((s) => s.startMs),
    });
    const { timings, durationInFrames } = getSceneTimeline(sb.scenes);
    track.scenes.forEach((s, i) =>
      expect(timings[i].narrationStart).toBe(Math.round((s.startMs * FPS) / 1000)),
    );
    expect(durationInFrames).toBe(Math.round((track.durationMs * FPS) / 1000));
    // Narration starts once the scene is current, and scene jumps land on it.
    for (let i = 1; i < timings.length; i++) {
      expect(sceneIndexAtFrame(timings, timings[i].narrationStart)).toBe(i);
      expect(timings[i].seekFrame).toBe(timings[i].narrationStart);
    }
  });

  it("trackSceneDurations lines scene starts up with any offsets", () => {
    const starts = [TRACK_LEAD_MS, 4_123, 9_871, 15_002];
    const durations = trackSceneDurations(starts, 20_000);
    const { timings } = getSceneTimeline(durations.map((d, i) => ({ id: `s${i}`, durationInFrames: d })));
    starts.forEach((ms, i) => expect(timings[i].narrationStart).toBe(Math.round((ms * FPS) / 1000)));
  });

  it("a video whose narration changed anywhere since stitching is read by the browser voice", () => {
    const manifest = manifestFor(base.scenes, 5_000);
    expect(currentTrack(manifest, base)).toBeDefined();
    const edited = { ...base.scenes[3], narration: `${base.scenes[3].narration} Edited.` };
    const changed = { ...base, scenes: base.scenes.map((s, i) => (i === 3 ? edited : s)) };
    expect(currentTrack(manifest, changed)).toBeUndefined();
    const sb = withNarration(changed, manifest);
    expect(sb.narrationTrack).toBeUndefined();
    expect(sb.scenes.map((s) => s.durationInFrames)).toEqual(changed.scenes.map((s) => s.durationInFrames));
    // Reordered or missing scenes don't match either.
    expect(currentTrack(manifest, { ...base, scenes: [...base.scenes].reverse() })).toBeUndefined();
    expect(currentTrack(manifest, { ...base, scenes: base.scenes.slice(1) })).toBeUndefined();
  });

  it("every committed track exists, covers its video's current narration, and its clips are kept", () => {
    const manifest = narrationManifestSchema.parse(manifestJson);
    let voiced = 0;
    for (const sb of storyboards) {
      const entry = manifest.storyboards[sb.id];
      if (!entry) continue;
      voiced++;
      expect(sb.narrationTrack, sb.id).toBeDefined();
      expect(existsSync(`public${entry.track!.file}`), entry.track!.file).toBe(true);
      for (const clip of Object.values(entry.clips))
        expect(existsSync(`narration/clips/${clip.file}`), clip.file).toBe(true);
      const { timings } = getSceneTimeline(sb.scenes);
      entry.track!.scenes.forEach((s, i) =>
        expect(timings[i].narrationStart).toBe(Math.round((s.startMs * FPS) / 1000)),
      );
    }
    expect(voiced).toBeGreaterThanOrEqual(18);
  });
});

// ── choosing a voice ────────────────────────────────────────────────────────────────────────────────────────

describe("chooseVoice", () => {
  it("prefers the ElevenLabs track, then the browser voice, else silent", () => {
    expect(chooseVoice(true, true)).toBe("elevenlabs");
    expect(chooseVoice(true, false)).toBe("elevenlabs");
    expect(chooseVoice(false, true)).toBe("browser");
    expect(chooseVoice(false, false)).toBe("silent");
  });
});

// ── the engine, with mocked audio and speech ────────────────────────────────────────────────────────────────

/** An audio element that records every source change, seek, play, and pause. */
class FakeAudio implements AudioLike {
  private _src = "";
  private _time = 0;
  srcSets = 0;
  seeks: number[] = [];
  playbackRate = 1;
  preservesPitch = false;
  volume = 1;
  muted = false;
  paused = true;
  seeking = false;
  readyState = 4;
  plays = 0;
  pauses = 0;
  refuse = false;
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    this.srcSets++;
  }
  get currentTime() {
    return this._time;
  }
  set currentTime(v: number) {
    this._time = v;
    this.seeks.push(v);
  }
  async play() {
    this.plays++;
    if (this.refuse) throw new Error("NotAllowedError");
    this.paused = false;
  }
  pause() {
    this.paused = true;
    this.pauses++;
  }
  /** Let the track run on its own for `seconds` at its rate (what a real element does between frame updates). */
  advance(seconds: number) {
    if (!this.paused) this._time += seconds * this.playbackRate;
  }
}

class FakeSpeech implements SpeechAdapter {
  queue: UtteranceLike[] = [];
  spoken: { text: string; rate: number; volume: number }[] = [];
  cancels = 0;
  createUtterance(text: string): UtteranceLike {
    return { text, rate: 1, volume: 1, onstart: null, onend: null, onerror: null };
  }
  speak(u: UtteranceLike) {
    this.queue.push(u);
    if (this.queue.length === 1) this.start();
  }
  cancel() {
    this.cancels++;
    const dropped = this.queue;
    this.queue = [];
    // Chrome fires "error" on cancelled utterances; the engine must ignore them.
    dropped.forEach((u) => u.onerror?.());
  }
  private start() {
    const u = this.queue[0];
    if (!u) return;
    this.spoken.push({ text: u.text, rate: u.rate, volume: u.volume });
    u.onstart?.();
  }
  /** The current sentence finishes. */
  finish() {
    const u = this.queue.shift();
    u?.onend?.();
    this.start();
  }
  get speaking() {
    return this.queue.length > 0;
  }
}

const scenes: (NarrationScene & { id: string })[] = [
  "Scene one is read.",
  "Scene two is read too.",
  "First sentence here. Second sentence follows. Third one ends it.",
  "The last scene.",
].map((narration, i) => ({ id: `s${i}`, narration, durationInFrames: estimateDurationInFrames(narration) }));
const { timings, durationInFrames: TOTAL_FRAMES } = getSceneTimeline(scenes);
const TRACK: NarrationTrack = { src: "/audio/x/narration-1.mp3", durationMs: (TOTAL_FRAMES / FPS) * 1000 };

function setup({ speech = true, track = false } = {}) {
  const audio = new FakeAudio();
  const fakeSpeech = speech ? new FakeSpeech() : null;
  const events: string[] = [];
  let timers: (() => void)[] = [];
  const engine = new NarrationEngine({
    scenes,
    timings,
    fps: FPS,
    track: track ? TRACK : null,
    createAudio: () => audio,
    speech: fakeSpeech,
    onHold: (frame) => events.push(`hold@${frame}`),
    onRelease: () => events.push("release"),
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => undefined,
  });
  const state = (frame: number, overrides: Partial<PlaybackState> = {}): PlaybackState => ({
    frame,
    playing: true,
    holding: false,
    rate: 1,
    volume: 1,
    muted: false,
    ...overrides,
  });
  /** Run the timers that are due (the start-up wait polls on a timer). */
  const tick = () => {
    const due = timers;
    timers = [];
    due.forEach((fire) => fire());
  };
  return { engine, audio, speech: fakeSpeech, events, state, tick, pending: () => timers.length };
}

/** Press play at `frame`: the track starts there and the video waits for it, then goes. */
async function start(t: ReturnType<typeof setup>, frame: number, overrides: Partial<PlaybackState> = {}) {
  t.engine.update(t.state(frame, overrides));
  await Promise.resolve();
  t.tick();
}

describe("NarrationEngine with the stitched ElevenLabs track", () => {
  it("stays silent until play, then sets the source once and starts where the video is", async () => {
    const t = setup({ track: true });
    t.engine.update(t.state(0, { playing: false }));
    expect(t.audio.plays).toBe(0);
    const f = 45;
    await start(t, f);
    expect(t.audio.src).toBe(TRACK.src);
    expect(t.audio.srcSets).toBe(1);
    expect(t.audio.seeks).toEqual([f / FPS]);
    expect(t.audio.paused).toBe(false);
    expect(t.audio.preservesPitch).toBe(true);
    // The video waited on its frame until the audio was playing, then went.
    expect(t.events).toEqual([`hold@${f}`, "release"]);
  });

  it("plays straight through every scene boundary: no new source, no pause, no seek", async () => {
    const t = setup({ track: true });
    await start(t, 0);
    t.events.length = 0;
    const seeks = t.audio.seeks.length;
    // Every frame of the video, the audio running on its own between updates.
    for (let frame = 1; frame < TOTAL_FRAMES - 1; frame++) {
      t.audio.advance(1 / FPS);
      t.engine.update(t.state(frame));
    }
    expect(t.audio.srcSets).toBe(1);
    expect(t.audio.pauses).toBe(0);
    expect(t.audio.seeks.length).toBe(seeks);
    expect(t.audio.playbackRate).toBe(1);
    expect(t.events).toEqual([]);
    expect(timings.length).toBeGreaterThan(3); // it crossed every boundary
  });

  it("a seek or scene jump moves the one track and waits for it, never re-sourcing it", async () => {
    const t = setup({ track: true });
    await start(t, 30);
    t.events.length = 0;
    for (const frame of [timings[2].seekFrame, 200, timings[1].seekFrame]) {
      t.audio.seeking = true;
      t.engine.update(t.state(frame), true);
      expect(t.audio.currentTime).toBeCloseTo(frame / FPS);
      expect(t.events.at(-1)).toBe(`hold@${frame}`);
      t.tick(); // still seeking: keeps waiting
      expect(t.events.at(-1)).toBe(`hold@${frame}`);
      t.audio.seeking = false;
      t.tick();
      expect(t.events.at(-1)).toBe("release");
    }
    expect(t.audio.srcSets).toBe(1);
    expect(t.audio.paused).toBe(false);
  });

  it("pauses in place and resumes from the video's frame", async () => {
    const t = setup({ track: true });
    await start(t, 60);
    t.audio.advance(1);
    t.engine.update(t.state(90, { playing: false }));
    expect(t.audio.paused).toBe(true);
    await start(t, 90);
    expect(t.audio.paused).toBe(false);
    expect(t.audio.currentTime).toBeCloseTo(90 / FPS);
    expect(t.audio.srcSets).toBe(1);
  });

  it("follows 0.5× and 2× with pitch preserved, staying in sync", async () => {
    const t = setup({ track: true });
    let frame = 30;
    await start(t, frame);
    for (const rate of [2, 0.5, 1.5]) {
      // The speed control changes the player and the narration together.
      t.engine.update(t.state(Math.round(frame), { rate }));
      for (let k = 0; k < 10; k++) {
        t.audio.advance(0.1);
        frame += 0.1 * rate * FPS;
        t.engine.update(t.state(Math.round(frame), { rate }));
        expect(Math.abs(t.audio.playbackRate / rate - 1)).toBeLessThanOrEqual(NUDGE + 1e-9);
        expect(t.audio.preservesPitch).toBe(true);
        expect(Math.abs(t.audio.currentTime - Math.round(frame) / FPS)).toBeLessThan(0.05);
      }
    }
  });

  it("closes small drift by a gentle speed nudge, never by seeking", async () => {
    const t = setup({ track: true });
    let frame = 30;
    await start(t, frame);
    t.audio.advance(-0.2); // the element fell 0.2 s behind
    const seeks = t.audio.seeks.length;
    for (let k = 0; k < 120; k++) {
      t.audio.advance(0.1);
      frame += 0.1 * FPS;
      t.engine.update(t.state(Math.round(frame)));
      expect(t.audio.playbackRate).toBeLessThanOrEqual(1 + NUDGE + 1e-9);
    }
    expect(t.audio.seeks.length).toBe(seeks);
    expect(Math.abs(t.audio.currentTime - Math.round(frame) / FPS)).toBeLessThan(0.05);
    expect(t.audio.playbackRate).toBe(1);
  });

  it("resets a large drift (a background tab) and a buffering stall by waiting, not racing", async () => {
    const t = setup({ track: true });
    await start(t, 30);
    t.events.length = 0;
    t.engine.update(t.state(30 + Math.ceil((DRIFT_SECONDS + 0.5) * FPS)));
    expect(t.audio.currentTime).toBeCloseTo((30 + Math.ceil((DRIFT_SECONDS + 0.5) * FPS)) / FPS);
    expect(t.events.at(-1)).toMatch(/^hold@/);
    t.tick();
    expect(t.events.at(-1)).toBe("release");
    t.audio.readyState = 2; // the network can't keep up
    t.engine.update(t.state(120));
    expect(t.events.at(-1)).toBe("hold@120");
    t.tick();
    expect(t.events.at(-1)).toBe("hold@120");
    t.audio.readyState = 4;
    t.tick();
    expect(t.events.at(-1)).toBe("release");
  });

  it("stops waiting after a few seconds if the audio never starts", async () => {
    const t = setup({ track: true });
    t.audio.readyState = 1;
    t.engine.update(t.state(30));
    for (let k = 0; k < 200 && t.pending(); k++) t.tick();
    expect(t.events).toEqual(["hold@30", "release"]);
  });

  it("an autoplay refusal lets the video go on silently, without retrying every frame", async () => {
    const t = setup({ track: true });
    t.audio.refuse = true;
    t.engine.update(t.state(30));
    await Promise.resolve();
    await Promise.resolve();
    expect(t.events).toEqual(["hold@30", "release"]);
    for (let f = 31; f < 60; f++) t.engine.update(t.state(f));
    expect(t.audio.plays).toBe(1);
  });

  it("applies mute and volume, and lets the track end on its own", async () => {
    const t = setup({ track: true });
    await start(t, 30, { volume: 0.4, muted: true });
    expect(t.audio.volume).toBe(0.4);
    expect(t.audio.muted).toBe(true);
    const pauses = t.audio.pauses;
    const plays = t.audio.plays;
    // The track finished (the element pauses itself) while the video shows its last frames: never restarted.
    t.audio.paused = true;
    for (let f = TOTAL_FRAMES - 6; f <= TOTAL_FRAMES + 5; f++) t.engine.update(t.state(f));
    expect(t.audio.pauses).toBe(pauses);
    expect(t.audio.plays).toBe(plays);
  });
});

describe("NarrationEngine with the browser voice", () => {
  const scene = 2;
  const sentences = splitSentences(scenes[scene].narration);

  it("splits narration into sentences with estimated start times", () => {
    expect(sentences).toEqual(["First sentence here.", "Second sentence follows.", "Third one ends it."]);
    expect(sentenceStarts(sentences)).toEqual([0, 3 / 2.5, 6 / 2.5]);
  });

  it("reads the scene from the start, at the playback speed", () => {
    const { engine, speech, state } = setup();
    engine.update(state(timings[scene].narrationStart, { rate: 1.5 }));
    expect(speech!.spoken).toEqual([{ text: sentences[0], rate: 1.5, volume: 1 }]);
    expect(speech!.queue.map((u) => u.text)).toEqual(sentences);
  });

  it("a seek restarts from the sentence at that point", () => {
    const { engine, speech, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    const into = timings[scene].narrationStart + Math.ceil(1.5 * FPS); // inside the second sentence (1.2s–2.4s)
    engine.update(state(into), true);
    expect(speech!.spoken.at(-1)?.text).toBe(sentences[1]);
    expect(speech!.queue.map((u) => u.text)).toEqual(sentences.slice(1));
  });

  it("pause stops the voice; play picks up the sentence it was on", () => {
    const { engine, speech, state } = setup();
    const f = timings[scene].narrationStart;
    engine.update(state(f));
    speech!.finish(); // first sentence done, second starts
    engine.update(state(f + 40, { playing: false }));
    expect(speech!.speaking).toBe(false);
    engine.update(state(f + 40));
    expect(speech!.spoken.at(-1)?.text).toBe(sentences[1]);
  });

  it("a speed change restarts the current sentence at the new rate", () => {
    const { engine, speech, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[scene].narrationStart + 5, { rate: 2 }));
    expect(speech!.spoken.at(-1)).toEqual({ text: sentences[0], rate: 2, volume: 1 });
  });

  it("holds the video at the scene's end until the voice finishes, then releases it", () => {
    const { engine, speech, events, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    const holdFrame = timings[scene].endFrame - 2;
    engine.update(state(holdFrame));
    expect(events).toEqual([`hold@${holdFrame}`]);
    // The player pauses for the hold: that pause must not stop the voice.
    engine.update(state(holdFrame, { playing: false, holding: true }));
    expect(speech!.speaking).toBe(true);
    speech!.finish();
    speech!.finish();
    expect(events).toEqual([`hold@${holdFrame}`]);
    speech!.finish();
    expect(events).toEqual([`hold@${holdFrame}`, "release"]);
  });

  it("never holds once the scene has been read, and doesn't re-read it after pause/resume", () => {
    const { engine, speech, events, state } = setup();
    const f = timings[scene].narrationStart;
    engine.update(state(f));
    speech!.finish();
    speech!.finish();
    speech!.finish();
    const spoken = speech!.spoken.length;
    engine.update(state(f + 60, { playing: false }));
    engine.update(state(f + 60));
    engine.update(state(timings[scene].endFrame - 1));
    expect(events).toEqual([]);
    expect(speech!.spoken).toHaveLength(spoken);
  });

  it("a hold that never hears back from the voice gives up", () => {
    const { engine, events, tick, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[scene].endFrame - 2));
    tick();
    expect(events.at(-1)).toBe("release");
  });

  it("muting stops the voice without holding the video", () => {
    const { engine, speech, events, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[scene].narrationStart + 10, { muted: true }));
    expect(speech!.speaking).toBe(false);
    engine.update(state(timings[scene].endFrame - 2, { muted: true }));
    expect(events).toEqual([]);
  });

  it("never cancels speech at a scene boundary: crossing it while speaking holds the video instead", () => {
    const { engine, speech, events, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    // A fast frame skips the hold point and lands in the next scene while the voice is mid-sentence.
    engine.update(state(timings[scene + 1].narrationStart + 2));
    expect(speech!.cancels).toBe(0);
    expect(speech!.speaking).toBe(true);
    expect(events).toEqual([`hold@${timings[scene].endFrame - 2}`]);
    speech!.finish();
    speech!.finish();
    speech!.finish();
    expect(events.at(-1)).toBe("release");
    expect(speech!.cancels).toBe(0);
  });

  it("only a seek or scene jump interrupts speech", () => {
    const { engine, speech, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[0].seekFrame + 10), true);
    expect(speech!.cancels).toBe(1);
    expect(speech!.spoken.at(-1)?.text).toBe(scenes[0].narration);
  });
});

describe("NarrationEngine without speech synthesis", () => {
  it("plays a video without a track silently, and never holds it", () => {
    const { engine, audio, events, state } = setup({ speech: false });
    expect(engine.voice).toBe("silent");
    engine.update(state(timings[2].narrationStart));
    engine.update(state(timings[2].endFrame - 1));
    expect(events).toEqual([]);
    expect(audio.plays).toBe(0);
  });
});
