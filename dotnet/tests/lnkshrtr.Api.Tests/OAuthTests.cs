using System.Net;
using Lnkshrtr.Infrastructure.Data;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lnkshrtr.Api.Tests;

public sealed class OAuthTests(OAuthFactory factory) : IClassFixture<OAuthFactory>, IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    public async Task InitializeAsync()
    {
        factory.Google.TokenStatus = HttpStatusCode.OK;
        factory.Google.UserInfoStatus = HttpStatusCode.OK;
        factory.Google.TokenBody = """{"access_token":"google-access-token"}""";
        factory.Google.UserInfoBody = """{"email":"GoogleUser@Example.com","name":"Google User","given_name":"Google","sub":"google-sub-1"}""";
        await factory.ResetDb();
    }
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Google_init_redirects_to_google_when_configured()
    {
        var response = await _client.GetAsync("/api/auth/google");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.StartsWith("https://accounts.google.com/o/oauth2/v2/auth", location);
        Assert.Contains("client_id=google-client", location);
        Assert.Equal("openid email profile", QueryHelpers.ParseQuery(response.Headers.Location!.Query)["scope"].ToString());
    }

    [Fact]
    public async Task Google_callback_creates_oauth_user_and_redirects_with_token()
    {
        var response = await _client.GetAsync("/api/auth/google/callback?code=abc123");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.StartsWith("http://localhost:5173/auth/callback?token=", location);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(x => x.Email == "googleuser@example.com");
        Assert.Equal("google_user", user.Username);
        Assert.Null(user.Password);
        Assert.Equal("google-sub-1", user.GoogleId);
    }

    [Fact]
    public async Task Google_callback_reuses_existing_email_and_generates_unique_usernames()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new Lnkshrtr.Domain.Models.User { Username = "google_user", Email = "taken@example.com", Password = "hash" });
            await db.SaveChangesAsync();
        }

        factory.Google.UserInfoBody = """{"email":"new@example.com","name":"Google User","sub":"google-sub-2"}""";
        var response = await _client.GetAsync("/api/auth/google/callback?code=abc123");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        using var scope2 = factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        var created = await db2.Users.SingleAsync(x => x.Email == "new@example.com");
        Assert.Equal("google_user_1", created.Username);

        factory.Google.UserInfoBody = """{"email":"new@example.com","name":"Different Name","sub":"google-sub-2"}""";
        await _client.GetAsync("/api/auth/google/callback?code=again");
        Assert.Equal(2, await db2.Users.CountAsync());
    }

    [Fact]
    public async Task Google_callback_errors_match_fastify_paths()
    {
        var missingCode = await _client.GetAsync("/api/auth/google/callback");
        Assert.Equal(HttpStatusCode.BadRequest, missingCode.StatusCode);

        factory.Google.TokenStatus = HttpStatusCode.BadRequest;
        var badToken = await _client.GetAsync("/api/auth/google/callback?code=bad");
        Assert.Equal(HttpStatusCode.InternalServerError, badToken.StatusCode);

        factory.Google.TokenStatus = HttpStatusCode.OK;
        factory.Google.TokenBody = "{}";
        var noAccessToken = await _client.GetAsync("/api/auth/google/callback?code=no-token");
        Assert.Equal(HttpStatusCode.InternalServerError, noAccessToken.StatusCode);

        factory.Google.TokenBody = """{"access_token":"google-access-token"}""";
        factory.Google.UserInfoStatus = HttpStatusCode.BadGateway;
        var userInfoFailed = await _client.GetAsync("/api/auth/google/callback?code=no-user");
        Assert.Equal(HttpStatusCode.InternalServerError, userInfoFailed.StatusCode);

        factory.Google.UserInfoStatus = HttpStatusCode.OK;
        factory.Google.UserInfoBody = """{"name":"No Email"}""";
        var noEmail = await _client.GetAsync("/api/auth/google/callback?code=no-email");
        Assert.Equal(HttpStatusCode.InternalServerError, noEmail.StatusCode);
    }
}
