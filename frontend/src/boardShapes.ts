type ShapeCell = { row: number; col: number };

function shapeCellKey(r: number, c: number) {
  return `${r},${c}`;
}

export type BoardShape = {
  id: number;
  name: string;
  category: string;
  rows: number;
  cols: number;
  cells: ShapeCell[];
};

type Mask = boolean[][];

function maskBounds(mask: Mask): { rows: number; cols: number } {
  return { rows: mask.length, cols: mask[0]?.length ?? 0 };
}

function cellsFromMask(mask: Mask): ShapeCell[] {
  const cells: ShapeCell[] = [];
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      if (mask[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function parseAsciiMask(lines: string[]): Mask {
  return lines.map((line) =>
    line.split("").map((ch) => ch === "#" || ch === "X")
  );
}

function rotateMaskCW(mask: Mask): Mask {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const out: Mask = Array.from({ length: cols }, () => Array(rows).fill(false));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[c][rows - 1 - r] = mask[r][c];
    }
  }
  return out;
}

function mirrorMaskH(mask: Mask): Mask {
  return mask.map((row) => [...row].reverse());
}

function trimMask(mask: Mask): Mask {
  let r0 = mask.length;
  let r1 = -1;
  let c0 = mask[0]?.length ?? 0;
  let c1 = -1;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      if (!mask[r][c]) continue;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
    }
  }
  if (r1 < r0) return [[false]];
  return mask
    .slice(r0, r1 + 1)
    .map((row) => row.slice(c0, c1 + 1));
}

function maskFromCells(cells: ShapeCell[], rows: number, cols: number): Mask {
  const mask: Mask = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const { row, col } of cells) {
    if (row >= 0 && row < rows && col >= 0 && col < cols) mask[row][col] = true;
  }
  return mask;
}

function scaleMask2x(mask: Mask): Mask {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const out: Mask = Array.from({ length: rows * 2 }, () => Array(cols * 2).fill(false));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) continue;
      out[r * 2][c * 2] = true;
      out[r * 2][c * 2 + 1] = true;
      out[r * 2 + 1][c * 2] = true;
      out[r * 2 + 1][c * 2 + 1] = true;
    }
  }
  return out;
}

function boardShapeFromMask(
  id: number,
  name: string,
  category: string,
  mask: Mask
): BoardShape {
  const trimmed = trimMask(mask);
  const cells = cellsFromMask(trimmed);
  const { rows, cols } = maskBounds(trimmed);
  return { id, name, category, rows, cols, cells };
}

/** Upscale silhouettes so special levels feel large and packed like showcase puzzles. */
export function prepareSpecialShape(shape: BoardShape): BoardShape {
  let mask = maskFromCells(shape.cells, shape.rows, shape.cols);
  const MIN_CELLS = 54;
  const MAX_SIDE = 17;

  for (let pass = 0; pass < 3; pass++) {
    const trimmed = trimMask(mask);
    if (cellsFromMask(trimmed).length >= MIN_CELLS) break;
    const scaled = scaleMask2x(trimmed);
    const { rows, cols } = maskBounds(scaled);
    if (rows > MAX_SIDE || cols > MAX_SIDE) break;
    mask = scaled;
  }

  return boardShapeFromMask(shape.id, shape.name, shape.category, mask);
}

function shapeFromMask(
  id: number,
  name: string,
  category: string,
  mask: Mask
): BoardShape | null {
  const trimmed = trimMask(mask);
  const cells = cellsFromMask(trimmed);
  if (cells.length < 4) return null;
  const { rows, cols } = maskBounds(trimmed);
  if (rows < 3 || cols < 3 || rows > 14 || cols > 14) return null;
  return { id, name, category, rows, cols, cells };
}

function filledRect(h: number, w: number): Mask {
  return Array.from({ length: h }, () => Array(w).fill(true));
}

