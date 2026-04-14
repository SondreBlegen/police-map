export interface Incident {
  id: number;
  title: string;
  description: string | null;
  district: string;
  municipality: string | null;
  area: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  utcDateTime: string;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface Stats {
  total: number;
  geolocated: number;
  lastFetch: string | null;
}

export interface Filters {
  district: string;
  category: string;
  from: string;
  to: string;
}
