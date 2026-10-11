/** "just now", "5 min ago", "2h ago", "yesterday", "3d ago", or a date. */
export function ago(ts: number | undefined, now = Date.now()): string {
  if (!ts) return "never run";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** 1234 → "1.2s", 65000 → "1m 05s". */
export function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