function ellipseMask(h: number, w: number, fill = 0.42): Mask {
  const mask: Mask = Array.from({ length: h }, () => Array(w).fill(false));
  const cy = (h - 1) / 2;
  const cx = (w - 1) / 2;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ny = (r - cy) / (h / 2);
      const nx = (c - cx) / (w / 2);
      if (nx * nx + ny * ny <= 1 + fill * 0.08) mask[r][c] = true;
    }
  }
  return mask;
}

function diamondMask(size: number): Mask {
  const n = size * 2 - 1;
  const mask: Mask = Array.from({ length: n }, () => Array(n).fill(false));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const dist = Math.abs(r - (n - 1) / 2) + Math.abs(c - (n - 1) / 2);
      if (dist <= (n - 1) / 2) mask[r][c] = true;
    }
  }
  return mask;
}

function crossMask(size: number, arm: number): Mask {
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  const mid = Math.floor(size / 2);
  for (let i = 0; i < size; i++) {
    for (let d = -arm; d <= arm; d++) {
      const r = mid + d;
      const c = mid + d;
      if (r >= 0 && r < size) mask[r][i] = true;
      if (c >= 0 && c < size) mask[i][c] = true;
    }
  }
  return mask;
}

function ringMask(size: number, thickness: number): Mask {
  const outer = ellipseMask(size, size, 0.35);
  const inner = ellipseMask(
    size - thickness * 2,
    size - thickness * 2,
    0.35
  );
  const pad = thickness;
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!outer[r][c]) continue;
      const ir = r - pad;
      const ic = c - pad;
      if (ir >= 0 && ic >= 0 && ir < inner.length && ic < inner[0].length) {
        if (inner[ir][ic]) continue;
      }
      mask[r][c] = true;
    }
  }
  return mask;
}

function triangleMask(h: number, w: number, flip = false): Mask {
  const mask: Mask = Array.from({ length: h }, () => Array(w).fill(false));
  for (let r = 0; r < h; r++) {
    const row = flip ? h - 1 - r : r;
    const span = Math.round(((row + 1) / h) * w);
    const start = Math.floor((w - span) / 2);
    for (let c = start; c < start + span && c < w; c++) mask[r][c] = true;
  }
  return mask;
}

function chevronMask(size: number, bands: number): Mask {
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  for (let b = 0; b < bands; b++) {
    for (let r = 0; r < size; r++) {
      const c = Math.abs(r - Math.floor(size / 2)) + b * 2;
      if (c < size) mask[r][c] = true;
    }
  }
  return mask;
}

function spiralBandMask(size: number): Mask {
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  let top = 0;
  let bottom = size - 1;
  let left = 0;
  let right = size - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) mask[top][c] = true;
    top++;
    for (let r = top; r <= bottom; r++) mask[r][right] = true;
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) mask[bottom][c] = true;
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) mask[r][left] = true;
      left++;
    }
  }
  return mask;
}

function zigzagMask(rows: number, cols: number, amp: number): Mask {
  const mask: Mask = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (let c = 0; c < cols; c++) {
    const center = Math.floor(rows / 2) + Math.round(Math.sin(c * 0.9) * amp);
    for (let d = -1; d <= 1; d++) {
      const r = center + d;
      if (r >= 0 && r < rows) mask[r][c] = true;
    }
  }
  return mask;
}

function bracketMask(h: number, w: number): Mask {
  const mask = Array.from({ length: h }, () => Array(w).fill(false));
  for (let r = 0; r < h; r++) {
    mask[r][0] = true;
    mask[r][w - 1] = true;
  }
  for (let c = 0; c < w; c++) {
    mask[0][c] = true;
    mask[h - 1][c] = true;
  }
  mask[0][0] = false;
  mask[0][w - 1] = false;
  mask[h - 1][0] = false;
  mask[h - 1][w - 1] = false;
  return mask;
}

function hourglassMask(size: number): Mask {
  const mask: Mask = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    const t = r < size / 2 ? r : size - 1 - r;
    const span = Math.max(1, Math.round((t / (size / 2)) * size));
    const start = Math.floor((size - span) / 2);
    for (let c = start; c < start + span; c++) mask[r][c] = true;
  }
  return mask;
}

