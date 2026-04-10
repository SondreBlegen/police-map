import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import HeatmapLayer from "./components/HeatmapLayer";
import FilterPanel from "./components/FilterPanel";
import IncidentList from "./components/IncidentList";
import StatsBar from "./components/StatsBar";
import {
  useIncidents,
  useHeatmapData,
  useDistricts,
  useCategories,
  useStats,
  triggerFetch,
} from "./hooks/useApi";
import type { Filters } from "./types";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default marker icon paths for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Sandnes center
const DEFAULT_CENTER: [number, number] = [58.852, 5.736];
const DEFAULT_ZOOM = 12;

export default function App() {
  const [filters, setFilters] = useState<Filters>({
    district: "",
    category: "",
    from: "",
    to: "",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [showMarkers, setShowMarkers] = useState(false);

  const { incidents, loading, refresh: refreshIncidents } = useIncidents(filters);
  const { points, refresh: refreshHeatmap } = useHeatmapData(filters);
  const districts = useDistricts();
  const categories = useCategories();
  const stats = useStats();

  const heatmapPoints = useMemo(
    () =>
      points.map((p) => [p.latitude, p.longitude, 0.5] as [number, number, number]),
    [points]
  );

  const handleRefresh = async () => {
    await triggerFetch(filters.district || undefined);
    refreshIncidents();
    refreshHeatmap();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Politilogg Kart</h1>
        <div className="header-controls">
          <label className="marker-toggle">
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(e) => setShowMarkers(e.target.checked)}
            />
            Markører
          </label>
        </div>
      </header>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        districts={districts}
        categories={categories}
        onRefresh={handleRefresh}
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
      />

      <div className="map-wrapper">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="leaflet-map"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

          {showMarkers &&
            incidents
              .filter((i) => i.latitude && i.longitude)
              .map((inc) => (
                <Marker key={inc.id} position={[inc.latitude!, inc.longitude!]}>
                  <Popup>
                    <strong>{inc.title}</strong>
                    <br />
                    {inc.category && <em>{inc.category}</em>}
                    {inc.description && <p style={{ margin: "4px 0", fontSize: "13px" }}>{inc.description}</p>}
                    <small>{new Date(inc.utcDateTime).toLocaleString("nb-NO")}</small>
                  </Popup>
                </Marker>
              ))}
        </MapContainer>
      </div>

      <StatsBar stats={stats} />

      <IncidentList
        incidents={incidents}
        isOpen={listOpen}
        onToggle={() => setListOpen(!listOpen)}
      />
    </div>
  );
}
