using System.Collections.Concurrent;
using System.Text.Json;

namespace PoliceMap.Api.Services;

public class GeocodingService(HttpClient httpClient, ILogger<GeocodingService> logger)
{
    // Well-known locations in Sandnes and surrounding areas for fast lookup
    private static readonly Dictionary<string, (double Lat, double Lng)> KnownLocations = new(StringComparer.OrdinalIgnoreCase)
    {
        // Sandnes
        ["Sandnes"] = (58.8520, 5.7357),
        ["Sandnes sentrum"] = (58.8490, 5.7350),
        ["Ganddal"] = (58.8150, 5.7450),
        ["Lura"] = (58.8700, 5.7300),
        ["Bogafjell"] = (58.8250, 5.7800),
        ["Riska"] = (58.8700, 5.7800),
        ["Hana"] = (58.8350, 5.7600),
        ["Sandved"] = (58.8400, 5.7200),
        ["Austrått"] = (58.8550, 5.7100),
        ["Figgjo"] = (58.7900, 5.7200),
        ["Høle"] = (58.9200, 5.9000),
        ["Forsand"] = (58.9400, 6.1000),
        ["Malmheim"] = (58.8050, 5.7100),
        ["Sviland"] = (58.8700, 5.8400),
        ["Vatne"] = (58.8600, 5.7600),
        ["Soma"] = (58.8600, 5.6700),
        ["Hommersåk"] = (58.9100, 5.8200),
        ["Stangeland"] = (58.8450, 5.7050),

        // Stavanger (for when entries bleed over)
        ["Stavanger"] = (58.9700, 5.7331),
        ["Stavanger sentrum"] = (58.9700, 5.7331),
        ["Hundvåg"] = (58.9900, 5.7500),
        ["Storhaug"] = (58.9750, 5.7500),
        ["Hillevåg"] = (58.9500, 5.7200),
        ["Tasta"] = (58.9850, 5.7100),
        ["Eiganes"] = (58.9650, 5.7200),
        ["Madla"] = (58.9550, 5.6700),
        ["Tananger"] = (58.9350, 5.5700),
        ["Sola"] = (58.8900, 5.6500),
        ["Bryne"] = (58.7350, 5.6500),
        ["Klepp"] = (58.7700, 5.6300),
        ["Nærbø"] = (58.6700, 5.6300),
        ["Ålgård"] = (58.7600, 5.8500),
        ["Gjesdal"] = (58.7600, 5.8500),
        ["Randaberg"] = (59.0000, 5.6200),
        ["Forus"] = (58.9000, 5.6900),
        ["Jåttå"] = (58.9100, 5.7100),
        ["Mariero"] = (58.9300, 5.7200),
        ["Gausel"] = (58.9000, 5.7200),

        // Haugesund area
        ["Haugesund"] = (59.4138, 5.2680),
        ["Karmøy"] = (59.2850, 5.3050),
    };

    private readonly ConcurrentDictionary<string, (double Lat, double Lng)?> _cache = new(StringComparer.OrdinalIgnoreCase);

    public async Task<(double Lat, double Lng)?> GeocodeAsync(string? area, string? municipality)
    {
        if (string.IsNullOrWhiteSpace(area) && string.IsNullOrWhiteSpace(municipality))
            return null;

        // Try area first, then municipality
        var lookupKey = !string.IsNullOrWhiteSpace(area) ? area.Trim() : municipality!.Trim();

        if (KnownLocations.TryGetValue(lookupKey, out var known))
            return known;

        // Try municipality if area didn't match
        if (!string.IsNullOrWhiteSpace(municipality) && lookupKey != municipality.Trim()
            && KnownLocations.TryGetValue(municipality.Trim(), out var knownMuni))
            return knownMuni;

        // Check cache
        var cacheKey = $"{area}|{municipality}";
        if (_cache.TryGetValue(cacheKey, out var cached))
            return cached;

        // Fall back to Nominatim geocoding
        var result = await NominatimGeocodeAsync(lookupKey, "Norway");
        if (result == null && !string.IsNullOrWhiteSpace(municipality) && municipality.Trim() != lookupKey)
        {
            result = await NominatimGeocodeAsync(municipality.Trim(), "Norway");
        }

        _cache[cacheKey] = result;
        return result;
    }

    private async Task<(double Lat, double Lng)?> NominatimGeocodeAsync(string query, string country)
    {
        try
        {
            var url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(query)},{Uri.EscapeDataString(country)}&format=json&limit=1";
            httpClient.DefaultRequestHeaders.UserAgent.Clear();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("PoliceMapNorway/1.0");

            var response = await httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return null;

            var json = await response.Content.ReadAsStringAsync();
            var results = JsonSerializer.Deserialize<List<NominatimResult>>(json);

            if (results is { Count: > 0 })
            {
                var r = results[0];
                if (double.TryParse(r.Lat, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lat)
                    && double.TryParse(r.Lon, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lng))
                {
                    logger.LogInformation("Geocoded '{Query}' to ({Lat}, {Lng})", query, lat, lng);
                    return (lat, lng);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Nominatim geocoding failed for '{Query}'", query);
        }

        return null;
    }

    private class NominatimResult
    {
        [System.Text.Json.Serialization.JsonPropertyName("lat")]
        public string Lat { get; set; } = "";

        [System.Text.Json.Serialization.JsonPropertyName("lon")]
        public string Lon { get; set; } = "";
    }
}
