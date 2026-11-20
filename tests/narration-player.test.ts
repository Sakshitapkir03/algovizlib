import { describe, expect, it } from "vitest";

import { storyboards } from "@/content/storyboards";
import {
  chooseVoice,
  DRIFT_SECONDS,
  NarrationEngine,
  sentenceStarts,
  splitSentences,
  type AudioLike,
  type NarrationScene,
  type PlaybackState,
  type SpeechAdapter,
  type UtteranceLike,
} from "@/lib/narration/engine";
import { narrationHash } from "@/lib/narration/hash";
import { currentAudio, withNarration, type NarrationManifest } from "@/lib/narration/manifest";
import {
  estimateDurationInFrames,
  FPS,
  getSceneTimeline,
  NARRATION_LEAD_FRAMES,
  NARRATION_PAUSE_SECONDS,
  narrationDurationInFrames,
  sceneIndexAtFrame,
} from "@/lib/storyboard";

// ── timing from audio ───────────────────────────────────────────────────────────────────────────────────────

const VOICE = { voiceId: "v", modelId: "m", outputFormat: "mp3_44100_64" };
const base = storyboards.find((sb) => sb.id === "two-pointers")!;

function manifestFor(scenes: { id: string; narration: string }[], durationMs: number): NarrationManifest {
  return {
    version: 1,
    storyboards: {
      [base.id]: Object.fromEntries(
        scenes.map((s) => [
          s.id,
          {
            hash: narrationHash(s.narration, VOICE),
            file: `/audio/${base.id}/${s.id}.mp3`,
            durationMs,
            chars: s.narration.length,
            ...VOICE,
          },
        ]),
      ),
    },
  };
}

