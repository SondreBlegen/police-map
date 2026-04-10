import type { Stats } from "../types";

interface StatsBarProps {
  stats: Stats | null;
}

export default function StatsBar({ stats }: StatsBarProps) {
  if (!stats) return null;

  const lastFetch = stats.lastFetch
    ? new Date(stats.lastFetch).toLocaleString("nb-NO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Aldri";

  return (
    <div className="stats-bar">
      <span>{stats.total} hendelser</span>
      <span className="stats-separator">|</span>
      <span>{stats.geolocated} kartfestet</span>
      <span className="stats-separator">|</span>
      <span>Sist oppdatert: {lastFetch}</span>
    </div>
  );
}
