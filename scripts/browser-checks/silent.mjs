// Shared setup for automated browser checks (Playwright / playwright-core): every check must be silent.
//
//   import { launchSilent, silentContext } from "<repo>/scripts/browser-checks/silent.mjs";
//   const browser = await launchSilent(chromium);
//   const context = await silentContext(browser, { viewport: { width: 1280, height: 900 } });
//
// - Chrome runs with --mute-audio: <audio> still plays (currentTime advances, paused/playbackRate/volume/muted
//   behave normally), so ElevenLabs sync checks keep working, but nothing reaches the speakers.
// - The browser voice goes through the OS speech engine (macOS speaks even with --mute-audio), so every context
//   replaces window.speechSynthesis (and SpeechSynthesisUtterance) with a silent fake before the page loads. It keeps the real API's shape and
//   timing: one English voice, `voiceschanged`, a queue, and start / boundary (per word) / end events at about
//   150 words a minute times the utterance's rate; cancel() fires "error" (interrupted / canceled) like Chrome.
//   The narration engine's sentence sync, holds, and watchdog are exercised exactly as with a real voice.
//
// Playwright isn't a dependency of the app: pass in the `chromium` you imported.

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Chrome flags every check launches with. */
export const SILENT_ARGS = ["--mute-audio"];

/** Launch Chrome muted. `options` are passed to chromium.launch (args are merged). */
export function launchSilent(chromium, options = {}) {
  return chromium.launch({
    executablePath: CHROME,
    ...options,
    args: [...SILENT_ARGS, ...(options.args ?? [])],
  });
}

/** A new context with the silent speech fake installed in every page. */
export async function silentContext(browser, options = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(installSilentSpeech);
  return context;
}

/** Runs in the page (serialized by addInitScript): replace speechSynthesis with a silent, event-accurate fake. */
export function installSilentSpeech() {
  const WORDS_PER_SECOND = 2.5; // ~150 wpm at rate 1
  const voice = {
    name: "Silent test voice",
    lang: "en-US",
    localService: true,
    default: true,
    voiceURI: "silent-test-voice",
  };
  const synth = new EventTarget();
  const queue = [];
  let current = null; // { u, words, next, timer, startedAt, elapsedBefore }
  let paused = false;

  // A real utterance only accepts a real SpeechSynthesisVoice, which can't be constructed, so the utterance is
  // faked too: same fields, on* handlers, and listeners.
  class SilentUtterance extends EventTarget {
    constructor(text = "") {
      super();
      Object.assign(this, { text, lang: "", voice: null, rate: 1, pitch: 1, volume: 1 });
      for (const type of ["start", "end", "error", "boundary", "pause", "resume", "mark"])
        this[`on${type}`] = null;
    }
  }

  const fire = (u, type, init = {}) => {
    const event = new Event(type);
    Object.assign(event, {
      utterance: u,
      charIndex: init.charIndex ?? 0,
      elapsedTime: init.elapsedTime ?? 0,
      name: init.name ?? "",
      ...(type === "error" ? { error: init.error } : {}),
    });
    u.dispatchEvent(event);
    u[`on${type}`]?.call(u, event);
  };

  const msPerWord = (u) => 1000 / (WORDS_PER_SECOND * (u.rate || 1));

  // Schedule the next word boundary (or the end) for the current utterance.
  const tick = () => {
    if (!current || paused) return;
    const { u, words } = current;
    if (current.next < words.length) {
      const { word, index } = words[current.next];
      current.next++;
      fire(u, "boundary", {
        name: "word",
        charIndex: index,
        elapsedTime: (performance.now() - current.startedAt) / 1000,
      });
      current.timer = setTimeout(tick, msPerWord(u) * Math.max(1, word.length / 5));
      return;
    }
    const done = current;
    current = null;
    fire(done.u, "end", { elapsedTime: (performance.now() - done.startedAt) / 1000 });
    startNext();
  };

  const startNext = () => {
    if (current || paused || queue.length === 0) return;
    const u = queue.shift();
    const words = [...String(u.text).matchAll(/\S+/g)].map((m) => ({ word: m[0], index: m.index }));
    current = { u, words, next: 0, timer: null, startedAt: performance.now() };
    // Real engines take a moment to start.
    current.timer = setTimeout(() => {
      if (!current || current.u !== u) return;
      fire(u, "start");
      tick();
    }, 40);
  };

  Object.defineProperties(synth, {
    speaking: { get: () => current !== null },
    pending: { get: () => queue.length > 0 },
    paused: { get: () => paused },
  });
  synth.getVoices = () => [voice];
  synth.speak = (u) => {
    queue.push(u);
    startNext();
  };
  synth.cancel = () => {
    const dropped = queue.splice(0);
    if (current) {
      clearTimeout(current.timer);
      const u = current.u;
      current = null;
      fire(u, "error", { error: "interrupted" });
    }
    for (const u of dropped) fire(u, "error", { error: "canceled" });
    paused = false;
  };
  synth.pause = () => {
    if (paused) return;
    paused = true;
    if (current) clearTimeout(current.timer);
    if (current) fire(current.u, "pause");
  };
  synth.resume = () => {
    if (!paused) return;
    paused = false;
    if (current) {
      fire(current.u, "resume");
      tick();
    } else startNext();
  };
  synth.onvoiceschanged = null;
  synth.addEventListener("voiceschanged", (e) => synth.onvoiceschanged?.(e));

  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: SilentUtterance, configurable: true });
  window.__silentSpeech = true;
  setTimeout(() => synth.dispatchEvent(new Event("voiceschanged")), 0);
}
