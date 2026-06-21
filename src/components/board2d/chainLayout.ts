// Pure geometry for the 2D domino chain — no React, no DOM.
//
// True L-corner serpentine ("snake") layout. A turtle walks the chain holding a
// live heading (East/West) and an open connection point. Each tile is placed
// FLUSH against the previous one (0 gap, 0 overlap by construction). When the
// next tile would cross the board edge, the turtle turns 90°: it drops a single
// vertical corner tile flush to the edge — exactly one lane tall — then reverses
// horizontal heading and continues in the lane below. Doubles inside a run are
// laid crosswise on the lane centreline; a double that happens to land on a
// corner is rendered inline-vertical so the corner geometry stays exact.
import type { BoardTile, Tile, Side } from "@/lib/domino/engine";

// Strict 1:2 rectangle. Long side is exactly twice the short side.
export const TILE_W = 44; // short side (px)
export const TILE_L = TILE_W * 2; // long side (px)

export interface ChainRect {
  left: number;
  top: number;
  width: number;
  height: number;
  vertical: boolean; // true = rendered crosswise / rotated (W×L)
}
export interface ChainTile extends ChainRect {
  key: string;
  values: Tile;
}
export interface ChainDrop extends ChainRect {
  side: Side;
}
export interface ChainLayout {
  tiles: ChainTile[];
  dropzones: ChainDrop[];
  width: number;
  height: number;
}

export interface ChainOpts {
  showZones: boolean;
  selectedIsDouble: boolean;
  canPlayLeft: boolean;
  canPlayRight: boolean;
}

type Dir = "E" | "W";

interface Cursor {
  px: number; // open connection point x (edge-centre of last tile)
  py: number; // open connection point y
  dir: Dir;
}

interface StepResult {
  rect: ChainRect;
  next: Cursor;
}

// Place one tile of the given kind at the cursor, turning a 90° corner if it
// would not fit in the current lane. Pure: returns the tile rect plus the new
// cursor (open end + heading) for whatever comes next.
function step(cur: Cursor, isDouble: boolean, maxWidth: number): StepResult {
  const fp = isDouble ? TILE_W : TILE_L; // footprint along the run direction
  const { px, py, dir } = cur;

  if (dir === "E") {
    if (px + fp <= maxWidth) {
      // Straight run east: left edge attaches at px, grows right.
      const w = fp;
      const h = isDouble ? TILE_L : TILE_W;
      return {
        rect: { left: px, top: py - h / 2, width: w, height: h, vertical: isDouble },
        next: { px: px + fp, py, dir: "E" },
      };
    }
    // Turn: vertical corner flush to the right edge, dropping one lane, then west.
    const rect: ChainRect = {
      left: px,
      top: py - TILE_W / 2,
      width: TILE_W,
      height: TILE_L,
      vertical: true,
    };
    // New lane centreline sits one tile-length below; next attaches on the right.
    return { rect, next: { px: px + TILE_W, py: py + TILE_L, dir: "W" } };
  }

  // dir === "W"
  if (px - fp >= 0) {
    const w = fp;
    const h = isDouble ? TILE_L : TILE_W;
    return {
      rect: { left: px - w, top: py - h / 2, width: w, height: h, vertical: isDouble },
      next: { px: px - fp, py, dir: "W" },
    };
  }
  // Turn: vertical corner flush to the left edge, dropping one lane, then east.
  const rect: ChainRect = {
    left: px - TILE_W,
    top: py - TILE_W / 2,
    width: TILE_W,
    height: TILE_L,
    vertical: true,
  };
  return { rect, next: { px: px - TILE_W, py: py + TILE_L, dir: "E" } };
}

// Shift every rect so the bounding box starts at (0,0) and report its size.
function normalize(rects: ChainRect[]): { width: number; height: number } {
  if (rects.length === 0) return { width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.left + r.width);
    maxY = Math.max(maxY, r.top + r.height);
  }
  for (const r of rects) {
    r.left -= minX;
    r.top -= minY;
  }
  return { width: maxX - minX, height: maxY - minY };
}

export function computeChainLayout(
  board: BoardTile[],
  maxWidth: number,
  opts: ChainOpts,
): ChainLayout {
  // A lane must fit at least one long tile plus a corner tile.
  const usableW = Math.max(TILE_L + TILE_W, maxWidth);

  // Walk the chain, turning corners at the edges.
  const tiles: ChainTile[] = [];
  let cur: Cursor = { px: 0, py: 0, dir: "E" };
  for (let i = 0; i < board.length; i++) {
    const isDouble = board[i].tile[0] === board[i].tile[1];
    const { rect, next } = step(cur, isDouble, usableW);
    tiles.push({
      key: `${i}-${board[i].tile[0]}-${board[i].tile[1]}`,
      values: board[i].tile,
      ...rect,
    });
    cur = next;
  }

  // Dropzones at the two open ends, sized/oriented to the tile about to drop.
  const drops: ChainDrop[] = [];
  if (opts.showZones) {
    const sd = opts.selectedIsDouble;
    if (board.length === 0) {
      // Opening move: one centred target at the origin.
      const w = sd ? TILE_W : TILE_L;
      const h = sd ? TILE_L : TILE_W;
      drops.push({ side: "right", left: -w / 2, top: -h / 2, width: w, height: h, vertical: sd });
    } else {
      // Forward end (chain grows here → engine "right"): reuse the walker so the
      // target lands exactly where the next tile would, corner included.
      if (opts.canPlayRight) {
        const { rect } = step(cur, sd, usableW);
        drops.push({ side: "right", ...rect });
      }
      // Back end (engine "left"): flush before the first tile, opposite heading.
      if (opts.canPlayLeft) {
        const first = tiles[0];
        const w = sd ? TILE_W : TILE_L;
        const h = sd ? TILE_L : TILE_W;
        const cy = first.top + first.height / 2;
        drops.push({
          side: "left",
          left: first.left - w,
          top: cy - h / 2,
          width: w,
          height: h,
          vertical: sd,
        });
      }
    }
  }

  const { width, height } = normalize([...tiles, ...drops]);
  return { tiles, dropzones: drops, width, height };
}
