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

## GitHub Pages Deployment

The app can also run as a static site on GitHub Pages — no backend needed.

A GitHub Actions workflow (`deploy-gh-pages.yml`) handles everything:

1. Runs hourly (and on push to main)
2. Fetches live data from the Politiloggen API via `scripts/fetch-data.mjs`
3. Merges with previously fetched data (stored on a `data-store` branch)
4. Builds the frontend in static mode and deploys to GitHub Pages

### Setup

1. Go to repo **Settings > Pages** and set source to **GitHub Actions**
2. The workflow will run automatically, or trigger it manually from the Actions tab
3. To add more districts, edit the `--districts` flag in the workflow file

The static frontend loads `data/incidents.json` and filters client-side — all filtering by district, category, and date still works.

### Adding more districts

Edit `scripts/fetch-data.mjs` or the workflow's `--districts` flag:

```yaml
# In .github/workflows/deploy-gh-pages.yml
run: node scripts/fetch-data.mjs --districts sor-vest,oslo,vest --merge
```
