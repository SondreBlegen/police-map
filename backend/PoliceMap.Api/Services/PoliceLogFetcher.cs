using System.Text.Json;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using PoliceMap.Api.Data;
using PoliceMap.Api.Models;

namespace PoliceMap.Api.Services;

public class PoliceLogFetcher(
    IHttpClientFactory httpClientFactory,
    IServiceScopeFactory scopeFactory,
    GeocodingService geocoding,
    ILogger<PoliceLogFetcher> logger)
{
    private const string AtomUrl = "https://api.politiet.no/politiloggen/v1/atom";
    private const string MessagesUrl = "https://api.politiet.no/politiloggen/v1/messages";

    private static readonly Dictionary<string, string> DistrictSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Sør-Vest politidistrikt"] = "sor-vest",
        ["Oslo politidistrikt"] = "oslo",
        ["Øst politidistrikt"] = "ost",
        ["Innlandet politidistrikt"] = "innlandet",
        ["Sør-Øst politidistrikt"] = "sor-ost",
        ["Agder politidistrikt"] = "agder",
        ["Vest politidistrikt"] = "vest",
        ["Møre og Romsdal politidistrikt"] = "more-og-romsdal",
        ["Trøndelag politidistrikt"] = "trondelag",
        ["Nordland politidistrikt"] = "nordland",
        ["Troms politidistrikt"] = "troms",
        ["Finnmark politidistrikt"] = "finnmark",
    };

    public async Task FetchAndStoreAsync(string district, CancellationToken ct = default)
    {
        logger.LogInformation("Fetching police log for district: {District}", district);

        // Try JSON messages endpoint first, fall back to Atom
        var newEntries = await TryFetchMessagesAsync(district, ct);
        if (newEntries < 0)
        {
            logger.LogInformation("Messages endpoint failed, trying Atom feed");
            newEntries = await FetchAtomAsync(district, ct);
        }

        logger.LogInformation("Fetch complete: {New} new entries for {District}", newEntries, district);
    }

    private async Task<int> TryFetchMessagesAsync(string district, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("politi");
        var slug = GetSlug(district);
        var url = $"{MessagesUrl}?districts={Uri.EscapeDataString(slug)}";

        try
        {
            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Messages API returned {StatusCode}", response.StatusCode);
                return -1;
            }

            var json = await response.Content.ReadAsStringAsync(ct);

            // Try parsing as array or wrapped object
            List<PoliceLogMessage>? messages = null;
            try
            {
                messages = JsonSerializer.Deserialize<List<PoliceLogMessage>>(json);
            }
            catch
            {
                try
                {
                    var wrapped = JsonSerializer.Deserialize<PoliceLogMessagesResponse>(json);
                    messages = wrapped?.Messages;
                }
                catch
                {
                    logger.LogWarning("Could not parse messages JSON response");
                    return -1;
                }
            }

            if (messages == null || messages.Count == 0)
                return 0;

            return await StoreEntriesAsync(messages.Select(m => new AtomEntry
            {
                Id = m.Id,
                Title = m.Title,
                Content = m.Content ?? m.Description,
                Published = m.Published ?? m.UtcDateTime ?? DateTime.UtcNow,
                Updated = m.Updated ?? DateTime.UtcNow,
                District = m.District,
                Municipality = m.Municipality,
                Category = m.Category
            }).ToList(), district, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Messages endpoint error");
            return -1;
        }
    }

    private async Task<int> FetchAtomAsync(string district, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("politi");
        var slug = GetSlug(district);
        var url = $"{AtomUrl}?districts={Uri.EscapeDataString(slug)}";

        try
        {
            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Atom feed returned {StatusCode}", response.StatusCode);
                return 0;
            }

            var xml = await response.Content.ReadAsStringAsync(ct);
            var entries = ParseAtomFeed(xml);

            return await StoreEntriesAsync(entries, district, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Atom feed fetch error");
            return 0;
        }
    }

    private List<AtomEntry> ParseAtomFeed(string xml)
    {
        var entries = new List<AtomEntry>();

        try
        {
            XNamespace atom = "http://www.w3.org/2005/Atom";
            var doc = XDocument.Parse(xml);

            foreach (var entry in doc.Descendants(atom + "entry"))
            {
                var id = entry.Element(atom + "id")?.Value ?? "";
                var title = entry.Element(atom + "title")?.Value ?? "";
                var content = entry.Element(atom + "content")?.Value ?? "";

                DateTime.TryParse(entry.Element(atom + "published")?.Value, out var published);
                DateTime.TryParse(entry.Element(atom + "updated")?.Value, out var updated);

                string? districtVal = null, municipality = null, category = null;

                foreach (var cat in entry.Elements(atom + "category"))
                {
                    var label = cat.Attribute("label")?.Value;
                    var term = cat.Attribute("term")?.Value;

                    switch (label?.ToLowerInvariant())
                    {
                        case "district":
                            districtVal = term;
                            break;
                        case "municipality":
                            municipality = term;
                            break;
                        case "category":
                            category = term;
                            break;
                    }
                }

                entries.Add(new AtomEntry
                {
                    Id = id,
                    Title = title,
                    Content = content,
                    Published = published,
                    Updated = updated,
                    District = districtVal,
                    Municipality = municipality,
                    Category = category
                });
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error parsing Atom feed");
        }

        return entries;
    }

    private async Task<int> StoreEntriesAsync(List<AtomEntry> entries, string districtFallback, CancellationToken ct)
    {
        var newEntries = 0;
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PoliceMapDbContext>();

        foreach (var entry in entries)
        {
            var externalId = entry.Id;
            if (string.IsNullOrEmpty(externalId))
                continue;

            if (await db.Incidents.AnyAsync(i => i.ExternalId == externalId, ct))
                continue;

            // Extract area from content/title heuristically
            var area = ExtractArea(entry.Content ?? entry.Title);
            var municipality = entry.Municipality;

            var coords = await geocoding.GeocodeAsync(area ?? municipality, municipality);

            var incident = new PoliceIncident
            {
                ExternalId = externalId,
                Title = entry.Title,
                Description = StripHtml(entry.Content),
                District = entry.District ?? districtFallback,
                Municipality = municipality,
                Area = area,
                Category = entry.Category,
                Latitude = coords?.Lat,
                Longitude = coords?.Lng,
                IsGeolocated = coords.HasValue,
                UtcDateTime = entry.Published,
                FetchedAt = DateTime.UtcNow
            };

            db.Incidents.Add(incident);
            newEntries++;
        }

        await db.SaveChangesAsync(ct);
        return newEntries;
    }

    private static string GetSlug(string district)
    {
        if (DistrictSlugs.TryGetValue(district, out var slug))
            return slug;

        // Try to match partial
        foreach (var kvp in DistrictSlugs)
        {
            if (kvp.Key.Contains(district, StringComparison.OrdinalIgnoreCase)
                || district.Contains(kvp.Value, StringComparison.OrdinalIgnoreCase))
                return kvp.Value;
        }

        return district.ToLowerInvariant().Replace(" ", "-");
    }

    private static string? ExtractArea(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // Common pattern: "Sandnes: ..." or "Stavanger - ..." or location at start
        var stripped = StripHtml(text) ?? text;

        var colonIdx = stripped.IndexOf(':');
        if (colonIdx > 0 && colonIdx < 40)
            return stripped[..colonIdx].Trim();

        var dashIdx = stripped.IndexOf(" - ");
        if (dashIdx > 0 && dashIdx < 40)
            return stripped[..dashIdx].Trim();

        return null;
    }

    private static string? StripHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return null;

        return System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " ").Trim();
    }
}
