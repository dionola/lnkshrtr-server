using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Domain.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Lnkshrtr.Api.Tests;

public sealed class ApiContractTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Task InitializeAsync() => factory.ResetDb();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Signup_returns_user_token_and_hashes_password()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/signup", new { username = "alice", email = "alice@example.com", password = "password123" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await Read<AuthBody>(response);
        Assert.Equal("alice", body.User.Username);
        Assert.False(string.IsNullOrWhiteSpace(body.AccessToken));
        var decoded = new JwtSecurityTokenHandler().ReadJwtToken(body.AccessToken);
        Assert.Equal(body.User.Id, decoded.Claims.Single(x => x.Type == "sub").Value);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = db.Users.Single(x => x.Email == "alice@example.com");
        Assert.NotEqual("password123", user.Password);
        Assert.StartsWith("$2", user.Password);
    }

    [Fact]
    public async Task Signup_validates_and_conflicts_like_existing_apis()
    {
        await _client.PostAsJsonAsync("/api/auth/signup", new { username = "alice", email = "alice@example.com", password = "password123" });

        var conflict = await _client.PostAsJsonAsync("/api/auth/signup", new { username = "bob", email = "alice@example.com", password = "password123" });
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        Assert.Equal("CONFLICT", (await Read<ErrorEnvelope>(conflict)).Error.Code);

        var invalid = await _client.PostAsJsonAsync("/api/auth/signup", new { username = "ab", email = "bad", password = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("VALIDATION_ERROR", (await Read<ErrorEnvelope>(invalid)).Error.Code);

        var nonJson = await _client.PostAsync("/api/auth/signup", new StringContent("not json", Encoding.UTF8, "text/plain"));
        Assert.Equal(HttpStatusCode.BadRequest, nonJson.StatusCode);
    }

    [Fact]
    public async Task Login_and_me_use_jwt_auth()
    {
        await Signup("alice", "alice@example.com");

        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email = "alice@example.com", password = "password123" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var auth = await Read<AuthBody>(login);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var me = await _client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal("alice", (await Read<UserBody>(me)).Username);

        var caseLogin = await _client.PostAsJsonAsync("/api/auth/login", new { email = "ALICE@example.com", password = "password123" });
        Assert.Equal(HttpStatusCode.OK, caseLogin.StatusCode);
    }

    [Fact]
    public async Task Auth_rejects_bad_credentials_oauth_users_and_bad_tokens()
    {
        await Signup("alice", "alice@example.com");

        var wrongPassword = await _client.PostAsJsonAsync("/api/auth/login", new { email = "alice@example.com", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal("INVALID_CREDENTIALS", (await Read<ErrorEnvelope>(wrongPassword)).Error.Code);

        var missingUser = await _client.PostAsJsonAsync("/api/auth/login", new { email = "missing@example.com", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, missingUser.StatusCode);
        Assert.Equal("INVALID_CREDENTIALS", (await Read<ErrorEnvelope>(missingUser)).Error.Code);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new User { Username = "oauth", Email = "oauth@example.com", Password = null });
            await db.SaveChangesAsync();
        }

        var oauthLogin = await _client.PostAsJsonAsync("/api/auth/login", new { email = "oauth@example.com", password = "password123" });
        Assert.Equal(HttpStatusCode.Unauthorized, oauthLogin.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", "abc");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", MakeToken("deleted-user"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);

        var auth = await Signup("bob", "bob@example.com");
        var expired = MakeToken(auth.User.Id, DateTime.UtcNow.AddMinutes(-1));
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", expired);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Google_oauth_not_configured_matches_fastify()
    {
        var response = await _client.GetAsync("/api/auth/google");
        Assert.Equal(HttpStatusCode.NotImplemented, response.StatusCode);
        var error = await Read<ErrorEnvelope>(response);
        Assert.Equal("NOT_CONFIGURED", error.Error.Code);
    }

    [Fact]
    public async Task Link_creation_supports_defaults_custom_codes_and_anonymous_links()
    {
        var anonymous = await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com" });
        Assert.Equal(HttpStatusCode.Created, anonymous.StatusCode);
        var anonBody = await Read<LinkBody>(anonymous);
        Assert.Null(anonBody.UserId);
        Assert.True(anonBody.IsPublic);
        Assert.False(anonBody.IsPasswordProtected);
        Assert.Equal("link", anonBody.Type);
        Assert.Equal(0, anonBody.Visits);
        Assert.Equal("example.com", anonBody.Title);

        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var custom = await _client.PostAsJsonAsync("/api/links", new { url = "http://example.com", customCode = "mycode" });
        Assert.Equal(HttpStatusCode.Created, custom.StatusCode);
        Assert.Equal("mycode", (await Read<LinkBody>(custom)).ShortCode);

        var duplicate = await _client.PostAsJsonAsync("/api/links", new { url = "http://example.com", customCode = "mycode" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var invalidCustomCode = await _client.PostAsJsonAsync("/api/links", new { url = "http://example.com", customCode = "bad code!" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidCustomCode.StatusCode);

        var shortCustomCode = await _client.PostAsJsonAsync("/api/links", new { url = "http://example.com", customCode = "ab" });
        Assert.Equal(HttpStatusCode.BadRequest, shortCustomCode.StatusCode);

        var protectedLink = await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com", isPasswordProtected = true, password = "secret99" });
        Assert.Equal(HttpStatusCode.Created, protectedLink.StatusCode);
        AssertNoPasswordField(await protectedLink.Content.ReadAsStringAsync());

        var missingPassword = await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com", isPasswordProtected = true });
        Assert.Equal(HttpStatusCode.BadRequest, missingPassword.StatusCode);
    }

    [Theory]
    [InlineData("ftp://files.example.com")]
    [InlineData("data:text/html,<h1>hello</h1>")]
    [InlineData("javascript:alert(1)")]
    [InlineData("not-a-url-at-all")]
    public async Task Link_creation_rejects_non_http_urls(string url)
    {
        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var response = await _client.PostAsJsonAsync("/api/links", new { url });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", (await Read<ErrorEnvelope>(response)).Error.Code);
    }

    [Fact]
    public async Task Owner_can_update_and_delete_but_other_users_cannot()
    {
        var owner = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", owner.AccessToken);
        var created = await Read<LinkBody>(await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com" }));

        var attacker = await Signup("attacker", "attacker@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", attacker.AccessToken);
        var forbidden = await _client.PutAsJsonAsync($"/api/links/{created.Id}", new { title = "Hijacked" });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", owner.AccessToken);
        var updated = await _client.PutAsJsonAsync($"/api/links/{created.Id}", new { title = "New Title", isPasswordProtected = true, password = "secret99" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var body = await Read<LinkBody>(updated);
        Assert.Equal("New Title", body.Title);
        Assert.True(body.IsPasswordProtected);

        var deactivated = await _client.PutAsJsonAsync($"/api/links/{created.Id}", new { isActive = false, isPublic = false });
        Assert.Equal(HttpStatusCode.OK, deactivated.StatusCode);
        var deactivatedBody = await Read<LinkBody>(deactivated);
        Assert.False(deactivatedBody.IsActive);
        Assert.False(deactivatedBody.IsPublic);

        var shortPassword = await _client.PutAsJsonAsync($"/api/links/{created.Id}", new { isPasswordProtected = true, password = "abc" });
        Assert.Equal(HttpStatusCode.BadRequest, shortPassword.StatusCode);

        var deleted = await _client.DeleteAsync($"/api/links/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var missingDelete = await _client.DeleteAsync("/api/links/00000000-0000-0000-0000-000000000000");
        Assert.Equal(HttpStatusCode.NotFound, missingDelete.StatusCode);
    }

    [Fact]
    public async Task User_links_are_authenticated_filtered_ordered_and_strip_passwords()
    {
        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var first = await Read<LinkBody>(await _client.PostAsJsonAsync("/api/links", new { url = "https://old.example.com", customCode = "old001", isPasswordProtected = true, password = "secret99" }));
        await Task.Delay(20);
        var second = await Read<LinkBody>(await _client.PostAsJsonAsync("/api/links", new { url = "https://new.example.com", customCode = "new001" }));

        var other = await Signup("other", "other@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", other.AccessToken);
        await _client.PostAsJsonAsync("/api/links", new { url = "https://other.example.com", customCode = "oth001" });

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var linksResponse = await _client.GetAsync("/api/links?type=link");
        Assert.Equal(HttpStatusCode.OK, linksResponse.StatusCode);
        var text = await linksResponse.Content.ReadAsStringAsync();
        AssertNoPasswordField(text);
        var links = JsonSerializer.Deserialize<List<LinkBody>>(text, JsonOptions)!;
        Assert.Equal([second.Id, first.Id], links.Select(x => x.Id).ToArray());
        Assert.All(links, link => Assert.Equal(auth.User.Id, link.UserId));

        _client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/links")).StatusCode);
    }

    [Fact]
    public async Task Public_routes_filter_links_and_hide_passwords()
    {
        var auth = await Signup("publicuser", "public@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        await _client.PostAsJsonAsync("/api/links", new { url = "https://public.example.com", customCode = "pub001" });
        await _client.PostAsJsonAsync("/api/links", new { url = "https://private.example.com", customCode = "priv01", isPublic = false });

        var profile = await _client.GetAsync("/api/public/publicuser");
        Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
        Assert.Equal("publicuser", (await Read<UserBody>(profile)).Username);

        var links = await Read<List<LinkBody>>(await _client.GetAsync("/api/public/publicuser/links"));
        Assert.Single(links);
        Assert.Equal("pub001", links[0].ShortCode);

        var missing = await _client.GetAsync("/api/public/missing");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Public_links_filter_private_inactive_and_foreign_links()
    {
        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        await _client.PostAsJsonAsync("/api/links", new { url = "https://public.example.com", customCode = "pub001" });
        await _client.PostAsJsonAsync("/api/links", new { url = "https://private.example.com", customCode = "priv01", isPublic = false });
        var inactive = await Read<LinkBody>(await _client.PostAsJsonAsync("/api/links", new { url = "https://inactive.example.com", customCode = "inact1" }));
        await _client.PutAsJsonAsync($"/api/links/{inactive.Id}", new { isActive = false });

        var other = await Signup("other", "other@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", other.AccessToken);
        await _client.PostAsJsonAsync("/api/links", new { url = "https://other.example.com", customCode = "other1" });
        _client.DefaultRequestHeaders.Authorization = null;

        var links = await Read<List<LinkBody>>(await _client.GetAsync("/api/public/owner/links?type=link"));
        Assert.Single(links);
        Assert.Equal("pub001", links[0].ShortCode);
    }

    [Fact]
    public async Task Short_code_routes_lookup_verify_and_count_clicks()
    {
        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com", customCode = "open01" });
        await _client.PostAsJsonAsync("/api/links", new { url = "https://example.com", customCode = "pw001", isPasswordProtected = true, password = "correctpass" });
        _client.DefaultRequestHeaders.Authorization = null;

        var lookup = await _client.GetAsync("/api/links/code/open01");
        Assert.Equal(HttpStatusCode.OK, lookup.StatusCode);
        Assert.False((await Read<LinkBody>(lookup)).IsPasswordProtected);

        var okPassword = await _client.PostAsJsonAsync("/api/links/code/pw001", new { password = "correctpass" });
        Assert.True(await okPassword.Content.ReadFromJsonAsync<bool>());

        var badPassword = await _client.PostAsJsonAsync("/api/links/code/pw001", new { password = "wrongpass" });
        Assert.False(await badPassword.Content.ReadFromJsonAsync<bool>());

        var protectedLookup = await _client.GetAsync("/api/links/code/pw001");
        Assert.Equal(HttpStatusCode.Forbidden, protectedLookup.StatusCode);
        Assert.Equal("PASSWORD_REQUIRED", (await Read<ErrorEnvelope>(protectedLookup)).Error.Code);

        var click = await _client.PostAsync("/api/links/code/open01/click", null);
        Assert.Equal(HttpStatusCode.OK, click.StatusCode);
        var afterClick = await Read<LinkBody>(await _client.GetAsync("/api/links/code/open01"));
        Assert.Equal(1, afterClick.Visits);

        var missingClick = await _client.PostAsync("/api/links/code/missing/click", null);
        Assert.Equal(HttpStatusCode.OK, missingClick.StatusCode);

        var missingPassword = await _client.PostAsJsonAsync("/api/links/code/pw001", new { });
        Assert.Equal(HttpStatusCode.BadRequest, missingPassword.StatusCode);

        var missingCode = await _client.GetAsync("/api/links/code/nope");
        Assert.Equal(HttpStatusCode.NotFound, missingCode.StatusCode);
    }

    [Fact]
    public async Task Short_code_public_access_rejects_private_and_inactive_links()
    {
        var auth = await Signup("owner", "owner@example.com");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var inactive = await Read<LinkBody>(await _client.PostAsJsonAsync("/api/links", new { url = "https://inactive.example.com", customCode = "off001" }));
        await _client.PutAsJsonAsync($"/api/links/{inactive.Id}", new { isActive = false });
        await _client.PostAsJsonAsync("/api/links", new { url = "https://private.example.com", customCode = "priv02", isPublic = false });
        _client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/links/code/off001")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/links/code/priv02")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsJsonAsync("/api/links/code/off001", new { password = "whatever" })).StatusCode);
    }

    [Fact]
    public async Task Health_routes_are_available()
    {
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/health/live")).StatusCode);
        var readyResponse = await _client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, readyResponse.StatusCode);
        var ready = await Read<ReadyBody>(readyResponse);
        Assert.True(ready.Checks.ContainsKey("database"));
        Assert.True(ready.Checks.ContainsKey("redis"));
    }

    [Fact]
    public async Task Unknown_route_returns_json_not_found()
    {
        var response = await _client.GetAsync("/api/nope");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("NOT_FOUND", (await Read<ErrorEnvelope>(response)).Error.Code);
    }

    private async Task<AuthBody> Signup(string username, string email)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/signup", new { username, email, password = "password123" });
        response.EnsureSuccessStatusCode();
        return await Read<AuthBody>(response);
    }

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(text, JsonOptions) ?? throw new InvalidOperationException($"Could not parse response: {text}");
    }

    private static string MakeToken(string userId, DateTime? expires = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("test-secret-at-least-32-characters-long"));
        var token = new JwtSecurityToken(
            claims: [new Claim("sub", userId)],
            expires: expires ?? DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static void AssertNoPasswordField(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                Assert.False(item.TryGetProperty("password", out _));
            }
            return;
        }

        Assert.False(doc.RootElement.TryGetProperty("password", out _));
    }
}