function plusRingMask(size: number): Mask {
  return trimMask(
    crossMask(size, Math.max(1, Math.floor(size / 6))).map((row, r) =>
      row.map((v, c) => {
        if (!v) return false;
        const mid = Math.floor(size / 2);
        const edgeDist = Math.min(r, c, size - 1 - r, size - 1 - c);
        return edgeDist <= 1 || (r !== mid && c !== mid);
      })
    )
  );
}

const ASCII_TEMPLATES: { name: string; category: string; lines: string[] }[] = [
  {
    name: "Neon Heart",
    category: "Symbols",
    lines: [
      "..###...###..",
      ".####.#####.",
      ".##########.",
      ".##########.",
      "..########..",
      "...######...",
      "....####....",
      ".....##.....",
      "......#.....",
    ],
  },
  {
    name: "Circuit Star",
    category: "Symbols",
    lines: [
      "..#..",
      "..#..",
      "#####",
      "..#..",
      "..#..",
    ],
  },
  {
    name: "Arrowhead",
    category: "Symbols",
    lines: [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#..",
    ],
  },
  {
    name: "Lightning Bolt",
    category: "Symbols",
    lines: [
      "..##.",
      ".##..",
      "####.",
      "..##.",
      ".##..",
    ],
  },
  {
    name: "Crescent Moon",
    category: "Symbols",
    lines: [
      ".###.",
      "##...",
      "##...",
      ".###.",
      "..#..",
    ],
  },
  {
    name: "Paw Print",
    category: "Animals",
    lines: [
      "#...#",
      ".#.#.",
      "..#..",
      ".###.",
      ".###.",
    ],
  },
  {
    name: "Fish Silhouette",
    category: "Animals",
    lines: [
      "..##.",
      ".####",
      "#####",
      ".####",
      "..##.",
    ],
  },
  {
    name: "Butterfly Wings",
    category: "Animals",
    lines: [
      "#...#",
      "#####",
      "..#..",
      "#####",
      "#...#",
    ],
  },
  {
    name: "Tree Canopy",
    category: "Nature",
    lines: [
      "..#..",
      ".###.",
      "#####",
      "..#..",
      "..#..",
    ],
  },
  {
    name: "Snowflake",
    category: "Nature",
    lines: [
      ".#.#.",
      "..#..",
      "#####",
      "..#..",
      ".#.#.",
    ],
  },
  {
    name: "House Outline",
    category: "Objects",
    lines: [
      "..#..",
      ".###.",
      "#####",
      "#...#",
      "#...#",
    ],
  },
  {
    name: "Keyhole",
    category: "Objects",
    lines: [
      ".###.",
      "#...#",
      ".###.",
      "..#..",
      ".###.",
    ],
  },
  {
    name: "Crown",
    category: "Objects",
    lines: [
      "#.#.#",
      "#####",
      "#...#",
      "#...#",
      "#####",
    ],
  },
  {
    name: "Pizza Slice",
    category: "Food",
    lines: [
      "#####",
      ".####",
      "..###",
      "...##",
      "....#",
    ],
  },
  {
    name: "Cherry Pair",
    category: "Food",
    lines: [
      "#...#",
      ".#.#.",
      "..#..",
      "..#..",
      ".###.",
    ],
  },
  {
    name: "Rocket",
    category: "Space",
    lines: [
      "..#..",
      ".###.",
      ".###.",
      ".#.#.",
      "#...#",
    ],
  },
  {
    name: "UFO",
    category: "Space",
    lines: [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      ".#.#.",
    ],
  },
  {
    name: "Maze Corridor",
    category: "Maze",
    lines: [
      "#####",
      "#...#",
      "#.#.#",
      "#...#",
      "#####",
    ],
  },
  {
    name: "Spiral Gate",
    category: "Maze",
    lines: [
      "#####",
      "#..##",
      "#.#.#",
      "##..#",
      "#####",
    ],
  },
  {
    name: "Shamrock",
    category: "Nature",
    lines: [
      "#.#.#",
      ".###.",
      "..#..",
      "..#..",
      "..#..",
    ],
  },
];

