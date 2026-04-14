#!/usr/bin/env node

/**
 * Fetches police log data from the Politiloggen API, geocodes locations,
 * and writes a static JSON file for the GitHub Pages frontend.
 *
 * Usage: node scripts/fetch-data.mjs [--districts sor-vest,oslo] [--output frontend/public/data/incidents.json]
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { parseArgs } from "util";

const ATOM_URL = "https://api.politiet.no/politiloggen/v1/atom";

// Well-known locations for fast geocoding
const KNOWN_LOCATIONS = {
  "sandnes": [58.852, 5.7357],
  "sandnes sentrum": [58.849, 5.735],
  "ganddal": [58.815, 5.745],
  "lura": [58.87, 5.73],
  "bogafjell": [58.825, 5.78],
  "riska": [58.87, 5.78],
  "hana": [58.835, 5.76],
  "sandved": [58.84, 5.72],
  "austrått": [58.855, 5.71],
  "figgjo": [58.79, 5.72],
  "høle": [58.92, 5.9],
  "forsand": [58.94, 6.1],
  "malmheim": [58.805, 5.71],
  "sviland": [58.87, 5.84],
  "vatne": [58.86, 5.76],
  "soma": [58.86, 5.67],
  "hommersåk": [58.91, 5.82],
  "stangeland": [58.845, 5.705],
  "stavanger": [58.97, 5.7331],
  "stavanger sentrum": [58.97, 5.7331],
  "hundvåg": [58.99, 5.75],
  "storhaug": [58.975, 5.75],
  "hillevåg": [58.95, 5.72],
  "tasta": [58.985, 5.71],
  "eiganes": [58.965, 5.72],
  "madla": [58.955, 5.67],
  "tananger": [58.935, 5.57],
  "sola": [58.89, 5.65],
  "bryne": [58.735, 5.65],
  "klepp": [58.77, 5.63],
  "nærbø": [58.67, 5.63],
  "ålgård": [58.76, 5.85],
  "gjesdal": [58.76, 5.85],
  "randaberg": [59.0, 5.62],
  "forus": [58.9, 5.69],
  "jåttå": [58.91, 5.71],
  "mariero": [58.93, 5.72],
  "gausel": [58.9, 5.72],
  "haugesund": [59.4138, 5.268],
  "karmøy": [59.285, 5.305],
  "oslo": [59.9139, 10.7522],
  "oslo sentrum": [59.9139, 10.7522],
  "grønland": [59.9118, 10.7614],
  "grünerløkka": [59.9227, 10.7615],
  "majorstuen": [59.9289, 10.7137],
  "frogner": [59.9193, 10.7043],
  "sagene": [59.9355, 10.7512],
  "stovner": [59.9612, 10.9231],
  "grorud": [59.9589, 10.8861],
  "alna": [59.9367, 10.8467],
  "bergen": [60.3913, 5.3221],
  "trondheim": [63.4305, 10.3951],
  "tromsø": [69.6496, 18.9560],
  "drammen": [59.7441, 10.2045],
  "kristiansand": [58.1599, 8.0182],
  "fredrikstad": [59.2181, 10.9298],
  "bodø": [67.2804, 14.4049],
  "ålesund": [62.4722, 6.1495],
  "tønsberg": [59.2674, 10.4076],
  "moss": [59.4346, 10.6584],
  "sarpsborg": [59.2839, 11.1099],
};

const DISTRICT_DEFAULTS = {
  "sor-vest": [58.9, 5.73],
  "oslo": [59.91, 10.75],
  "ost": [59.72, 10.93],
  "innlandet": [60.79, 11.08],
  "sor-ost": [59.27, 10.41],
  "agder": [58.16, 8.0],
  "vest": [60.39, 5.32],
  "more-og-romsdal": [62.47, 6.15],
  "trondelag": [63.43, 10.40],
  "nordland": [67.28, 14.4],
  "troms": [69.65, 18.96],
  "finnmark": [70.07, 25.0],
};

function geocode(area, municipality, district) {
  // Try area
  if (area) {
    const key = area.toLowerCase().trim();
    if (KNOWN_LOCATIONS[key]) return KNOWN_LOCATIONS[key];
  }

  // Try municipality
  if (municipality) {
    const key = municipality.toLowerCase().trim();
    if (KNOWN_LOCATIONS[key]) return KNOWN_LOCATIONS[key];
  }

  // Fall back to district center with some jitter
  if (district && DISTRICT_DEFAULTS[district]) {
    const [lat, lng] = DISTRICT_DEFAULTS[district];
    const jitter = () => (Math.random() - 0.5) * 0.02;
    return [lat + jitter(), lng + jitter()];
  }

  return null;
}

function extractArea(text) {
  if (!text) return null;
  const stripped = text.replace(/<[^>]+>/g, " ").trim();

  const colonIdx = stripped.indexOf(":");
  if (colonIdx > 0 && colonIdx < 40) return stripped.slice(0, colonIdx).trim();

  const dashIdx = stripped.indexOf(" - ");
  if (dashIdx > 0 && dashIdx < 40) return stripped.slice(0, dashIdx).trim();

  return null;
}

function stripHtml(html) {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseAtomFeed(xml) {
  const entries = [];

  // Simple regex-based Atom parser (no external deps needed)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];

    const id = block.match(/<id>([^<]*)<\/id>/)?.[1] ?? "";
    const title = block.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
    const content = block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "";
    const published = block.match(/<published>([^<]*)<\/published>/)?.[1] ?? "";
    const updated = block.match(/<updated>([^<]*)<\/updated>/)?.[1] ?? "";

    let district = null, municipality = null, category = null;

    const catRegex = /<category[^>]*label="([^"]*)"[^>]*term="([^"]*)"[^>]*\/?>/g;
    let catMatch;
    while ((catMatch = catRegex.exec(block)) !== null) {
      const label = catMatch[1].toLowerCase();
      const term = catMatch[2];
      if (label === "district") district = term;
      else if (label === "municipality") municipality = term;
      else if (label === "category") category = term;
    }

    // Also try term before label order
    const catRegex2 = /<category[^>]*term="([^"]*)"[^>]*label="([^"]*)"[^>]*\/?>/g;
    while ((catMatch = catRegex2.exec(block)) !== null) {
      const term = catMatch[1];
      const label = catMatch[2].toLowerCase();
      if (label === "district" && !district) district = term;
      else if (label === "municipality" && !municipality) municipality = term;
      else if (label === "category" && !category) category = term;
    }

    entries.push({
      id,
      title,
      content: stripHtml(content),
      published,
      updated,
      district,
      municipality,
      category,
    });
  }

  return entries;
}

async function fetchDistrict(districtSlug) {
  const url = `${ATOM_URL}?districts=${encodeURIComponent(districtSlug)}`;
  console.log(`Fetching ${url}...`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "PoliceMapNorway/1.0 (GitHub Actions)",
      "Accept": "application/atom+xml, application/xml, text/xml",
    },
  });

  if (!res.ok) {
    console.error(`API returned ${res.status} for ${districtSlug}`);
    return [];
  }

  const xml = await res.text();
  const entries = parseAtomFeed(xml);
  console.log(`Parsed ${entries.length} entries for ${districtSlug}`);

  return entries.map((entry) => {
    const area = extractArea(entry.content || entry.title);
    const coords = geocode(area, entry.municipality, districtSlug);

    return {
      id: entry.id,
      title: entry.title,
      description: entry.content,
      district: entry.district || districtSlug,
      municipality: entry.municipality,
      area,
      category: entry.category,
      latitude: coords?.[0] ?? null,
      longitude: coords?.[1] ?? null,
      utcDateTime: entry.published || entry.updated,
    };
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      districts: { type: "string", default: "sor-vest" },
      output: { type: "string", default: "frontend/public/data/incidents.json" },
      merge: { type: "boolean", default: true },
    },
  });

  const districts = values.districts.split(",").map((d) => d.trim());
  const outputPath = values.output;

  // Load existing data if merging
  let existing = [];
  if (values.merge && existsSync(outputPath)) {
    try {
      existing = JSON.parse(readFileSync(outputPath, "utf-8"));
      console.log(`Loaded ${existing.length} existing incidents`);
    } catch {
      console.log("Could not load existing data, starting fresh");
    }
  }

  const existingIds = new Set(existing.map((e) => e.id));
  let newCount = 0;

  for (const district of districts) {
    const incidents = await fetchDistrict(district);
    for (const inc of incidents) {
      if (!existingIds.has(inc.id)) {
        existing.push(inc);
        existingIds.add(inc.id);
        newCount++;
      }
    }
  }

  // Sort by date descending
  existing.sort((a, b) => new Date(b.utcDateTime).getTime() - new Date(a.utcDateTime).getTime());

  // Write output
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(existing, null, 2));

  console.log(`Done. ${newCount} new incidents, ${existing.length} total. Written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
