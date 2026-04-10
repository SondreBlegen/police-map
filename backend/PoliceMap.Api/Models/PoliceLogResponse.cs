using System.Text.Json.Serialization;

namespace PoliceMap.Api.Models;

// Response from /v1/messages endpoint
public class PoliceLogMessagesResponse
{
    [JsonPropertyName("messages")]
    public List<PoliceLogMessage> Messages { get; set; } = [];
}

public class PoliceLogMessage
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("content")]
    public string? Content { get; set; }

    [JsonPropertyName("district")]
    public string District { get; set; } = "";

    [JsonPropertyName("municipality")]
    public string? Municipality { get; set; }

    [JsonPropertyName("area")]
    public string? Area { get; set; }

    [JsonPropertyName("category")]
    public string? Category { get; set; }

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }

    [JsonPropertyName("published")]
    public DateTime? Published { get; set; }

    [JsonPropertyName("updated")]
    public DateTime? Updated { get; set; }

    [JsonPropertyName("utcDateTime")]
    public DateTime? UtcDateTime { get; set; }
}

// Atom feed parsing models
public class AtomEntry
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Content { get; set; }
    public DateTime Published { get; set; }
    public DateTime Updated { get; set; }
    public string? District { get; set; }
    public string? Municipality { get; set; }
    public string? Category { get; set; }
}
