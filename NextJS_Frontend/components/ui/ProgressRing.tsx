import { cn } from "@/lib/utils";

export interface ProgressRingProps {
  /** 0–100 percentage. Values are clamped. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke width in px. */
  strokeWidth?: number;
  /** Ring color. Defaults to the mint accent; pass a CSS var/color for status. */
  color?: string;
  /** Track (background ring) color. */
  trackColor?: string;
  /** Center label. Defaults to `${value}%`. Pass null to hide. */
  label?: React.ReactNode;
  /** Small caption under the value. */
  caption?: string;
  className?: string;
}

/**
 * SVG progress ring for percentage KPIs (SLA %, Answer %, Utilization %).
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 10,
  color = "var(--accent)",
  trackColor = "var(--surface-muted)",
  label,
  caption,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      {label !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-ink">
            {label ?? `${Math.round(clamped)}%`}
          </span>
          {caption && (
            <span className="mt-0.5 text-[10px] font-medium text-ink-subtle">
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
