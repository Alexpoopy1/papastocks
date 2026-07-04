"use client";

export default function Sparkline({ data = [], up = true, width = 72, height = 34, fluid = false }) {
  if (!data || data.length < 2) return <svg width={fluid ? undefined : width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <svg
      {...(fluid
        ? { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", style: { width: "100%", height } }
        : { width, height, style: { flex: "none" } })}
      aria-hidden="true"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
