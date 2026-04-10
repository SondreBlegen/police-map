# Politilogg Kart

Crime heatmap for Norway based on the official [Politiloggen API](https://api.politiet.no/politiloggen/index.html). Displays police log incidents as a heatmap overlay on an interactive map.

Currently focused on Sandnes / Sør-Vest politidistrikt, but expandable to all Norwegian police districts.

Data licensed under [NLOD 2.0](https://data.norge.no/nlod/en/2.0) — source: [politiet.no/politiloggen](https://www.politiet.no/politiloggen).

## Architecture

- **Backend**: .NET 10 Minimal API with SQLite storage
- **Frontend**: React 19, Vite 8, TypeScript 6, Leaflet + leaflet.heat

The backend fetches from the Politiloggen API on a schedule (every 15 min), geocodes locations, and stores incidents in SQLite for history. The frontend renders a heatmap with filtering by district, category, and date range.

## Getting Started

### Backend

```bash
cd backend/PoliceMap.Api
dotnet run
```

Runs on `http://localhost:5000` by default.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` with API proxy to the backend.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/incidents` | Geolocated incidents with filters |
| GET | `/api/heatmap` | Lightweight lat/lng points for heatmap |
| GET | `/api/districts` | Available police districts |
| GET | `/api/categories` | Available incident categories |
| GET | `/api/stats` | Total counts and last fetch time |
| POST | `/api/fetch` | Trigger manual data fetch |

All GET endpoints support optional query params: `district`, `category`, `from`, `to`.
