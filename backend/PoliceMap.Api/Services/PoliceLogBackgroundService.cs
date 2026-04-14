namespace PoliceMap.Api.Services;

public class PoliceLogBackgroundService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<PoliceLogBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a bit for the app to start up
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        var districts = configuration.GetSection("PoliceLog:Districts").Get<string[]>()
            ?? ["Sør-Vest politidistrikt"];
        var intervalMinutes = configuration.GetValue("PoliceLog:FetchIntervalMinutes", 15);

        logger.LogInformation("Background fetcher started. Districts: {Districts}, Interval: {Interval}min",
            string.Join(", ", districts), intervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            foreach (var district in districts)
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var fetcher = scope.ServiceProvider.GetRequiredService<PoliceLogFetcher>();
                    await fetcher.FetchAndStoreAsync(district, stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Background fetch failed for {District}", district);
                }
            }

            await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
        }
    }
}
