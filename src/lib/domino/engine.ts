// Pure domino game engine for Tokio. No I/O.

export type Tile = [number, number];
export type Style = "all-fives" | "block";
export type Side = "left" | "right";

export type BoardTile = { tile: Tile; orientation: "h" | "v" };

export interface GameSnapshot {
  board: BoardTile[];
  leftEnd: number | null;
  rightEnd: number | null;
  hands: Record<number, Tile[]>;
  boneYard: Tile[];
  turnSeat: number;
  passesInRow: number;
  scores: Record<number, number>;
  seats: number[]; // active seats e.g. [0,1,2,3]
  style: Style;
  roundNumber: number;
  winnerSeat: number | null;
}

export function buildDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) deck.push([a, b]);
  }
  return deck;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealHandSize(_numPlayers: number): number {
  // Tokio always deals a fixed 7 tiles to every player at the start of a round.
  return 7;
}

export function tileEquals(a: Tile, b: Tile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

export function tileValue(t: Tile): number {
  return t[0] + t[1];
}

export function startingSeat(hands: Record<number, Tile[]>): number {
  // Highest double, else highest tile value
  let bestSeat = -1;
  let bestDoubleVal = -1;
  let bestAnyVal = -1;
  let bestAnySeat = -1;
  for (const [seatStr, hand] of Object.entries(hands)) {
    const seat = Number(seatStr);
    for (const t of hand) {
      const v = tileValue(t);
      if (t[0] === t[1] && t[0] > bestDoubleVal) {
        bestDoubleVal = t[0];
        bestSeat = seat;
      }
      if (v > bestAnyVal) {
        bestAnyVal = v;
        bestAnySeat = seat;
      }
    }
  }
  return bestSeat >= 0 ? bestSeat : bestAnySeat;
}

export function canPlay(hand: Tile[], leftEnd: number | null, rightEnd: number | null): boolean {
  if (leftEnd === null) return hand.length > 0;
  return hand.some(
    (t) => t[0] === leftEnd || t[1] === leftEnd || t[0] === rightEnd || t[1] === rightEnd,
  );
}

export function tileMatchesSide(tile: Tile, end: number | null): boolean {
  if (end === null) return true;
  return tile[0] === end || tile[1] === end;
}

export interface PlaceResult {
  newBoard: BoardTile[];
  newLeft: number;
  newRight: number;
  scored: number; // for all-fives
}

export function placeTile(
  snapshot: { board: BoardTile[]; leftEnd: number | null; rightEnd: number | null; style: Style },
  tile: Tile,
  side: Side,
): PlaceResult | null {
  const { board, leftEnd, rightEnd, style } = snapshot;
  if (board.length === 0) {
    const newTile: BoardTile = { tile, orientation: tile[0] === tile[1] ? "v" : "h" };
    const ends = [tile[0], tile[1]];
    return {
      newBoard: [newTile],
      newLeft: ends[0],
      newRight: ends[1],
      scored: style === "all-fives" && (ends[0] + ends[1]) % 5 === 0 ? ends[0] + ends[1] : 0,
    };
  }
  const isDouble = tile[0] === tile[1];
  if (side === "left") {
    if (leftEnd === null) return null;
    if (!tileMatchesSide(tile, leftEnd)) return null;
    const orientedLeft: Tile = tile[1] === leftEnd ? [tile[0], tile[1]] : [tile[1], tile[0]];
    const newTile: BoardTile = { tile: orientedLeft, orientation: isDouble ? "v" : "h" };
    const newBoard = [newTile, ...board];
    const newLeft = orientedLeft[0];
    const scored = computeAllFivesScore(newBoard, newLeft, rightEnd!, style);
    return { newBoard, newLeft, newRight: rightEnd!, scored };
  } else {
    if (rightEnd === null) return null;
    if (!tileMatchesSide(tile, rightEnd)) return null;
    const orientedRight: Tile = tile[0] === rightEnd ? [tile[0], tile[1]] : [tile[1], tile[0]];
    const newTile: BoardTile = { tile: orientedRight, orientation: isDouble ? "v" : "h" };
    const newBoard = [...board, newTile];
    const newRight = orientedRight[1];
    const scored = computeAllFivesScore(newBoard, leftEnd!, newRight, style);
    return { newBoard, newLeft: leftEnd!, newRight, scored };
  }
}

function computeAllFivesScore(
  board: BoardTile[],
  leftEnd: number,
  rightEnd: number,
  style: Style,
): number {
  if (style !== "all-fives") return 0;
  // For doubles at the ends, count the whole tile (both sides) per common rule
  const first = board[0];
  const last = board[board.length - 1];
  const leftVal = first.tile[0] === first.tile[1] ? first.tile[0] * 2 : leftEnd;
  const rightVal =
    board.length === 1 ? 0 : last.tile[0] === last.tile[1] ? last.tile[0] * 2 : rightEnd;
  // Single tile on board: sum both ends
  const total =
    board.length === 1
      ? first.tile[0] === first.tile[1]
        ? first.tile[0] * 2
        : first.tile[0] + first.tile[1]
      : leftVal + rightVal;
  return total % 5 === 0 ? total : 0;
}

export function handSum(hand: Tile[]): number {
  return hand.reduce((s, t) => s + tileValue(t), 0);
}

export interface BotMove {
  tile: Tile;
  side: Side;
  result: PlaceResult;
}

/**
 * Decide the best move for an AI bot by analysing every legal placement of
 * every tile in hand. Heuristic, in priority order:
 *   1. Maximise the score earned this move (matters for All‑Fives).
 *   2. Shed the heaviest tile, so the bot is left holding fewer pips.
 *   3. Play doubles early — they are the hardest tiles to get rid of later.
 * Returns `null` when the bot has no legal move (it must then draw or pass).
 */
export function chooseBotMove(
  hand: Tile[],
  snapshot: { board: BoardTile[]; leftEnd: number | null; rightEnd: number | null; style: Style },
): BotMove | null {
  const sides: Side[] = snapshot.board.length === 0 ? ["right"] : ["left", "right"];
  let best: BotMove | null = null;

  for (const tile of hand) {
    for (const side of sides) {
      const result = placeTile(snapshot, tile, side);
      if (!result) continue;
      const candidate: BotMove = { tile, side, result };
      if (!best || rankBotMove(candidate) > rankBotMove(best)) best = candidate;
    }
  }
  return best;
}

function rankBotMove(move: BotMove): number {
  const isDouble = move.tile[0] === move.tile[1] ? 1 : 0;
  // Weighted sum keeps the three heuristics strictly ordered:
  // score dominates, then tile weight, then the double tie‑breaker.
  return move.result.scored * 1000 + tileValue(move.tile) * 10 + isDouble;
}

export function nextSeat(currentSeat: number, seats: number[]): number {
  const idx = seats.indexOf(currentSeat);
  return seats[(idx + 1) % seats.length];
}
