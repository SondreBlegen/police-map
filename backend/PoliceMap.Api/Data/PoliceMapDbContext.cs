using Microsoft.EntityFrameworkCore;
using PoliceMap.Api.Models;

namespace PoliceMap.Api.Data;

public class PoliceMapDbContext(DbContextOptions<PoliceMapDbContext> options) : DbContext(options)
{
    public DbSet<PoliceIncident> Incidents => Set<PoliceIncident>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PoliceIncident>(entity =>
        {
            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.District);
            entity.HasIndex(e => e.UtcDateTime);
            entity.HasIndex(e => new { e.Latitude, e.Longitude });
        });
    }
}
