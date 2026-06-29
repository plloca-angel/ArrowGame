/**
 * Validates every level in each prebuilt chunk JSON file.
 *
 * Usage: npx tsx scripts/verify-prebuilt-chunks.ts
 */
import fs from "fs";
import path from "path";
import type { Level } from "../src/levelModel";
import type { PrebuiltChunk, PrebuiltManifest } from "../src/prebuiltChunkTypes";
import {
  getLevelActiveCellSet,
  levelArrowsExitValid,
} from "../src/levelModel";
import { verifyLevelMoveRules } from "../src/levelSolvability";

const prebuiltDir = path.join(__dirname, "..", "src", "data", "prebuilt");
const manifestPath = path.join(prebuiltDir, "manifest.json");

const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8")
) as PrebuiltManifest;

type Failure = { chunk: number; id: number; errors: string[] };

const failures: Failure[] = [];
let checked = 0;
const t0 = Date.now();

for (const meta of manifest.chunks) {
  const chunkPath = path.join(prebuiltDir, meta.file);
  const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8")) as PrebuiltChunk;
  let chunkFailures = 0;

  if (chunk.version !== manifest.version) {
    failures.push({
      chunk: meta.index,
      id: meta.start,
      errors: [
        `chunk version ${chunk.version} != manifest ${manifest.version}`,
      ],
    });
    chunkFailures++;
  }

  for (let id = meta.start; id <= meta.end; id++) {
    checked++;
    const level = chunk.levels[String(id)] as Level | undefined;
    const errors: string[] = [];

    if (!level) {
      errors.push("missing level data in chunk");
    } else {
      if (level.id !== id) {
        errors.push(`level.id mismatch (${level.id} != ${id})`);
      }
      if (level.rows < 1 || level.cols < 1) {
        errors.push("invalid grid dimensions");
      }
      if (level.arrows.length === 0) {
        errors.push("no arrows (empty puzzle)");
      }
      const active = getLevelActiveCellSet(level);
      if (active.size === 0) {
        errors.push("empty active cell set");
      }
      if (!levelArrowsExitValid(level)) {
        errors.push("arrow tip points into own body");
      }
      errors.push(...verifyLevelMoveRules(level));
    }

    const unique = [...new Set(errors)];
    if (unique.length > 0) {
      chunkFailures++;
      failures.push({ chunk: meta.index, id, errors: unique });
    }
  }

  const status = chunkFailures === 0 ? "PASS" : "FAIL";
  console.log(
    `chunk ${String(meta.index).padStart(2, "0")} (levels ${meta.start}–${meta.end}): ${status}` +
      (chunkFailures > 0 ? ` — ${chunkFailures} level(s) failed` : "")
  );
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nChecked ${checked} levels across ${manifest.chunks.length} chunks in ${elapsed}s`);
console.log(`Manifest v${manifest.version}, chunk size ${manifest.chunkSize}, max ${manifest.maxLevel}`);

if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const { chunk, id, errors } of failures.slice(0, 40)) {
    console.log(`  chunk ${chunk} level ${id}: ${errors.join("; ")}`);
  }
  if (failures.length > 40) {
    console.log(`  … and ${failures.length - 40} more`);
  }
  process.exit(1);
}

console.log("\nAll prebuilt chunk levels passed validation.");
