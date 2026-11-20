import { countWords, sceneIndexAtFrame, type SceneTiming } from "@/lib/storyboard/timing";

/**
 * Keeps narration in step with the video. The Player is the clock: every frame update, seek, play/pause, speed or
 * volume change calls `update()`, and the engine makes the voice match.
 *
 * - **ElevenLabs** (a scene with `audio`): one audio element plays the scene's clip from `narrationStart`. Its
 *   position is set from the frame on a seek or scene change and corrected whenever it drifts by more than
 *   `DRIFT_SECONDS`; speed changes set `playbackRate` with `preservesPitch`, so 0.5×–2× keep a natural voice.
 * - **Browser voice** (no audio, Web Speech API available): the scene's narration is spoken sentence by sentence.
 *   A seek restarts from the sentence at that point (estimated from the narration pace); pause/resume and speed
 *   changes restart the sentence being spoken. The browser's pace varies, so if it's still speaking when the scene
 *   ends, the engine asks the player to wait there (`onHold`) and resumes it when the voice finishes.
 * - **Silent**: neither is available; the video plays with captions and the transcript.
 *
 * Nothing sounds until the viewer presses play, which keeps it within browser autoplay rules.
 */

export type VoiceKind = "elevenlabs" | "browser" | "silent";

/** Which voice reads a scene. */
export function chooseVoice(scene: { audio?: unknown }, speechAvailable: boolean): VoiceKind {
  if (scene.audio) return "elevenlabs";
  return speechAvailable ? "browser" : "silent";
}

