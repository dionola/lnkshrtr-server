using System.Net;
using Lnkshrtr.Application.Config;
using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Infrastructure.Services;

namespace Lnkshrtr.Api.Tests;

public sealed class InfrastructureTests
{
    [Theory]
    [InlineData("7d", 7 * 24)]
    [InlineData("2h", 2)]
    [InlineData("30m", 0.5)]
    public void Jwt_lifetime_parses_supported_suffixes(string value, double expectedHours)
    {
        var options = new AppOptions { JwtExpiresIn = value };
        Assert.Equal(TimeSpan.FromHours(expectedHours), options.JwtLifetime());
    }

    [Fact]
    public void Database_url_parser_accepts_url_and_plain_connection_strings()
    {
        var parsed = DatabaseUrl.ToConnectionString("postgresql://user:pass@localhost:5433/appdb");
        Assert.Contains("Host=localhost", parsed);
        Assert.Contains("Port=5433", parsed);
        Assert.Contains("Database=appdb", parsed);
        Assert.Contains("Username=user", parsed);

        var plain = "Host=localhost;Database=appdb";
        Assert.Equal(plain, DatabaseUrl.ToConnectionString(plain));
    }

    [Fact]
    public void Cache_keys_are_stable()
    {
        Assert.Equal("link:abc123", CacheService.LinkByCode("abc123"));
        Assert.Equal("public:user:alice", CacheService.PublicUser("alice"));
        Assert.Equal("public:links:alice:all", CacheService.PublicLinks("alice", null));
        Assert.Equal("public:links:alice:link", CacheService.PublicLinks("alice", "link"));
        Assert.Equal("user:links:user1:all", CacheService.UserLinks("user1", null));
    }
}

public sealed class RateLimitTests(RateLimitFactory factory) : IClassFixture<RateLimitFactory>, IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient();

    public Task InitializeAsync() => factory.ResetDb();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Global_rate_limiter_returns_429_json()
    {
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/health/live")).StatusCode);

        var limited = await _client.GetAsync("/health/ready");
        Assert.Equal((HttpStatusCode)429, limited.StatusCode);
        var text = await limited.Content.ReadAsStringAsync();
        Assert.Contains("RATE_LIMITED", text);
    }
}
