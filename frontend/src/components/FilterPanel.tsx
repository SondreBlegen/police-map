import type { Filters } from "../types";

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  districts: string[];
  categories: string[];
  onRefresh: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function FilterPanel({
  filters,
  onChange,
  districts,
  categories,
  onRefresh,
  isOpen,
  onToggle,
}: FilterPanelProps) {
  return (
    <div className={`filter-panel ${isOpen ? "open" : ""}`}>
      <button className="filter-toggle" onClick={onToggle} aria-label="Toggle filters">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M2 5h16M5 10h10M8 15h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Filter
      </button>

      {isOpen && (
        <div className="filter-content">
          <div className="filter-group">
            <label htmlFor="district-select">Distrikt</label>
            <select
              id="district-select"
              value={filters.district}
              onChange={(e) => onChange({ ...filters, district: e.target.value })}
            >
              <option value="">Alle distrikter</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="category-select">Kategori</label>
            <select
              id="category-select"
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value })}
            >
              <option value="">Alle kategorier</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="from-date">Fra</label>
            <input
              id="from-date"
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="to-date">Til</label>
            <input
              id="to-date"
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
            />
          </div>

          <button className="refresh-btn" onClick={onRefresh}>
            Oppdater data
          </button>
        </div>
      )}
    </div>
  );
}
