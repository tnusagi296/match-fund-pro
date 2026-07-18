import { useEffect, useState } from "react";

type Props = {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  animate?: boolean;
};

export function ScoreRing({
  value,
  size = 180,
  stroke = 10,
  label,
  sublabel,
  color = "var(--mint)",
  animate = true,
}: Props) {
  const [v, setV] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setV(value), 60);
    return () => clearTimeout(t);
  }, [value, animate]);

  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (v / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="oklch(1 0 0 / 0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#grad-${label})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          fill="none"
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="tabular text-4xl font-semibold leading-none">{Math.round(v)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">/100</div>
        {sublabel && (
          <div className="mt-1 text-xs font-medium" style={{ color }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreBar({
  label,
  value,
  color = "var(--mint)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}, ${color}80)` }}
        />
      </div>
    </div>
  );
}

export function DotBar({ value }: { value: number }) {
  // 0-100 → 5 dots
  const filled = Math.round((value / 100) * 5);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-4 rounded-full"
          style={{ background: i < filled ? "var(--mint)" : "oklch(1 0 0 / 0.1)" }}
        />
      ))}
    </div>
  );
}