const NAME_STEMS: { category: string; stems: string[] }[] = [
  {
    category: "Hearts",
    stems: [
      "Neon Heart",
      "Ember Heart",
      "Crystal Heart",
      "Shadow Heart",
      "Golden Heart",
      "Split Heart",
      "Twin Heart",
      "Pulse Heart",
      "Nova Heart",
      "Echo Heart",
      "Prism Heart",
      "Flux Heart",
      "Spark Heart",
      "Deep Heart",
      "Bright Heart",
      "Hollow Heart",
      "Bold Heart",
      "Soft Heart",
      "Wild Heart",
      "Core Heart",
    ],
  },
  {
    category: "Stars",
    stems: [
      "Circuit Star",
      "Nova Star",
      "Radiant Star",
      "Binary Star",
      "Polar Star",
      "Cyber Star",
      "Glow Star",
      "Sharp Star",
      "Wide Star",
      "Mini Star",
      "Grand Star",
      "Pulse Star",
      "Storm Star",
      "Clear Star",
      "Dark Star",
      "Super Star",
      "Twin Star",
      "Cross Star",
      "Neon Star",
      "Prime Star",
    ],
  },
  {
    category: "Diamonds",
    stems: [
      "Neon Diamond",
      "Ice Diamond",
      "Ruby Diamond",
      "Jade Diamond",
      "Onyx Diamond",
      "Wide Diamond",
      "Tall Diamond",
      "Thin Diamond",
      "Bold Diamond",
      "Lite Diamond",
      "Deep Diamond",
      "Bright Diamond",
      "Shadow Diamond",
      "Flux Diamond",
      "Core Diamond",
      "Split Diamond",
      "Twin Diamond",
      "Prime Diamond",
      "Echo Diamond",
      "Nova Diamond",
    ],
  },
  {
    category: "Crosses",
    stems: [
      "Neon Cross",
      "Bold Cross",
      "Thin Cross",
      "Plus Cross",
      "Signal Cross",
      "Core Cross",
      "Wide Cross",
      "Lite Cross",
      "Deep Cross",
      "Prime Cross",
      "Flux Cross",
      "Echo Cross",
      "Storm Cross",
      "Clear Cross",
      "Dark Cross",
      "Twin Cross",
      "Split Cross",
      "Cyber Cross",
      "Glow Cross",
      "Radiant Cross",
    ],
  },
  {
    category: "Rings",
    stems: [
      "Neon Ring",
      "Halo Ring",
      "Orbit Ring",
      "Pulse Ring",
      "Storm Ring",
      "Core Ring",
      "Wide Ring",
      "Thin Ring",
      "Bold Ring",
      "Lite Ring",
      "Deep Ring",
      "Bright Ring",
      "Shadow Ring",
      "Flux Ring",
      "Twin Ring",
      "Split Ring",
      "Prime Ring",
      "Echo Ring",
      "Nova Ring",
      "Cyber Ring",
    ],
  },
  {
    category: "Triangles",
    stems: [
      "Neon Triangle",
      "Peak Triangle",
      "Delta Triangle",
      "Wide Triangle",
      "Tall Triangle",
      "Sharp Triangle",
      "Soft Triangle",
      "Core Triangle",
      "Prime Triangle",
      "Echo Triangle",
      "Flux Triangle",
      "Storm Triangle",
      "Clear Triangle",
      "Dark Triangle",
      "Twin Triangle",
      "Split Triangle",
      "Cyber Triangle",
      "Glow Triangle",
      "Radiant Triangle",
      "Nova Triangle",
    ],
  },
  {
    category: "Spirals",
    stems: [
      "Neon Spiral",
      "Coil Spiral",
      "Vortex Spiral",
      "Pulse Spiral",
      "Storm Spiral",
      "Core Spiral",
      "Wide Spiral",
      "Tight Spiral",
      "Bold Spiral",
      "Lite Spiral",
      "Deep Spiral",
      "Bright Spiral",
      "Shadow Spiral",
      "Flux Spiral",
      "Twin Spiral",
      "Split Spiral",
      "Prime Spiral",
      "Echo Spiral",
      "Nova Spiral",
      "Cyber Spiral",
    ],
  },
  {
    category: "Waves",
    stems: [
      "Neon Wave",
      "Sine Wave",
      "Pulse Wave",
      "Storm Wave",
      "Core Wave",
      "Wide Wave",
      "Tight Wave",
      "Bold Wave",
      "Lite Wave",
      "Deep Wave",
      "Bright Wave",
      "Shadow Wave",
      "Flux Wave",
      "Twin Wave",
      "Split Wave",
      "Prime Wave",
      "Echo Wave",
      "Nova Wave",
      "Cyber Wave",
      "Glow Wave",
    ],
  },
  {
    category: "Chevrons",
    stems: [
      "Neon Chevron",
      "Arrow Chevron",
      "Pulse Chevron",
      "Storm Chevron",
      "Core Chevron",
      "Wide Chevron",
      "Tight Chevron",
      "Bold Chevron",
      "Lite Chevron",
      "Deep Chevron",
      "Bright Chevron",
      "Shadow Chevron",
      "Flux Chevron",
      "Twin Chevron",
      "Split Chevron",
      "Prime Chevron",
      "Echo Chevron",
      "Nova Chevron",
      "Cyber Chevron",
      "Glow Chevron",
    ],
  },
  {
    category: "Brackets",
    stems: [
      "Neon Bracket",
      "Frame Bracket",
      "Pulse Bracket",
      "Storm Bracket",
      "Core Bracket",
      "Wide Bracket",
      "Tight Bracket",
      "Bold Bracket",
      "Lite Bracket",
      "Deep Bracket",
      "Bright Bracket",
      "Shadow Bracket",
      "Flux Bracket",
      "Twin Bracket",
      "Split Bracket",
      "Prime Bracket",
      "Echo Bracket",
      "Nova Bracket",
      "Cyber Bracket",
      "Glow Bracket",
    ],
  },
  {
    category: "Hourglasses",
    stems: [
      "Neon Hourglass",
      "Time Hourglass",
      "Pulse Hourglass",
      "Storm Hourglass",
      "Core Hourglass",
      "Wide Hourglass",
      "Tight Hourglass",
      "Bold Hourglass",
      "Lite Hourglass",
      "Deep Hourglass",
      "Bright Hourglass",
      "Shadow Hourglass",
      "Flux Hourglass",
      "Twin Hourglass",
      "Split Hourglass",
      "Prime Hourglass",
      "Echo Hourglass",
      "Nova Hourglass",
      "Cyber Hourglass",
      "Glow Hourglass",
    ],
  },
  {
    category: "Ellipses",
    stems: [
      "Neon Ellipse",
      "Orbit Ellipse",
      "Pulse Ellipse",
      "Storm Ellipse",
      "Core Ellipse",
      "Wide Ellipse",
      "Tall Ellipse",
      "Bold Ellipse",
      "Lite Ellipse",
      "Deep Ellipse",
      "Bright Ellipse",
      "Shadow Ellipse",
      "Flux Ellipse",
      "Twin Ellipse",
      "Split Ellipse",
      "Prime Ellipse",
      "Echo Ellipse",
      "Nova Ellipse",
      "Cyber Ellipse",
      "Glow Ellipse",
    ],
  },
  {
    category: "Letters",
    stems: [
      "Letter A",
      "Letter B",
      "Letter C",
      "Letter D",
      "Letter E",
      "Letter F",
      "Letter G",
      "Letter H",
      "Letter I",
      "Letter J",
      "Letter K",
      "Letter L",
      "Letter M",
      "Letter N",
      "Letter O",
      "Letter P",
      "Letter Q",
      "Letter R",
      "Letter S",
      "Letter T",
    ],
  },
  {
    category: "Digits",
    stems: [
      "Digit Zero",
      "Digit One",
      "Digit Two",
      "Digit Three",
      "Digit Four",
      "Digit Five",
      "Digit Six",
      "Digit Seven",
      "Digit Eight",
      "Digit Nine",
      "Loop Zero",
      "Line One",
      "Zig Two",
      "Wave Three",
      "Grid Four",
      "Hook Five",
      "Curve Six",
      "Angle Seven",
      "Ring Eight",
      "Tail Nine",
    ],
  },
  {
    category: "Icons",
    stems: [
      "Bolt Icon",
      "Moon Icon",
      "Sun Icon",
      "Cloud Icon",
      "Leaf Icon",
      "Flame Icon",
      "Drop Icon",
      "Gear Icon",
      "Lock Icon",
      "Key Icon",
      "Bell Icon",
      "Flag Icon",
      "Gem Icon",
      "Coin Icon",
      "Shield Icon",
      "Sword Icon",
      "Bow Icon",
      "Wand Icon",
      "Mask Icon",
      "Crown Icon",
    ],
  },
];

