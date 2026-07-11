import { useSyncExternalStore } from "react";
import type { TransformStore } from "../../hooks/useViewTransform";

interface MiniMapViewportProps {
  store: TransformStore;
  svgWidth: number;
  svgHeight: number;
  /** Diagram → minimap scale factor. */
  scale: number;
  accent: string;
}

/**
 * The viewport indicator rect, isolated so it is the only element that
 * re-renders per animation frame while the camera moves.
 */
export function MiniMapViewport({
  store,
  svgWidth,
  svgHeight,
  scale,
  accent,
}: MiniMapViewportProps) {
  const t = useSyncExternalStore(store.subscribe, store.getTransform);

  const viewX = -t.x / t.scale;
  const viewY = -t.y / t.scale;
  const viewW = svgWidth / t.scale;
  const viewH = svgHeight / t.scale;

  return (
    <rect
      x={viewX * scale}
      y={viewY * scale}
      width={viewW * scale}
      height={viewH * scale}
      fill={accent}
      fillOpacity={0.15}
      stroke={accent}
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}
