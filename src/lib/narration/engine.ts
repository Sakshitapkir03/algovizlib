import { countWords, sceneIndexAtFrame, type SceneTiming } from "@/lib/storyboard/timing";

/**
 * Keeps narration in step with the video. The Player is the clock: every frame update, seek, play/pause, speed or
 * volume change calls `update()`, and the engine makes the voice match.
 *
 * - **ElevenLabs** (the video has a stitched `track`): ONE audio element plays the whole video's narration, and its
 *   position is simply the video's time (`frame / fps`). Its source is set once; scene changes never touch it. When
 *   it starts (play, resume, seek, a buffering stall), the video waits on the frame until the audio is really
 *   playing (`onHold`), so they start together and there's no gap to catch up. Slow drift is closed by playing a
 *   few percent faster or slower (`NUDGE`, inaudible with pitch preserved); only a large jump (a background tab)
 *   resets the position. Speed changes set `playbackRate` with `preservesPitch`.
 * - **Browser voice** (no track, Web Speech API available): each scene's narration is queued sentence by sentence
 *   at its narration start, and scene changes never cancel it: if it's still speaking when the scene ends, the
 *   video waits there (`onHold`) until the last sentence finishes. Only a seek or scene jump interrupts speech
 *   (it restarts from the sentence at that point, estimated from the narration pace); pause/resume and speed
 *   changes restart the sentence being spoken.
 * - **Silent**: neither is available; the video plays with captions and the transcript.
 *
 * Nothing sounds until the viewer presses play, which keeps it within browser autoplay rules.
 */

export type VoiceKind = "elevenlabs" | "browser" | "silent";