const LETTER_MASKS: Record<string, Mask> = {
  A: parseAsciiMask([".#.", "#.#", "###", "#.#", "#.#"]),
  B: parseAsciiMask(["##.", "#.#", "##.", "#.#", "##."]),
  C: parseAsciiMask([".##", "#..", "#..", "#..", ".##"]),
  D: parseAsciiMask(["##.", "#.#", "#.#", "#.#", "##."]),
  E: parseAsciiMask(["###", "#..", "##.", "#..", "###"]),
  F: parseAsciiMask(["###", "#..", "##.", "#..", "#.."]),
  G: parseAsciiMask([".##", "#..", "#.#", "#.#", ".##"]),
  H: parseAsciiMask(["#.#", "#.#", "###", "#.#", "#.#"]),
  I: parseAsciiMask(["###", ".#.", ".#.", ".#.", "###"]),
  J: parseAsciiMask(["..#", "..#", "..#", "#.#", ".#."]),
  K: parseAsciiMask(["#.#", "#.#", "##.", "#.#", "#.#"]),
  L: parseAsciiMask(["#..", "#..", "#..", "#..", "###"]),
  M: parseAsciiMask(["#.#", "###", "#.#", "#.#", "#.#"]),
  N: parseAsciiMask(["#.#", "##.", "#.#", ".##", "#.#"]),
  O: parseAsciiMask([".##", "#.#", "#.#", "#.#", ".##"]),
  P: parseAsciiMask(["##.", "#.#", "##.", "#..", "#.."]),
  Q: parseAsciiMask([".##", "#.#", "#.#", ".##", "..#"]),
  R: parseAsciiMask(["##.", "#.#", "##.", "#.#", "#.#"]),
  S: parseAsciiMask([".##", "#..", ".#.", "..#", "##."]),
  T: parseAsciiMask(["###", ".#.", ".#.", ".#.", ".#."]),
};

