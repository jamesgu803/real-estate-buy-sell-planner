"use client";

import { useRef, useState } from "react";
import { STRATEGY_LABEL, type StrategyComparison, type StrategyKey } from "@/lib/engine";
import { compact, money } from "@/lib/format";

export const STRATEGY_ORDER: StrategyKey[] = ["hold", "sell", "exchange", "stepUp"];
const SERIES_VAR: Record<StrategyKey, string> = {
  hold: "var(--series-1)",
  sell: "var(--series-2)",
  exchange: "var(--series-3)",
  stepUp: "var(--series-4)",
};

const SHORT: Record<StrategyKey, string> = { hold: "Hold", sell: "Sell", exchange: "1031", stepUp: "Step-up" };

const W = 720;
const H = 300;
const PAD = { top: 16, right: 116, bottom: 32, left: 64 };
const LABEL_GAP = 16;

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

/** Spread end-of-line labels so they never overlap, keeping each near its line. */
function placeLabels(ys: { key: StrategyKey; y: number }[]): Record<StrategyKey, number> {
  const sorted = ys.toSorted((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < LABEL_GAP) sorted[i] = { ...sorted[i], y: sorted[i - 1].y + LABEL_GAP };
  }
  const overflow = sorted.at(-1)!.y - (H - PAD.bottom);
  if (overflow > 0) for (const s of sorted) s.y -= overflow;
  return Object.fromEntries(sorted.map((s) => [s.key, s.y])) as Record<StrategyKey, number>;
}

export function StrategyChart({ comparison }: { comparison: StrategyComparison }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const { years, series } = comparison;

  const all = STRATEGY_ORDER.flatMap((k) => series[k]);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all));
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const x = (i: number) => PAD.left + (i / (years.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const last = years.length - 1;
  const labelY = placeLabels(STRATEGY_ORDER.map((key) => ({ key, y: y(series[key][last]) })));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * last);
    setHover(i >= 0 && i <= last ? i : null);
  }

  const tooltipLeft = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <figure className="chart">
      <div className="chart-legend" aria-hidden>
        {STRATEGY_ORDER.map((k) => (
          <span key={k} className="legend-item">
            <svg width="18" height="8">
              <line x1="1" y1="4" x2="17" y2="4" stroke={SERIES_VAR[k]} strokeWidth="2" strokeLinecap="round" strokeDasharray={k === "stepUp" ? "4 3" : undefined} />
            </svg>
            {STRATEGY_LABEL[k]}
          </span>
        ))}
      </div>
      <div className="chart-plot">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`After-tax wealth by strategy over ${last} years`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis-zero" : "gridline"} />
              <text x={PAD.left - 10} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {compact(t)}
              </text>
            </g>
          ))}
          {years.map((yr, i) =>
            i % (years.length > 12 ? 5 : 2) === 0 || i === last ? (
              <text key={yr} x={x(i)} y={H - PAD.bottom + 20} className="axis-label" textAnchor="middle">
                {yr === 0 ? "Today" : `Yr ${yr}`}
              </text>
            ) : null,
          )}

          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}

          {STRATEGY_ORDER.map((k) => (
            <polyline
              key={k}
              fill="none"
              stroke={SERIES_VAR[k]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={k === "stepUp" ? "6 5" : undefined}
              points={series[k].map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          ))}

          {hover !== null &&
            STRATEGY_ORDER.map((k) => (
              <circle key={k} cx={x(hover)} cy={y(series[k][hover])} r="4.5" fill={SERIES_VAR[k]} className="marker" />
            ))}

          {STRATEGY_ORDER.map((k) => (
            <g key={k}>
              <circle cx={x(last)} cy={y(series[k][last])} r="3" fill={SERIES_VAR[k]} />
              <text x={x(last) + 10} y={labelY[k]} className="end-label" dominantBaseline="middle">
                <tspan className="end-label-value">{compact(series[k][last])}</tspan>
                <tspan dx="6">{SHORT[k]}</tspan>
              </text>
            </g>
          ))}
        </svg>

        {hover !== null && (
          <div className={`tooltip${tooltipLeft > 55 ? " tooltip-left" : ""}`} style={{ left: `${tooltipLeft}%` }}>
            <p className="tooltip-title">{hover === 0 ? "Today" : `Year ${hover}`}</p>
            {STRATEGY_ORDER.toSorted((a, b) => series[b][hover] - series[a][hover]).map((k) => (
              <p key={k} className="tooltip-row">
                <span className="swatch" style={{ background: SERIES_VAR[k] }} />
                <span>{STRATEGY_LABEL[k]}</span>
                <span className="tooltip-value">{money(series[k][hover])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <figcaption className="muted small">
        After-tax wealth if the position were liquidated in each year: sale proceeds net of debt and tax, plus reinvested
        cash flow. The step-up path assumes the property passes at death with a basis reset (estate tax not modeled).
      </figcaption>
    </figure>
  );
}
