import type { ArchNodeKind } from "../../lib/architecture/types";

// Minimalist line-art glyphs, one per node kind. Each is drawn centered on
// (cx, cy) within a square of side `size`, stroked in the given theme color so
// it sits naturally inside the card nodes alongside ER/BPMN visuals.

interface IconProps {
  kind: ArchNodeKind;
  cx: number;
  cy: number;
  size?: number;
  color: string;
}

export function ArchIcon({ kind, cx, cy, size = 22, color }: IconProps) {
  const h = size / 2;
  const L = cx - h;
  const R = cx + h;
  const T = cy - h;
  const B = cy + h;
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  switch (kind) {
    case "database": {
      const ry = size * 0.16;
      return (
        <g {...common}>
          <ellipse cx={cx} cy={T + ry} rx={h} ry={ry} />
          <path d={`M ${L} ${T + ry} L ${L} ${B - ry}`} />
          <path d={`M ${R} ${T + ry} L ${R} ${B - ry}`} />
          <path d={`M ${L} ${B - ry} A ${h} ${ry} 0 0 0 ${R} ${B - ry}`} />
          <path d={`M ${L} ${cy} A ${h} ${ry} 0 0 0 ${R} ${cy}`} />
        </g>
      );
    }
    case "queue":
      return (
        <g {...common}>
          <line x1={L + size * 0.15} y1={T} x2={L + size * 0.15} y2={B} />
          <line x1={cx} y1={T} x2={cx} y2={B} />
          <line x1={R - size * 0.15} y1={T} x2={R - size * 0.15} y2={B} />
        </g>
      );
    case "cache":
      return (
        <g {...common}>
          <path d={`M ${cx + h * 0.3} ${T} L ${L + size * 0.2} ${cy + size * 0.05} L ${cx} ${cy + size * 0.05} L ${cx - h * 0.3} ${B} L ${R - size * 0.2} ${cy - size * 0.05} L ${cx} ${cy - size * 0.05} Z`} />
        </g>
      );
    case "gateway": {
      const pts = `${cx},${T} ${R},${cy - h * 0.5} ${R},${cy + h * 0.5} ${cx},${B} ${L},${cy + h * 0.5} ${L},${cy - h * 0.5}`;
      return (
        <g {...common}>
          <polygon points={pts} />
        </g>
      );
    }
    case "storage":
      return (
        <g {...common}>
          <ellipse cx={cx} cy={T + size * 0.16} rx={h} ry={size * 0.16} />
          <path d={`M ${L} ${T + size * 0.16} L ${L} ${B - size * 0.16}`} />
          <path d={`M ${R} ${T + size * 0.16} L ${R} ${B - size * 0.16}`} />
          <ellipse cx={cx} cy={cy} rx={h} ry={size * 0.16} />
          <path d={`M ${L} ${B - size * 0.16} A ${h} ${size * 0.16} 0 0 0 ${R} ${B - size * 0.16}`} />
        </g>
      );
    case "external":
      return (
        <g {...common}>
          <path
            d={`M ${L + size * 0.18} ${B - size * 0.1}
               a ${size * 0.2} ${size * 0.2} 0 0 1 ${size * 0.04} ${-size * 0.38}
               a ${size * 0.26} ${size * 0.26} 0 0 1 ${size * 0.5} ${-size * 0.06}
               a ${size * 0.18} ${size * 0.18} 0 0 1 ${size * 0.04} ${size * 0.45}
               Z`}
          />
        </g>
      );
    case "user":
    case "person":
      return (
        <g {...common}>
          <circle cx={cx} cy={T + size * 0.26} r={size * 0.22} />
          <path d={`M ${L + size * 0.12} ${B} a ${h - size * 0.12} ${size * 0.42} 0 0 1 ${size - size * 0.24} 0`} />
        </g>
      );
    case "container":
      return (
        <g {...common}>
          <rect x={L} y={T} width={size} height={size} rx={2} />
          <line x1={L} y1={T + size * 0.3} x2={R} y2={T + size * 0.3} />
        </g>
      );
    case "component":
      return (
        <g {...common}>
          <rect x={L + size * 0.18} y={T + size * 0.1} width={size * 0.7} height={size * 0.8} rx={1} />
          <rect x={L} y={T + size * 0.28} width={size * 0.28} height={size * 0.16} />
          <rect x={L} y={T + size * 0.56} width={size * 0.28} height={size * 0.16} />
        </g>
      );
    case "system":
    case "service":
    default:
      return (
        <g {...common}>
          <rect x={L} y={T} width={size} height={size} rx={3} />
          {kind === "service" && <circle cx={cx} cy={cy} r={size * 0.18} />}
        </g>
      );
  }
}
