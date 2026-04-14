import { useState, useEffect, useCallback } from "react";
import type { Incident, HeatmapPoint, Stats, Filters } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";
const STATIC_MODE = import.meta.env.VITE_STATIC_DATA === "true";
const STATIC_DATA_URL = `${import.meta.env.BASE_URL}data/incidents.json`;

// In static mode, we load all data once and filter client-side.
// In API mode, we call the backend endpoints.

let staticCache: Incident[] | null = null;

async function loadStaticData(): Promise<Incident[]> {
  if (staticCache) return staticCache;
  const res = await fetch(STATIC_DATA_URL);
  if (!res.ok) throw new Error(`Failed to load static data: ${res.status}`);
  staticCache = await res.json();
  return staticCache!;
}

function applyFilters(incidents: Incident[], filters: Filters): Incident[] {
  return incidents.filter((i) => {
    if (filters.district && i.district !== filters.district) return false;
    if (filters.category && i.category !== filters.category) return false;
    if (filters.from && i.utcDateTime < filters.from) return false;
    if (filters.to && i.utcDateTime > filters.to + "T23:59:59") return false;
    return true;
  });
}

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.district) params.set("district", filters.district);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

export function useIncidents(filters: Filters) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      if (STATIC_MODE) {
        const all = await loadStaticData();
        const geolocated = all.filter((i) => i.latitude && i.longitude);
        setIncidents(applyFilters(geolocated, filters));
      } else {
        const query = buildQuery(filters);
        const res = await fetch(`${API_BASE}/api/incidents?${query}`);
        if (res.ok) setIncidents(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return { incidents, loading, refresh: fetchIncidents };
}

export function useHeatmapData(filters: Filters) {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    try {
      if (STATIC_MODE) {
        const all = await loadStaticData();
        const filtered = applyFilters(
          all.filter((i) => i.latitude && i.longitude),
          filters
        );
        setPoints(
          filtered.map((i) => ({ latitude: i.latitude!, longitude: i.longitude! }))
        );
      } else {
        const query = buildQuery(filters);
        const res = await fetch(`${API_BASE}/api/heatmap?${query}`);
        if (res.ok) setPoints(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch heatmap data:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { points, loading, refresh: fetchPoints };
}

export function useDistricts() {
  const [districts, setDistricts] = useState<string[]>([]);

  useEffect(() => {
    if (STATIC_MODE) {
      loadStaticData().then((data) => {
        const unique = [...new Set(data.map((i) => i.district))].sort();
        setDistricts(unique);
      });
    } else {
      fetch(`${API_BASE}/api/districts`)
        .then((res) => res.json())
        .then(setDistricts)
        .catch(() => {});
    }
  }, []);

  return districts;
}

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (STATIC_MODE) {
      loadStaticData().then((data) => {
        const unique = [
          ...new Set(data.map((i) => i.category).filter(Boolean) as string[]),
        ].sort();
        setCategories(unique);
      });
    } else {
      fetch(`${API_BASE}/api/categories`)
        .then((res) => res.json())
        .then(setCategories)
        .catch(() => {});
    }
  }, []);

  return categories;
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (STATIC_MODE) {
      loadStaticData().then((data) => {
        const geolocated = data.filter((i) => i.latitude && i.longitude).length;
        const latest = data.length > 0 ? data[0].utcDateTime : null;
        setStats({ total: data.length, geolocated, lastFetch: latest });
      });
    } else {
      fetch(`${API_BASE}/api/stats`)
        .then((res) => res.json())
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  return stats;
}

export async function triggerFetch(district?: string): Promise<string> {
  if (STATIC_MODE) return "Data oppdateres automatisk via GitHub Actions";
  try {
    const params = district ? `?district=${encodeURIComponent(district)}` : "";
    const res = await fetch(`${API_BASE}/api/fetch${params}`, { method: "POST" });
    const data = await res.json();
    return data.message || "Fetch triggered";
  } catch {
    return "Fetch failed";
  }
}
