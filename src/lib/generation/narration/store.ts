import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { emptyManifest, narrationManifestSchema, type NarrationManifest } from "@/lib/narration/manifest";

import type { AudioStore } from "./pipeline";

/** MP3s under `<publicDir>/audio/…` and the manifest JSON the app imports. */
export function createFileAudioStore({
  publicDir,
  manifestFile,
}: {
  publicDir: string;
  manifestFile: string;
}): AudioStore {
  const local = (file: string) => path.join(publicDir, ...file.split("/").filter(Boolean));
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
    writeAudio(file, bytes) {
      mkdirSync(path.dirname(local(file)), { recursive: true });
      writeFileSync(local(file), bytes);
    },
    exists: (file) => existsSync(local(file)),
    remove: (file) => rmSync(local(file), { force: true }),
  };
}
