using System.Net;
using System.Text.Json;

namespace CarbonLoop.Rhino;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (args.Length != 1 || !Directory.Exists(args[0]))
        {
            Console.Error.WriteLine("Usage: CarbonLoop.HostSmokeTest <installed-plugin-directory>");
            return 2;
        }

        const int sitePort = 18613;
        const int bridgePort = 18615;
        using var host = new LocalWebHost(args[0], sitePort, bridgePort);
        if (!host.TryStart(out var startMessage))
        {
            Console.Error.WriteLine(startMessage);
            return 3;
        }

        const string samplePayload = """
        {
          "contractVersion": "carbonloop.rhino.intake/1.0.0",
          "transmissionId": "smoke-test-001",
          "objects": [
            {
              "id": "test-slab-01",
              "name": "Smoke Test Slab",
              "category": "slab",
              "material": "concrete"
            }
          ]
        }
        """;

        var publish = host.Publish(samplePayload);
        if (!publish.Success)
        {
            Console.Error.WriteLine(publish.Message);
            return 4;
        }

        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        var page = await client.GetAsync($"http://127.0.0.1:{sitePort}/demo.html");
        var healthJson = await client.GetStringAsync($"http://127.0.0.1:{bridgePort}/health");
        var latestJson = await client.GetStringAsync($"http://127.0.0.1:{bridgePort}/rhino-intake/latest");
        using var health = JsonDocument.Parse(healthJson);
        using var latest = JsonDocument.Parse(latestJson);

        var ok = page.StatusCode == HttpStatusCode.OK
            && health.RootElement.GetProperty("status").GetString() == "ready"
            && latest.RootElement.GetProperty("available").GetBoolean()
            && latest.RootElement.GetProperty("payload").GetProperty("objects").GetArrayLength() == 1;

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            started = startMessage,
            pageStatus = (int)page.StatusCode,
            health = health.RootElement.GetProperty("status").GetString(),
            latestRevision = latest.RootElement.GetProperty("revision").GetInt32(),
            objectCount = latest.RootElement.GetProperty("payload").GetProperty("objects").GetArrayLength(),
            passed = ok
        }));
        return ok ? 0 : 5;
    }
}

public sealed record PublishResult(bool Success, int Revision, string Message)
{
    public static PublishResult Failed(string message) => new(false, 0, message);
}
