import type { Incident } from "../types";

interface IncidentListProps {
  incidents: Incident[];
  isOpen: boolean;
  onToggle: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryColor(category: string | null): string {
  if (!category) return "#888";
  const c = category.toLowerCase();
  if (c.includes("trafikk")) return "#3498db";
  if (c.includes("brann")) return "#e74c3c";
  if (c.includes("vold")) return "#e74c3c";
  if (c.includes("innbrudd") || c.includes("tyveri")) return "#f39c12";
  if (c.includes("narkotika")) return "#9b59b6";
  if (c.includes("orden")) return "#e67e22";
  if (c.includes("ulykke")) return "#c0392b";
  if (c.includes("skadeverk")) return "#d35400";
  return "#888";
}

export default function IncidentList({ incidents, isOpen, onToggle }: IncidentListProps) {
  return (
    <div className={`incident-list ${isOpen ? "open" : ""}`}>
      <button className="list-toggle" onClick={onToggle} aria-label="Toggle incident list">
        <span className="list-count">{incidents.length}</span>
        Hendelser
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={isOpen ? "chevron-up" : "chevron-down"}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      {isOpen && (
        <div className="incident-scroll">
          {incidents.length === 0 ? (
            <div className="empty-state">Ingen hendelser funnet</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="incident-card">
                <div className="incident-header">
                  {inc.category && (
                    <span
                      className="incident-badge"
                      style={{ backgroundColor: categoryColor(inc.category) }}
                    >
                      {inc.category}
                    </span>
                  )}
                  <span className="incident-time">{formatDate(inc.utcDateTime)}</span>
                </div>
                <div className="incident-title">{inc.title}</div>
                {inc.description && (
                  <div className="incident-desc">{inc.description}</div>
                )}
                <div className="incident-location">
                  {[inc.area, inc.municipality].filter(Boolean).join(", ")}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
