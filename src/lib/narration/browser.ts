import type { AudioLike, SpeechAdapter, UtteranceLike } from "./engine";

/** An English voice: the system default if it's English, else the first en-US, else any English one. */
function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return (
    english.find((v) => v.default) ??
    english.find((v) => v.lang === "en-US" && v.localService) ??
    english.find((v) => v.lang === "en-US") ??
    english[0]
  );
}

/**
 * The browser's built-in speech synthesis, or `null` when there is none. Some browsers expose the API with no
 * voices installed; `onVoices` reports whether any exist once they've loaded (they arrive asynchronously).
 */
export function createBrowserSpeech(onVoices: (available: boolean) => void): SpeechAdapter | null {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  )
    return null;
  const synth = window.speechSynthesis;
  let voice = pickVoice(synth.getVoices());
  const refresh = () => {
    const voices = synth.getVoices();
    voice = pickVoice(voices);
    onVoices(voices.length > 0);
  };
  synth.addEventListener?.("voiceschanged", refresh);
  if (synth.getVoices().length > 0) queueMicrotask(refresh);
  return {
    speak: (u) => synth.speak(u as SpeechSynthesisUtterance),
    cancel: () => synth.cancel(),
    createUtterance(text): UtteranceLike {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = "en-US";
      return u as unknown as UtteranceLike;
    },
  };
}

export function createAudioElement(): AudioLike {
  const audio = new Audio();
  audio.preload = "auto";
  return audio;
}