/** The subset of HTMLAudioElement the engine uses (mocked in tests). */
export interface AudioLike {
  src: string;
  currentTime: number;
  playbackRate: number;
  preservesPitch: boolean;
  volume: number;
  muted: boolean;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** The subset of SpeechSynthesisUtterance the engine uses. */
export interface UtteranceLike {
  text: string;
  rate: number;
  volume: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/** speechSynthesis plus an utterance factory (which also picks the voice). */
export type SpeechAdapter = {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  createUtterance(text: string): UtteranceLike;
};

export type NarrationScene = {
  narration: string;
  durationInFrames: number;
  audio?: { src: string; durationMs: number };
};

export type PlaybackState = {
  frame: number;
  /** The player is playing. */
  playing: boolean;
  /** The player is paused only because it's waiting for the browser voice (counts as playing). */
  holding: boolean;
  rate: number;
  volume: number;
  muted: boolean;
};

export type NarrationEngineOptions = {
  scenes: readonly NarrationScene[];
  timings: readonly SceneTiming[];
  fps: number;
  /** Created lazily, on the first voiced scene. */
  createAudio: () => AudioLike;
  /** `null` when the browser has no speech synthesis (or no voices). */
  speech: SpeechAdapter | null;
  /** Pause the player at `frame` until the browser voice finishes. */
  onHold: (frame: number) => void;
  /** The voice finished: resume the player. */
  onRelease: () => void;
  /** Timers, injectable for tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/** Correct the clip's position when it's this far from where the frame says it should be. */
export const DRIFT_SECONDS = 0.3;
/** Pace the sentence estimate assumes (the same ~150 wpm as `estimateDurationInFrames`). */
const WORDS_PER_SECOND = 2.5;
/** Never hold longer than this per sentence still to speak (a voice that never reports "end"). */
const HOLD_SECONDS_PER_SENTENCE = 12;

/** "First sentence. Second one!" → ["First sentence.", "Second one!"] */
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Where each sentence starts, in seconds from the scene's narration start, at the estimated pace. */
export function sentenceStarts(sentences: readonly string[]): number[] {
  let words = 0;
  return sentences.map((sentence) => {
    const start = words / WORDS_PER_SECOND;
    words += countWords(sentence);
    return start;
  });
}

type SpeechSession = {
  scene: number;
  sentences: string[];
  /** The sentence being spoken (or about to be). */
  current: number;
  rate: number;
  done: boolean;
};

export class NarrationEngine {
  private audio: AudioLike | null = null;
  private audioScene = -1;
  private session: SpeechSession | null = null;
  /** Where a paused browser voice picks up: the sentence it was speaking. */
  private resumeAt: { scene: number; sentence: number } | null = null;
  private holdRequested = false;
  private holdTimer: unknown = null;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(private readonly options: NarrationEngineOptions) {
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** The voice for the scene at `frame`. */
  voiceAt(frame: number): VoiceKind {
    const scene = this.options.scenes[sceneIndexAtFrame(this.options.timings, frame)];
    return chooseVoice(scene, this.options.speech !== null);
  }

  /** Bring the voice in line with the player. `seeked`: the frame jumped (scrub, scene jump, keyboard seek). */
  update(state: PlaybackState, seeked = false): void {
    const { scenes, timings } = this.options;
    const index = sceneIndexAtFrame(timings, state.frame);
    const kind = chooseVoice(scenes[index], this.options.speech !== null);
    const playing = state.playing || state.holding;

    if (seeked) {
      this.resumeAt = null;
      this.stopSpeech();
    }
    this.syncAudio(kind === "elevenlabs" && playing ? index : -1, state, seeked);
    if (kind === "browser" || this.session) this.syncSpeech(index, kind, playing, state);
  }

  dispose(): void {
    this.audio?.pause();
    this.stopSpeech();
    this.resumeAt = null;
  }

  // ── ElevenLabs clip ───────────────────────────────────────────────────────────────────────────────────────────

  private syncAudio(index: number, state: PlaybackState, seeked: boolean) {
    if (index < 0) {
      if (this.audio && !this.audio.paused) this.audio.pause();
      return;
    }
    const { scenes, timings, fps } = this.options;
    const clip = scenes[index].audio!;
    const offset = (state.frame - timings[index].narrationStart) / fps;
    const audio = (this.audio ??= this.options.createAudio());
    audio.volume = state.volume;
    audio.muted = state.muted;
    audio.preservesPitch = true;
    audio.playbackRate = state.rate;
    if (offset < 0 || offset >= clip.durationMs / 1000) {
      // Before the lead-in ends, or in the pause after the clip.
      if (!audio.paused) audio.pause();
      return;
    }
    if (this.audioScene !== index) {
      audio.src = clip.src;
      this.audioScene = index;
      audio.currentTime = offset;
    } else if (seeked || Math.abs(audio.currentTime - offset) > DRIFT_SECONDS) {
      audio.currentTime = offset;
    }
    if (audio.paused) audio.play().catch(() => undefined); // autoplay refusals stay silent
  }

  // ── Browser voice ─────────────────────────────────────────────────────────────────────────────────────────────

  private syncSpeech(index: number, kind: VoiceKind, playing: boolean, state: PlaybackState) {
    const speech = this.options.speech;
    if (!speech) return;
    const session = this.session;

    if (!playing || state.muted || state.volume === 0) {
      // Paused: remember where the voice was, so play picks up that sentence (or stays quiet if the scene was
      // read). Muted: the video keeps going, so unmuting starts from wherever the video is by then.
      if (session && !playing)
        this.resumeAt = {
          scene: session.scene,
          sentence: session.done ? session.sentences.length : session.current,
        };
      this.stopSpeech();
      return;
    }

    if (session && session.scene !== index) {
      // The video moved on while the voice is still going: it never cuts a sentence off (we hold), so this is a
      // jump. Start over in the new scene.
      if (!session.done) this.stopSpeech();
      else this.session = null;
    } else if (session && !session.done) {
      if (session.rate !== state.rate) this.restartSpeech(session.scene, session.current, state);
      else this.maybeHold(session, state);
      return;
    } else if (session?.done) {
      return; // this scene has been read
    }

    if (kind !== "browser") return;
    const offset = (state.frame - this.options.timings[index].narrationStart) / this.options.fps;
    if (offset < 0) return;
    const sentences = splitSentences(this.options.scenes[index].narration);
    let from: number;
    if (this.resumeAt?.scene === index) from = this.resumeAt.sentence;
    else {
      const starts = sentenceStarts(sentences);
      from = Math.max(
        0,
        starts.findLastIndex((s) => s <= offset),
      );
    }
    this.resumeAt = null;
    this.restartSpeech(index, from, state);
  }

  private restartSpeech(scene: number, from: number, state: PlaybackState) {
    const speech = this.options.speech!;
    this.stopSpeech();
    const sentences = splitSentences(this.options.scenes[scene].narration);
    const session: SpeechSession = { scene, sentences, current: from, rate: state.rate, done: false };
    this.session = session;
    const live = () => this.session === session;
    sentences.slice(from).forEach((text, k) => {
      const u = speech.createUtterance(text);
      u.rate = state.rate;
      u.volume = state.volume;
      u.onstart = () => {
        if (live()) session.current = from + k;
      };
      const finish = () => {
        if (!live()) return;
        if (from + k + 1 >= sentences.length) this.finishSession(session);
        else session.current = from + k + 1;
      };
      u.onend = finish;
      u.onerror = finish;
      speech.speak(u);
    });
    if (from >= sentences.length) this.finishSession(session);
  }

  private finishSession(session: SpeechSession) {
    session.done = true;
    if (this.holdRequested) this.release();
  }

  /** Near the scene's end with sentences left: pause the video there until the voice is done. */
  private maybeHold(session: SpeechSession, state: PlaybackState) {
    if (this.holdRequested || !state.playing) return;
    const end = this.options.timings[session.scene].endFrame;
    const holdFrame = Math.max(this.options.timings[session.scene].narrationStart, end - 2);
    if (state.frame < holdFrame) return;
    this.holdRequested = true;
    const left = session.sentences.length - session.current;
    this.holdTimer = this.setTimer(
      () => this.release(),
      (left * HOLD_SECONDS_PER_SENTENCE * 1000) / state.rate,
    );
    this.options.onHold(holdFrame);
  }

  private release() {
    if (!this.holdRequested) return;
    this.holdRequested = false;
    if (this.holdTimer !== null) this.clearTimer(this.holdTimer);
    this.holdTimer = null;
    if (this.session) this.session.done = true;
    this.options.onRelease();
  }

  private stopSpeech() {
    this.holdRequested = false;
    if (this.holdTimer !== null) this.clearTimer(this.holdTimer);
    this.holdTimer = null;
    if (this.session) {
      this.session = null;
      this.options.speech?.cancel();
    }
  }
}
