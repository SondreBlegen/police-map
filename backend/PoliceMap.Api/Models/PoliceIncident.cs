namespace PoliceMap.Api.Models;

public class PoliceIncident
{
    public int Id { get; set; }
    public required string ExternalId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public required string District { get; set; }
    public string? Municipality { get; set; }
    public string? Area { get; set; }
    public string? Category { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool IsGeolocated { get; set; }
    public DateTime UtcDateTime { get; set; }
    public DateTime FetchedAt { get; set; }
}