describe("scene timing from the manifest", () => {
  it("a voiced scene lasts lead-in + its clip + a short pause; others keep the estimate", () => {
    const voiced = base.scenes.slice(0, 2);
    const sb = withNarration(base, manifestFor(voiced, 8_000));
    const expected = NARRATION_LEAD_FRAMES + Math.ceil((8 + NARRATION_PAUSE_SECONDS) * FPS);
    expect(narrationDurationInFrames(8_000)).toBe(expected);
    expect(sb.scenes[0]).toMatchObject({
      durationInFrames: expected,
      audio: { src: `/audio/${base.id}/${voiced[0].id}.mp3` },
    });
    expect(sb.scenes[1].durationInFrames).toBe(expected);
    expect(sb.scenes[2].audio).toBeUndefined();
    expect(sb.scenes[2].durationInFrames).toBe(base.scenes[2].durationInFrames);
    expect(sb.scenes[2].durationInFrames).toBe(estimateDurationInFrames(base.scenes[2].narration));
  });

  it("ignores audio whose narration was edited since it was voiced", () => {
    const manifest = manifestFor(base.scenes, 5_000);
    const edited = { ...base.scenes[0], narration: `${base.scenes[0].narration} Edited.` };
    expect(currentAudio(manifest, base.id, base.scenes[0])).toBeDefined();
    expect(currentAudio(manifest, base.id, edited)).toBeUndefined();
    const sb = withNarration({ ...base, scenes: [edited, ...base.scenes.slice(1)] }, manifest);
    expect(sb.scenes[0].audio).toBeUndefined();
    expect(sb.scenes[1].audio).toBeDefined();
  });

  it("a clip never overlaps the next scene's: the pause outlasts the cross-fade", () => {
    const sb = withNarration(base, manifestFor(base.scenes, 6_000));
    const { timings } = getSceneTimeline(sb.scenes);
    for (let i = 0; i + 1 < timings.length; i++) {
      const clipEnd = timings[i].narrationStart + 6 * FPS;
      expect(clipEnd).toBeLessThan(timings[i + 1].narrationStart);
      // Narration starts once the scene is current, and scene jumps land on it.
      expect(sceneIndexAtFrame(timings, timings[i + 1].narrationStart)).toBe(i + 1);
      expect(timings[i + 1].seekFrame).toBe(timings[i + 1].narrationStart);
    }
  });

  it("the committed manifest only references current narration", () => {
    for (const sb of storyboards)
      for (const scene of sb.scenes) if (scene.audio) expect(scene.audio.src).toMatch(/^\/audio\//);
  });
});

// ── choosing a voice ────────────────────────────────────────────────────────────────────────────────────────

describe("chooseVoice", () => {
  it("prefers ElevenLabs audio, then the browser voice, else silent", () => {
    expect(chooseVoice({ audio: { src: "/audio/a.mp3", durationMs: 1000 } }, true)).toBe("elevenlabs");
    expect(chooseVoice({ audio: { src: "/audio/a.mp3", durationMs: 1000 } }, false)).toBe("elevenlabs");
    expect(chooseVoice({}, true)).toBe("browser");
    expect(chooseVoice({}, false)).toBe("silent");
  });
});

// ── the engine, with mocked audio and speech ────────────────────────────────────────────────────────────────

class FakeAudio implements AudioLike {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = false;
  volume = 1;
  muted = false;
  paused = true;
  plays = 0;
  async play() {
    this.paused = false;
    this.plays++;
  }
  pause() {
    this.paused = true;
  }
  /** Let the clip run on its own for `seconds` at its rate (what a real element does between frame updates). */
  advance(seconds: number) {
    if (!this.paused) this.currentTime += seconds * this.playbackRate;
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

const CLIP_MS = 4_000;
const scenes: (NarrationScene & { id: string })[] = [
  {
    id: "one",
    narration: "Scene one is voiced.",
    durationInFrames: narrationDurationInFrames(CLIP_MS),
    audio: { src: "/a1.mp3", durationMs: CLIP_MS },
  },
  {
    id: "two",
    narration: "Scene two is voiced too.",
    durationInFrames: narrationDurationInFrames(CLIP_MS),
    audio: { src: "/a2.mp3", durationMs: CLIP_MS },
  },
  {
    id: "three",
    narration: "First sentence here. Second sentence follows. Third one ends it.",
    durationInFrames: estimateDurationInFrames(
      "First sentence here. Second sentence follows. Third one ends it.",
    ),
  },
  { id: "four", narration: "The last scene.", durationInFrames: estimateDurationInFrames("The last scene.") },
];
const { timings } = getSceneTimeline(scenes);

function setup({ speech = true } = {}) {
  const audio = new FakeAudio();
  const fakeSpeech = speech ? new FakeSpeech() : null;
  const events: string[] = [];
  const timers: (() => void)[] = [];
  const engine = new NarrationEngine({
    scenes,
    timings,
    fps: FPS,
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
  return { engine, audio, speech: fakeSpeech, events, timers, state };
}

/** Where scene `i`'s clip should be at `frame`. */
const offsetAt = (i: number, frame: number) => (frame - timings[i].narrationStart) / FPS;

describe("NarrationEngine with ElevenLabs audio", () => {
  it("stays silent until play, then starts the clip after the lead-in", () => {
    const { engine, audio, state } = setup();
    engine.update(state(0, { playing: false }));
    expect(audio.plays).toBe(0);
    engine.update(state(2));
    expect(audio.paused).toBe(true); // still in the lead-in
    engine.update(state(timings[0].narrationStart + 3));
    expect(audio.paused).toBe(false);
    expect(audio.src).toBe("/a1.mp3");
    expect(audio.currentTime).toBeCloseTo(3 / FPS);
    expect(audio.preservesPitch).toBe(true);
  });

  it("realigns after a seek and a scene jump", () => {
    const { engine, audio, state } = setup();
    const f = timings[0].narrationStart + 30;
    engine.update(state(f));
    // Seek within the scene.
    const seekTo = timings[0].narrationStart + 75;
    engine.update(state(seekTo), true);
    expect(audio.currentTime).toBeCloseTo(offsetAt(0, seekTo));
    // Jump to the next scene: its clip, from its start.
    engine.update(state(timings[1].seekFrame), true);
    expect(audio.src).toBe("/a2.mp3");
    expect(audio.currentTime).toBeCloseTo(0);
    expect(audio.paused).toBe(false);
  });

  it("pauses and resumes in place", () => {
    const { engine, audio, state } = setup();
    const f = timings[0].narrationStart + 45;
    engine.update(state(f));
    audio.advance(0.1);
    engine.update(state(f + 3, { playing: false }));
    expect(audio.paused).toBe(true);
    const at = audio.currentTime;
    engine.update(state(f + 3));
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBeCloseTo(at); // within tolerance: not restarted
  });

  it("follows speed changes with pitch preserved and stays within the drift tolerance", () => {
    const { engine, audio, state } = setup();
    let frame = timings[0].narrationStart;
    engine.update(state(frame));
    for (const rate of [2, 0.5, 1.5]) {
      // One simulated second of wall time at this rate: the clip and the video both advance `rate` seconds.
      for (let k = 0; k < 10; k++) {
        audio.advance(0.1);
        frame += 0.1 * rate * FPS;
        engine.update(state(Math.round(frame), { rate }));
        expect(audio.playbackRate).toBe(rate);
        expect(audio.preservesPitch).toBe(true);
        expect(Math.abs(audio.currentTime - offsetAt(0, Math.round(frame)))).toBeLessThanOrEqual(
          DRIFT_SECONDS,
        );
      }
    }
  });

  it("corrects drift beyond the tolerance (e.g. the clip stalled while buffering)", () => {
    const { engine, audio, state } = setup();
    const f = timings[0].narrationStart + 15;
    engine.update(state(f));
    audio.currentTime = 0; // stalled
    engine.update(state(f + 30));
    expect(audio.currentTime).toBeCloseTo(offsetAt(0, f + 30));
  });

  it("goes quiet in the pause after the clip, and mute/volume apply to the clip", () => {
    const { engine, audio, state } = setup();
    engine.update(state(timings[0].narrationStart + 10, { volume: 0.4, muted: true }));
    expect(audio.volume).toBe(0.4);
    expect(audio.muted).toBe(true);
    engine.update(state(timings[0].narrationStart + (CLIP_MS / 1000) * FPS + 2));
    expect(audio.paused).toBe(true);
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
    const { engine, events, timers, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[scene].endFrame - 2));
    timers.forEach((fire) => fire());
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

  it("switching to a voiced scene stops the browser voice and plays the clip", () => {
    const { engine, speech, audio, state } = setup();
    engine.update(state(timings[scene].narrationStart));
    engine.update(state(timings[0].seekFrame + 10), true);
    expect(speech!.speaking).toBe(false);
    expect(audio.src).toBe("/a1.mp3");
  });
});

describe("NarrationEngine without speech synthesis", () => {
  it("plays unvoiced scenes silently and voiced ones from their clips", () => {
    const { engine, audio, events, state } = setup({ speech: false });
    expect(engine.voiceAt(timings[2].narrationStart)).toBe("silent");
    expect(engine.voiceAt(timings[0].narrationStart)).toBe("elevenlabs");
    engine.update(state(timings[2].narrationStart));
    engine.update(state(timings[2].endFrame - 1));
    expect(events).toEqual([]);
    expect(audio.plays).toBe(0);
  });
});
