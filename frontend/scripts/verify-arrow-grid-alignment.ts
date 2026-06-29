/**
 * Verifies arrow paths align to grid cell centers across prebuilt levels.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Level } from "../src/levelModel";
import {
  cellCenterAbs,
  computeArrowGeometry,
} from "../src/arrowGeometry";

const CELL_SIZE = 32;
const BOARD_PAD = 64;
const STROKE_SCALES = [1, 1.15] as const;

type Issue = {
  levelId: number;
  arrowIdx: number;
  kind: string;
  detail: string;
};

function parsePathPoints(pathD: string): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const part of pathD.split(/[ML]/)) {
    const t = part.trim();
    if (!t) continue;
    const [xs, ys] = t.split(/\s+/);
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distance from point to line segment. */
function pointToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function onPath(pathD: string, target: { x: number; y: number }, eps = 1.5) {
  const pts = parsePathPoints(pathD);
  if (pts.length === 0) return false;
  if (pts.length === 1) return dist(pts[0], target) <= eps;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointToSegment(target, pts[i], pts[i + 1]) <= eps) return true;
  }
  return false;
}

function checkArrow(level: Level, arrowIdx: number, strokeScale: number): Issue[] {
  const a = level.arrows[arrowIdx];
  const issues: Issue[] = [];
  const g = computeArrowGeometry(
    a.cells,
    a.direction,
    CELL_SIZE,
    BOARD_PAD,
    strokeScale
  );

  for (let i = 0; i < a.cells.length; i++) {
    const c = a.cells[i];
    const center = cellCenterAbs(c, CELL_SIZE, BOARD_PAD);
    if (!onPath(g.pathD, center)) {
      issues.push({
        levelId: level.id,
        arrowIdx,
        kind: "cell-off-path",
        detail: `cell (${c.row},${c.col}) center not on path (scale ${strokeScale})`,
      });
    }
  }

  const head = a.cells[a.cells.length - 1];
  const hc = cellCenterAbs(head, CELL_SIZE, BOARD_PAD);

  if (a.cells.length === 1) {
    const midTailTip = dist(
      { x: (parsePathPoints(g.pathD)[0]?.x ?? 0), y: (parsePathPoints(g.pathD)[0]?.y ?? 0) },
      { x: g.tipX, y: g.tipY }
    );
    const centerFromEndpoints = {
      x: (parsePathPoints(g.pathD)[0]?.x + g.tipX) / 2,
      y: (parsePathPoints(g.pathD)[0]?.y + g.tipY) / 2,
    };
    if (dist(centerFromEndpoints, hc) > 2) {
      issues.push({
        levelId: level.id,
        arrowIdx,
        kind: "single-asymmetric",
        detail: `glyph midpoint off cell center by ${dist(centerFromEndpoints, hc).toFixed(1)}px`,
      });
    }
    if (Math.abs(g.tipX - hc.x) !== Math.abs(parsePathPoints(g.pathD)[0]?.x - hc.x)) {
      const tail = parsePathPoints(g.pathD)[0];
      if (tail && Math.abs(Math.abs(g.tipX - hc.x) - Math.abs(tail.x - hc.x)) > 2) {
        issues.push({
          levelId: level.id,
          arrowIdx,
          kind: "single-unbalanced",
          detail: `tail/tip not balanced around center (dir ${a.direction})`,
        });
      }
    }
  }

  // Hit box should contain cell rect for single-cell arrows.
  if (a.cells.length === 1) {
    const cellLeft = BOARD_PAD + head.col * CELL_SIZE;
    const cellTop = BOARD_PAD + head.row * CELL_SIZE;
    const b = g.bounds;
    if (
      b.left > cellLeft - 1 ||
      b.top > cellTop - 1 ||
      b.left + b.width < cellLeft + CELL_SIZE + 1 ||
      b.top + b.height < cellTop + CELL_SIZE + 1
    ) {
      issues.push({
        levelId: level.id,
        arrowIdx,
        kind: "single-bounds",
        detail: "hit box does not cover full grid cell",
      });
    }
  }

  return issues;
}

function loadLevels(): Level[] {
  const dir = join(process.cwd(), "src/data/prebuilt");
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8")
  ) as { chunks: { file: string }[] };
  const levels: Level[] = [];
  for (const ch of manifest.chunks) {
    const data = JSON.parse(readFileSync(join(dir, ch.file), "utf8")) as {
      levels: Record<string, Level>;
    };
    for (const lv of Object.values(data.levels)) levels.push(lv);
  }
  return levels.sort((a, b) => a.id - b.id);
}

const levels = loadLevels();
const issues: Issue[] = [];
let singleCount = 0;
let multiCount = 0;

for (const level of levels) {
  level.arrows.forEach((a, idx) => {
    if (a.cells.length === 1) singleCount++;
    else multiCount++;
    for (const scale of STROKE_SCALES) {
      issues.push(...checkArrow(level, idx, scale));
    }
  });
}

console.log(`Checked ${levels.length} levels, ${singleCount} single-cell + ${multiCount} multi-cell arrows`);

if (issues.length === 0) {
  console.log("All arrows align to grid cell centers.");
} else {
  const byKind = new Map<string, number>();
  for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  console.log("Issues:", Object.fromEntries(byKind));
  for (const i of issues.slice(0, 30)) {
    console.log(`  L${i.levelId} arrow ${i.arrowIdx}: [${i.kind}] ${i.detail}`);
  }
  if (issues.length > 30) console.log(`  ... and ${issues.length - 30} more`);
  process.exit(1);
}
