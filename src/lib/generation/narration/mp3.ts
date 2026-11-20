/**
 * The exact length of an MP3 (MPEG audio layer III) by walking its frame headers: every frame holds a fixed number
 * of samples, so the length is samples / sample rate. Skips an ID3v2 tag and a Xing/Info header frame. No decoder
 * or ffprobe needed.
 */
const BITRATES_KBPS = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

type FrameHeader = { length: number; samples: number; sampleRate: number; sideInfo: number };

function readHeader(b: Uint8Array, i: number): FrameHeader | undefined {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return undefined;
  const version = (b[i + 1] >> 3) & 0b11; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layer = (b[i + 1] >> 1) & 0b11; // 1 = layer III
  const bitrateIndex = b[i + 2] >> 4;
  const rateIndex = (b[i + 2] >> 2) & 0b11;
  const padding = (b[i + 2] >> 1) & 1;
  const mono = b[i + 3] >> 6 === 0b11;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3)
    return undefined;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? BITRATES_KBPS.v1 : BITRATES_KBPS.v2)[bitrateIndex] * 1000;
  const samples = mpeg1 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  return { length, samples, sampleRate, sideInfo };
}

function id3Size(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0; // "ID3"
  const size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
  return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

const isTag = (b: Uint8Array, at: number, tag: string) =>
  [...tag].every((c, k) => b[at + k] === c.charCodeAt(0));

/** Length in milliseconds. Throws if the bytes hold no MP3 frames. */
export function mp3DurationMs(bytes: Uint8Array): number {
  let i = id3Size(bytes);
  let seconds = 0;
  let frames = 0;
  while (i < bytes.length) {
    const header = readHeader(bytes, i);
    if (!header) {
      i++; // resync on junk between frames
      continue;
    }
    const tagAt = i + 4 + header.sideInfo;
    const infoFrame = frames === 0 && (isTag(bytes, tagAt, "Xing") || isTag(bytes, tagAt, "Info"));
    if (!infoFrame) seconds += header.samples / header.sampleRate;
    frames++;
    i += header.length;
  }
  if (seconds === 0) throw new Error("Not an MP3: no audio frames found.");
  return Math.round(seconds * 1000);
}
