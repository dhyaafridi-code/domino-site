// Flat, true-2D domino board (PlayDrift style). No canvas, no camera, no
// lighting — always 100% bright. The chain is laid out with exact pixel
// coordinates (see chainLayout) so tiles snap flush edge-to-edge with zero gap
// and zero overlap, doubles sit crosswise on the centreline, and the run bends
// to a new row when it reaches the measured board edge. Glowing dropzones mark
// the valid open ends when the local player has a tile selected.
import { useEffect, useMemo, useRef, useState } from "react";
import { DominoTile } from "@/components/domino-tile";
import { computeChainLayout } from "./chainLayout";
import type { BoardTile, Tile, Side } from "@/lib/domino/engine";

export interface Board2DProps {
  board: BoardTile[];
  leftEnd: number | null;
  rightEnd: number | null;
  selectedTile: Tile | null;
  isMyTurn: boolean;
  canPlayLeft: boolean;
  canPlayRight: boolean;
  onPlace: (side: Side) => void;
}

// Horizontal padding kept clear of the board edges when wrapping the chain.
const EDGE_PADDING = 40;

export function Board2D({
  board,
  selectedTile,
  isMyTurn,
  canPlayLeft,
  canPlayRight,
  onPlace,
}: Board2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(800);

  // Track the board's usable width so the chain bends at the real edge.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setMaxWidth(Math.max(160, el.clientWidth - EDGE_PADDING));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showZones = isMyTurn && selectedTile !== null;
  const selectedIsDouble = !!selectedTile && selectedTile[0] === selectedTile[1];

  const layout = useMemo(
    () =>
      computeChainLayout(board, maxWidth, {
        showZones,
        selectedIsDouble,
        canPlayLeft,
        canPlayRight,
      }),
    [board, maxWidth, showZones, selectedIsDouble, canPlayLeft, canPlayRight],
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-auto scrollbar-thin bg-[#2b3444]">
      {/* min-h-full keeps a tall chain scrollable while still centring a short
          one (grid place-items-center + overflow alone would clip the top). */}
      <div className="grid min-h-full w-full place-items-center p-5">
        <div className="relative shrink-0" style={{ width: layout.width, height: layout.height }}>
          {layout.tiles.map((t) => (
            <div
              key={t.key}
              className="absolute"
              style={{ left: t.left, top: t.top, width: t.width, height: t.height }}
            >
              <DominoTile values={t.values} orientation={t.vertical ? "v" : "h"} fill />
            </div>
          ))}

          {layout.dropzones.map((d, i) => (
            <button
              key={`${d.side}-${i}`}
              type="button"
              aria-label={`place on ${d.side}`}
              onClick={() => onPlace(d.side)}
              className="tokio-dropzone absolute rounded-xl"
              style={{ left: d.left, top: d.top, width: d.width, height: d.height }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
