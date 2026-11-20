/**
 * The identity of one voiced scene: the exact narration text plus how it was voiced. The narration script names
 * each MP3 after it (so unchanged narration is never paid for twice) and the app recomputes it to ignore audio whose
 * narration has since been edited. A plain 53-bit string hash (cyrb53): it runs the same in Node and the browser,
 * and collisions don't matter here (a mismatch only means "regenerate").
 */
export type VoiceSpec = { voiceId: string; modelId: string; outputFormat: string };

export function cyrb53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export function narrationHash(narration: string, voice: VoiceSpec): string {
  return cyrb53([voice.modelId, voice.voiceId, voice.outputFormat, narration].join("\u0000"));
}
