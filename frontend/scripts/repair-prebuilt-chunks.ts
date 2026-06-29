/**
 * Regenerates failed levels inside prebuilt chunk files.
 *
 * Usage: npx tsx scripts/repair-prebuilt-chunks.ts [levelId ...]
 * With no args, repairs all levels that fail verify-prebuilt-chunks checks.
 */
import fs from "fs";
import path from "path";
import type { Level } from "../src/levelModel";
import type { PrebuiltChunk, PrebuiltManifest } from "../src/prebuiltChunkTypes";
import { verifyLevelMoveRules } from "../src/levelSolvability";
import {
  getLevelActiveCellSet,
  levelArrowsExitValid,
} from "../src/levelModel";
import { buildLevelFresh, LEVEL_CACHE_VERSION, repairLevelDirections } from "../src/levels";

const prebuiltDir = path.join(__dirname, "..", "src", "data", "prebuilt");
const manifestPath = path.join(prebuiltDir, "manifest.json");

function collectErrors(level: Level, id: number): string[] {
  const errors: string[] = [];
  if (level.id !== id) errors.push(`level.id mismatch (${level.id} != ${id})`);
  if (level.rows < 1 || level.cols < 1) errors.push("invalid grid dimensions");
  if (level.arrows.length === 0) errors.push("no arrows (empty puzzle)");
  if (getLevelActiveCellSet(level).size === 0) errors.push("empty active cell set");
  if (!levelArrowsExitValid(level)) errors.push("arrow tip points into own body");
  errors.push(...verifyLevelMoveRules(level));
  return [...new Set(errors)];
}

function chunkMetaForId(manifest: PrebuiltManifest, id: number) {
  return manifest.chunks.find((c) => id >= c.start && id <= c.end);
}

function loadChunk(file: string): PrebuiltChunk {
  return JSON.parse(
    fs.readFileSync(path.join(prebuiltDir, file), "utf8")
  ) as PrebuiltChunk;
}

function saveChunk(file: string, chunk: PrebuiltChunk): void {
  fs.writeFileSync(path.join(prebuiltDir, file), JSON.stringify(chunk));
}

function findFailedIds(manifest: PrebuiltManifest): number[] {
  const failed: number[] = [];
  for (const meta of manifest.chunks) {
    const chunk = loadChunk(meta.file);
    for (let id = meta.start; id <= meta.end; id++) {
      const level = chunk.levels[String(id)];
      if (!level) {
        failed.push(id);
        continue;
      }
      if (collectErrors(level, id).length > 0) failed.push(id);
    }
  }
  return failed;
}

const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8")
) as PrebuiltManifest;

const explicitIds = process.argv.slice(2).map((s) => Number(s)).filter((n) => n > 0);
const targetIds = explicitIds.length > 0 ? explicitIds : findFailedIds(manifest);

if (targetIds.length === 0) {
  console.log("No failed levels to repair.");
  process.exit(0);
}

console.log(`Repairing ${targetIds.length} level(s)…\n`);

const dirtyChunks = new Map<string, PrebuiltChunk>();

for (const id of targetIds) {
  const meta = chunkMetaForId(manifest, id);
  if (!meta) {
    console.warn(`  level ${id}: outside prebuilt range, skipped`);
    continue;
  }

  let chunk = dirtyChunks.get(meta.file) ?? loadChunk(meta.file);
  const before = collectErrors(chunk.levels[String(id)] as Level, id);

  let repaired: Level | null = null;
  let lastErrors: string[] = [];
  const t0 = Date.now();

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const candidate = buildLevelFresh(id);
      const errors = collectErrors(candidate, id);
      if (errors.length === 0) {
        repaired = candidate;
        break;
      }
      lastErrors = errors;
    } catch (err) {
      lastErrors = [
        `generation failed: ${err instanceof Error ? err.message : String(err)}`,
      ];
    }

    const chunkLevel = chunk.levels[String(id)] as Level | undefined;
    if (chunkLevel) {
      const fixed = repairLevelDirections(chunkLevel);
      if (fixed) {
        const errors = collectErrors(fixed, id);
        if (errors.length === 0) {
          repaired = fixed;
          break;
        }
        lastErrors = errors;
      }
    }
  }

  if (!repaired) {
    console.error(
      `  level ${id}: FAILED after 40 attempts — ${lastErrors.join("; ")}`
    );
    continue;
  }

  chunk.levels[String(id)] = repaired;
  chunk.version = LEVEL_CACHE_VERSION;
  dirtyChunks.set(meta.file, chunk);

  const ms = Date.now() - t0;
  console.log(
    `  level ${id}: repaired (${ms}ms) — was: ${before.join("; ") || "unknown"}`
  );
}

for (const [file, chunk] of dirtyChunks) {
  saveChunk(file, chunk);
  console.log(`\nWrote ${file}`);
}

manifest.version = LEVEL_CACHE_VERSION;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Updated manifest v${LEVEL_CACHE_VERSION}`);