const DIGIT_MASKS: Mask[] = [
  parseAsciiMask([".##.", "#..#", "#..#", "#..#", ".##."]),
  parseAsciiMask(["..#.", ".##", "..#.", "..#.", "####"]),
  parseAsciiMask([".##.", "#..#", "..#.", ".#..", "####"]),
  parseAsciiMask([".##.", "#..#", ".##.", "#..#", ".##."]),
  parseAsciiMask(["#..#", "#..#", "####", "...#", "...#"]),
  parseAsciiMask(["####", "#...", "####", "...#", "####"]),
  parseAsciiMask([".##.", "#...", "####", "#..#", ".##."]),
  parseAsciiMask(["####", "...#", "..#.", ".#..", ".#.."]),
  parseAsciiMask([".##.", "#..#", ".##.", "#..#", ".##."]),
  parseAsciiMask([".##.", "#..#", ".###", "...#", ".##."]),
];

function proceduralMask(index: number): Mask {
  const variant = index % 20;
  const size = 5 + (variant % 5);
  const type = Math.floor(index / 20) % 15;

  switch (type) {
    case 0:
      return ellipseMask(size + 1, size + (variant % 3), 0.38);
    case 1:
      return diamondMask(2 + (variant % 4));
    case 2:
      return crossMask(size + 2, 1 + (variant % 3));
    case 3:
      return ringMask(size + 3, 1 + (variant % 2));
    case 4:
      return triangleMask(size + 1, size + 2, variant % 2 === 0);
    case 5:
      return spiralBandMask(size + 2);
    case 6:
      return zigzagMask(size + 2, size + 4, 1 + (variant % 3));
    case 7:
      return chevronMask(size + 3, 2 + (variant % 3));
    case 8:
      return bracketMask(size + 2, size + 3);
    case 9:
      return hourglassMask(size + 2);
    case 10:
      return plusRingMask(size + 3);
    case 11: {
      const letter = "ABCDEFGHIJKLMNOPQRST"[variant];
      return LETTER_MASKS[letter] ?? diamondMask(3);
    }
    case 12:
      return DIGIT_MASKS[variant % 10];
    case 13:
      return trimMask(
        filledRect(size + 2, size + 3).map((row, r) =>
          row.map((_, c) => (r === 0 || r === size + 1 || c === 0 || c === size + 2))
        )
      );
    default:
      return ellipseMask(size + 2, size + 1, 0.5);
  }
}

