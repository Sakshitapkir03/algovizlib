import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { emptyManifest, narrationManifestSchema, type NarrationManifest } from "@/lib/narration/manifest";

import type { AudioStore } from "./pipeline";

/**
 * Clips under `<clipsDir>/<storyboard>/…` (the stitching source, not served), tracks under `<publicDir>/audio/…`,
 * and the manifest JSON the app imports.
 */
export function createFileAudioStore({
  publicDir,
  clipsDir,
  manifestFile,
}: {
  publicDir: string;
  clipsDir: string;
  manifestFile: string;
}): AudioStore & { clipPath(file: string): string } {
  const under = (dir: string, file: string) => path.join(dir, ...file.split("/").filter(Boolean));
  const write = (local: string, bytes: Uint8Array) => {
    mkdirSync(path.dirname(local), { recursive: true });
    writeFileSync(local, bytes);
  };
  return {
    readManifest: () =>
      existsSync(manifestFile)
        ? narrationManifestSchema.parse(JSON.parse(readFileSync(manifestFile, "utf8")))
        : emptyManifest(),
    writeManifest(manifest: NarrationManifest) {
      // Sorted keys, so the file diffs cleanly.
      const storyboards = Object.fromEntries(
        Object.keys(manifest.storyboards)
          .sort()
          .map((id) => [id, manifest.storyboards[id]]),
      );
      writeFileSync(manifestFile, `${JSON.stringify({ ...manifest, storyboards }, null, 2)}\n`);
    },
    clipPath: (file) => under(clipsDir, file),
    writeClip: (file, bytes) => write(under(clipsDir, file), bytes),
    clipExists: (file) => existsSync(under(clipsDir, file)),
    removeClip: (file) => rmSync(under(clipsDir, file), { force: true }),
    writeTrack: (file, bytes) => write(under(publicDir, file), bytes),
    trackExists: (file) => existsSync(under(publicDir, file)),
    removeTrack: (file) => rmSync(under(publicDir, file), { force: true }),
  };
}
