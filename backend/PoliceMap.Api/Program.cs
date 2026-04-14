using Microsoft.EntityFrameworkCore;
using PoliceMap.Api.Data;
using PoliceMap.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<PoliceMapDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=policemap.db"));

// HTTP clients
builder.Services.AddHttpClient("politi", client =>
{
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; PoliceMapNorway/1.0)");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddHttpClient<GeocodingService>();

// Services
builder.Services.AddSingleton<GeocodingService>();
builder.Services.AddScoped<PoliceLogFetcher>();
builder.Services.AddHostedService<PoliceLogBackgroundService>();

// CORS for frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

// Auto-migrate database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PoliceMapDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors();

// API Endpoints

// Get incidents for heatmap (with optional filters)
app.MapGet("/api/incidents", async (
    PoliceMapDbContext db,
    string? district,
    string? category,
    DateTime? from,
    DateTime? to) =>
{
    var query = db.Incidents
        .Where(i => i.IsGeolocated)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(district))
        query = query.Where(i => i.District == district);

    if (!string.IsNullOrWhiteSpace(category))
        query = query.Where(i => i.Category == category);

    if (from.HasValue)
        query = query.Where(i => i.UtcDateTime >= from.Value);

    if (to.HasValue)
        query = query.Where(i => i.UtcDateTime <= to.Value);

    var incidents = await query
        .OrderByDescending(i => i.UtcDateTime)
        .Select(i => new
        {
            i.Id,
            i.Title,
            i.Description,
            i.District,
            i.Municipality,
            i.Area,
            i.Category,
            i.Latitude,
            i.Longitude,
            i.UtcDateTime
        })
        .ToListAsync();

    return Results.Ok(incidents);
});

// Get heatmap data (lightweight - just coords and intensity)
app.MapGet("/api/heatmap", async (
    PoliceMapDbContext db,
    string? district,
    string? category,
    DateTime? from,
    DateTime? to) =>
{
    var query = db.Incidents
        .Where(i => i.IsGeolocated)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(district))
        query = query.Where(i => i.District == district);

    if (!string.IsNullOrWhiteSpace(category))
        query = query.Where(i => i.Category == category);

    if (from.HasValue)
        query = query.Where(i => i.UtcDateTime >= from.Value);

    if (to.HasValue)
        query = query.Where(i => i.UtcDateTime <= to.Value);

    var points = await query
        .Select(i => new { i.Latitude, i.Longitude })
        .ToListAsync();

    return Results.Ok(points);
});

// Get available districts
app.MapGet("/api/districts", async (PoliceMapDbContext db) =>
{
    var districts = await db.Incidents
        .Select(i => i.District)
        .Distinct()
        .OrderBy(d => d)
        .ToListAsync();

    return Results.Ok(districts);
});

// Get available categories
app.MapGet("/api/categories", async (PoliceMapDbContext db) =>
{
    var categories = await db.Incidents
        .Where(i => i.Category != null)
        .Select(i => i.Category!)
        .Distinct()
        .OrderBy(c => c)
        .ToListAsync();

    return Results.Ok(categories);
});

// Get stats
app.MapGet("/api/stats", async (PoliceMapDbContext db) =>
{
    var total = await db.Incidents.CountAsync();
    var geolocated = await db.Incidents.CountAsync(i => i.IsGeolocated);
    var latest = await db.Incidents
        .OrderByDescending(i => i.FetchedAt)
        .Select(i => i.FetchedAt)
        .FirstOrDefaultAsync();

    return Results.Ok(new { total, geolocated, lastFetch = latest });
});

// Trigger a manual fetch
app.MapPost("/api/fetch", async (
    IServiceScopeFactory scopeFactory,
    string? district) =>
{
    var d = district ?? "Sør-Vest politidistrikt";
    using var scope = scopeFactory.CreateScope();
    var fetcher = scope.ServiceProvider.GetRequiredService<PoliceLogFetcher>();
    await fetcher.FetchAndStoreAsync(d);
    return Results.Ok(new { message = $"Fetch completed for {d}" });
});

app.Run();
