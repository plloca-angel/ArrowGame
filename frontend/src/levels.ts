// Arrow Puzzle Escape - Infinite Procedural Levels (up to 12x12)
// Grids are fully filled (every cell = an arrow).
// Solvability is GUARANTEED by construction: arrows are placed center-out and
// each new placement has a clear path of all previously-placed arrows.
// Solve order = reverse placement order (first arrow in `arrows` array fires first).

export type Direction = "up" | "down" | "left" | "right";

export type ArrowDef = {
  row: number;
  col: number;
  direction: Direction;
};

export type Level = {
  id: number;
  rows: number;
  cols: number;
  arrows: ArrowDef[];
  hint?: string;
};

export const DIR_VEC: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

// Difficulty curve: grid size scales with level, capped at 12x12.
// Approximate ramp:
//   L1: 3x3
//   L2-3: 3x4
//   L4-5: 4x4
//   L6-7: 4x5
//   L8-9: 5x5
//   L10-12: 5x6
//   L13-16: 6x6
//   L17-20: 6x7
//   L21-25: 7x7
//   L26-30: 7x8
//   L31-36: 8x8
//   L37-42: 8x9
//   L43-50: 9x9
//   L51-60: 9x10
//   L61-72: 10x10
//   L73-85: 10x11
//   L86-100: 11x11
//   L101-120: 11x12
//   L121+:    12x12 (max)
export function getLevelDimensions(id: number): { rows: number; cols: number } {
  const ramp: Array<[number, number]> = [
    [3, 3], [3, 4], [3, 4],
    [4, 4], [4, 4],
    [4, 5], [4, 5],
    [5, 5], [5, 5],
    [5, 6], [5, 6], [5, 6],
    [6, 6], [6, 6], [6, 6], [6, 6],
    [6, 7], [6, 7], [6, 7], [6, 7],
    [7, 7], [7, 7], [7, 7], [7, 7], [7, 7],
    [7, 8], [7, 8], [7, 8], [7, 8], [7, 8],
    [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8],
    [8, 9], [8, 9], [8, 9], [8, 9], [8, 9], [8, 9],
    [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9],
  ];
  if (id - 1 < ramp.length) {
    const [r, c] = ramp[id - 1];
    return { rows: r, cols: c };
  }
  // Continue ramping past L50
  const beyond = id - ramp.length; // 1, 2, 3, ...
  if (beyond <= 10) return { rows: 9, cols: 10 };
  if (beyond <= 22) return { rows: 10, cols: 10 };
  if (beyond <= 35) return { rows: 10, cols: 11 };
  if (beyond <= 50) return { rows: 11, cols: 11 };
  if (beyond <= 70) return { rows: 11, cols: 12 };
  return { rows: 12, cols: 12 }; // hard cap
}

// Seeded PRNG so every "level N" is deterministic across sessions
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLevel(id: number): Level {
  const { rows, cols } = getLevelDimensions(id);
  const target = rows * cols;

  // Try with seeded RNG first for determinism; fall back with attempts
  for (let attempt = 0; attempt < 6000; attempt++) {
    const rand = mulberry32(id * 1000003 + attempt);
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    let stuck = false;

    while (placed.length < target && !stuck) {
      // Gather empty cells with distance from edge
      const empties: { r: number; c: number; d: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!occupied.has(`${r},${c}`)) {
            empties.push({
              r,
              c,
              d: Math.min(r, rows - 1 - r, c, cols - 1 - c),
            });
          }
        }
      }
      // Innermost cells first; random tiebreak via seeded rand
      empties.sort((a, b) => b.d - a.d || rand() - 0.5);

      let placedThis = false;
      for (const { r, c } of empties) {
        const dirs: Direction[] = ["up", "down", "left", "right"];
        // Shuffle deterministically
        for (let i = dirs.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        for (const dir of dirs) {
          const [dr, dc] = DIR_VEC[dir];
          let rr = r + dr;
          let cc = c + dc;
          let blocked = false;
          while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            if (occupied.has(`${rr},${cc}`)) {
              blocked = true;
              break;
            }
            rr += dr;
            cc += dc;
          }
          if (!blocked) {
            placed.push({ row: r, col: c, direction: dir });
            occupied.add(`${r},${c}`);
            placedThis = true;
            break;
          }
        }
        if (placedThis) break;
      }
      if (!placedThis) stuck = true;
    }
    if (placed.length === target) {
      placed.reverse(); // index 0 = first to fire
      return {
        id,
        rows,
        cols,
        arrows: placed,
        hint:
          id === 1
            ? "Tap arrows in the right order — each one flies in its direction!"
            : undefined,
      };
    }
  }
  // Extremely unlikely fallback: smaller grid
  return generateLevel(Math.max(1, id - 1));
}

// Convenience for current level lookup
export function getLevel(id: number): Level {
  return generateLevel(Math.max(1, id));
}