function buildBoardShapeCatalog(): BoardShape[] {
  const shapes: BoardShape[] = [];
  let id = 1;

  const pushShape = (name: string, category: string, mask: Mask) => {
    if (shapes.length >= 300) return;
    for (let attempt = 0; attempt < 12; attempt++) {
      const variant =
        attempt === 0 ? mask : mirrorMaskH(rotateMaskCW(proceduralMask(id + attempt)));
      const built = shapeFromMask(id, name, category, variant);
      if (built) {
        shapes.push({ ...built, id: id++ });
        return;
      }
    }
  };

  for (const tpl of ASCII_TEMPLATES) {
    pushShape(tpl.name, tpl.category, parseAsciiMask(tpl.lines));
    pushShape(`${tpl.name} Turned`, tpl.category, rotateMaskCW(parseAsciiMask(tpl.lines)));
  }

  for (const group of NAME_STEMS) {
    for (const stem of group.stems) {
      if (shapes.length >= 300) break;
      pushShape(stem, group.category, proceduralMask(shapes.length + id));
    }
  }

  let filler = 0;
  while (shapes.length < 300 && filler < 600) {
    const idx = shapes.length;
    pushShape(
      `Variant Silhouette ${idx + 1}`,
      "Variants",
      proceduralMask(idx + filler * 3)
    );
    filler++;
  }

  return shapes.slice(0, 300);
}

export const BOARD_SHAPE_COUNT = 300;
export const BOARD_SHAPES: BoardShape[] = buildBoardShapeCatalog();

export function isSpecialShapeLevel(levelId: number): boolean {
  return levelId > 0 && levelId % 5 === 0;
}

/** Levels 5, 10, 15 … cycle through all 300 shapes (upscaled for density). */
export function getBoardShapeForLevel(levelId: number): BoardShape {
  const slot = Math.floor(levelId / 5) - 1;
  const index = ((slot % BOARD_SHAPE_COUNT) + BOARD_SHAPE_COUNT) % BOARD_SHAPE_COUNT;
  return prepareSpecialShape(BOARD_SHAPES[index]);
}

export function activeCellSetFromShape(shape: BoardShape): Set<string> {
  return new Set(shape.cells.map((c) => shapeCellKey(c.row, c.col)));
}

export function fullRectCellSet(rows: number, cols: number): Set<string> {
  const set = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) set.add(shapeCellKey(r, c));
  }
  return set;
}

/** Human-readable list of all 300 shape names (for UI / debug). */
export function getBoardShapeNameList(): string[] {
  return BOARD_SHAPES.map((s) => s.name);
}
