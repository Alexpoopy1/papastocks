export function fmtPrice(n) {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtChange(n, pct) {
  if (n == null || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmtPrice(n)} (${sign}${(pct ?? 0).toFixed(2)}%)`;
}

export function fmtPct(pct) {
  if (pct == null || isNaN(pct)) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function fmtBig(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts * 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