/** Which voice reads a video: its stitched ElevenLabs track, else the browser's voice, else none. */
export function chooseVoice(hasTrack: boolean, speechAvailable: boolean): VoiceKind {
  if (hasTrack) return "elevenlabs";
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
  /** A seek is in progress. */
  readonly seeking: boolean;
  /** 3 (HAVE_FUTURE_DATA) or more: it can play from here. */
  readonly readyState: number;
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

export type NarrationScene = { narration: string; durationInFrames: number };

/** The video's stitched narration (see `withNarration`). */
export type NarrationTrack = { src: string; durationMs: number };

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
  /** The stitched ElevenLabs track, or null when the browser voice reads the video. */
  track: NarrationTrack | null;
  /** Created lazily, the first time the track plays. */
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

/** Past this much drift (a background tab, a long stall) the track's position is reset instead of nudged. */
export const DRIFT_SECONDS = 0.5;
/**
 * Small drift is closed smoothly: the track plays `NUDGE` faster or slower (pitch preserved, far below what anyone
 * notices) from `NUDGE_START` until it's within `NUDGE_STOP`. With the start-up wait, drift is rarely more than a
 * frame or two.
 */
export const NUDGE = 0.03;
export const NUDGE_START = 0.1;
export const NUDGE_STOP = 0.03;
/**
 * The last stretch of the track is its silent tail (`TAIL_MS` in the stitcher, 0.6 s): once the video is this close
 * to the end, a finished track stays finished rather than being restarted for a few frames.
 */
export const END_GUARD_SECONDS = 0.3;
/** How often the start-up wait checks whether the audio is playing, and when it gives up and lets the video go. */
const READY_POLL_MS = 40;
const READY_TIMEOUT_MS = 4000;
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
  /** The video is held until the audio is really playing (after a start, resume, seek, or stall). */
  private waiting: { polls: number; timer: unknown } | null = null;
  /** The browser refused to play (autoplay rules): the video goes on silently until the next pause or seek. */
  private blocked = false;
  /** Catching up (+1) or easing back (−1) on small drift, 0 when in step. */
  private nudge: -1 | 0 | 1 = 0;
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

  /** The voice reading this video. */
  get voice(): VoiceKind {
    return chooseVoice(this.options.track !== null, this.options.speech !== null);
  }

  /** Bring the voice in line with the player. `seeked`: the frame jumped (scrub, scene jump, keyboard seek). */
  update(state: PlaybackState, seeked = false): void {
    const playing = state.playing || state.holding;
    if (this.options.track) {
      this.syncTrack(this.options.track, playing, state, seeked);
      return;
    }
    if (seeked) {
      this.resumeAt = null;
      this.stopSpeech();
    }
    const index = sceneIndexAtFrame(this.options.timings, state.frame);
    if (this.voice === "browser" || this.session) this.syncSpeech(index, this.voice, playing, state, seeked);
  }

  dispose(): void {
    this.audio?.pause();
    this.endWait(false);
    this.stopSpeech();
    this.resumeAt = null;
  }

  // ── ElevenLabs track ──────────────────────────────────────────────────────────────────────────────────────────

  private syncTrack(track: NarrationTrack, playing: boolean, state: PlaybackState, seeked: boolean) {
    const target = state.frame / this.options.fps;
    const audio = this.audio;
    if (!playing) {
      this.endWait(false);
      this.blocked = false;
      if (audio && !audio.paused) audio.pause();
      return;
    }
    if (seeked) this.blocked = false;
    if (this.blocked) return;
    const el = (this.audio ??= this.options.createAudio());
    if (!el.src) el.src = track.src; // the one and only time the source is set
    el.volume = state.volume;
    el.muted = state.muted;
    el.preservesPitch = true;
    // In the track's silent tail (or past it) there's nothing left to say: let it finish, never restart it.
    if (target >= track.durationMs / 1000 - END_GUARD_SECONDS) return;

    if (el.paused || seeked) {
      // Starting, resuming, or jumping: put the track where the video is and hold the video until it plays.
      el.currentTime = target;
      this.nudge = 0;
      el.playbackRate = state.rate;
      if (el.paused)
        el.play().catch(() => {
          // Autoplay refused: let the video go on silently rather than retry every frame.
          this.blocked = true;
          this.endWait(true);
        });
      this.beginWait(state.frame);
      return;
    }
    if (this.waiting) return; // the video is parked until the audio catches up
    if (el.seeking || el.readyState < 3) {
      // Buffering mid-play: park the video rather than let them drift apart.
      this.beginWait(state.frame);
      return;
    }

    const drift = el.currentTime - target;
    if (Math.abs(drift) > DRIFT_SECONDS) {
      el.currentTime = target;
      this.nudge = 0;
      this.beginWait(state.frame);
    } else if (Math.abs(drift) > NUDGE_START) this.nudge = drift < 0 ? 1 : -1;
    else if (Math.abs(drift) < NUDGE_STOP) this.nudge = 0;
    el.playbackRate = state.rate * (1 + this.nudge * NUDGE);
  }

  /** Park the video on `frame` until the track is playing (checked every `READY_POLL_MS`). */
  private beginWait(frame: number) {
    if (this.waiting) return;
    const poll = () => {
      const el = this.audio;
      if (!this.waiting || !el) return;
      const ready = !el.paused && !el.seeking && el.readyState >= 3;
      if (ready || ++this.waiting.polls * READY_POLL_MS >= READY_TIMEOUT_MS) this.endWait(true);
      else this.waiting.timer = this.setTimer(poll, READY_POLL_MS);
    };
    this.waiting = { polls: 0, timer: this.setTimer(poll, READY_POLL_MS) };
    this.holdRequested = true;
    this.options.onHold(frame);
  }

  /** Stop waiting; `release` resumes the video (false when the viewer paused, so it stays paused). */
  private endWait(release: boolean) {
    if (!this.waiting) return;
    this.clearTimer(this.waiting.timer);
    this.waiting = null;
    if (release && this.holdRequested) {
      this.holdRequested = false;
      this.options.onRelease();
    } else this.holdRequested = false;
  }

  // ── Browser voice ─────────────────────────────────────────────────────────────────────────────────────────────

  private syncSpeech(
    index: number,
    kind: VoiceKind,
    playing: boolean,
    state: PlaybackState,
    seeked: boolean,
  ) {
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
      if (!session.done && !seeked) {
        // Played into the next scene while the voice is still reading this one (a fast frame skipped the hold
        // point): never cut it off. Wait at this scene's end until it finishes.
        this.maybeHold(session, state);
        return;
      }
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
