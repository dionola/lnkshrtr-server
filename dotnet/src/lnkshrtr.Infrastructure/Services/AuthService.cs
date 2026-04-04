using System.Security.Claims;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Lnkshrtr.Application.Config;
using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Errors;
using Lnkshrtr.Application.Services;
using Lnkshrtr.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class AuthService(AppDbContext db, JwtService jwtService, AppOptions options, IHttpClientFactory httpClientFactory, CacheService cache) : IAuthService
{
    public async Task<AuthResponse> SignupAsync(SignupRequest request)
    {
        var email = request.Email!.ToLowerInvariant();
        var username = request.Username!;

        if (await db.Users.AnyAsync(x => x.Email == email))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Email is already taken");
        }

        if (await db.Users.AnyAsync(x => x.Username == username))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Username is already taken");
        }

        var user = new User
        {
            Email = email,
            Username = username,
            Password = BCrypt.Net.BCrypt.HashPassword(request.Password!, options.BcryptRounds)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return ToAuthResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var email = request.Email!.ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email);

        if (user?.Password is null || !BCrypt.Net.BCrypt.Verify(request.Password!, user.Password))
        {
            throw new AppException(StatusCodes.Status401Unauthorized, "INVALID_CREDENTIALS", "Invalid email or password");
        }

        return ToAuthResponse(user);
    }

    public async Task<UserResponse> GetCurrentUserAsync(ClaimsPrincipal principal) =>
        ToUserResponse(await RequireUserAsync(principal));

    public string BuildGoogleAuthUrl()
    {
        if (!options.GoogleConfigured()) throw GoogleNotConfigured();

        return QueryHelpers.AddQueryString(options.GoogleAuthUrl, new Dictionary<string, string?>
        {
            ["client_id"] = options.GoogleClientId,
            ["redirect_uri"] = options.GoogleCallbackUrl,
            ["response_type"] = "code",
            ["scope"] = "openid email profile"
        });
    }

    public async Task<string> CompleteGoogleCallbackAsync(string? code)
    {
        if (!options.GoogleConfigured()) throw GoogleNotConfigured();
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Missing authorization code");
        }

        var info = await FetchGoogleUserInfoAsync(code);
        var email = info.Email?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new AppException(StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Google account did not include an email");
        }

        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email);
        if (user is null)
        {
            user = new User
            {
                Email = email,
                Username = await UniqueUsernameAsync(SafeUsername(info.Name ?? info.GivenName ?? email.Split('@')[0])),
                Password = null,
                GoogleId = info.Sub
            };
            db.Users.Add(user);
        }
        else if (!string.IsNullOrWhiteSpace(info.Sub) && user.GoogleId is null)
        {
            user.GoogleId = info.Sub;
        }

        await db.SaveChangesAsync();
        await cache.DeleteAsync(CacheService.PublicUser(user.Username));
        return $"{options.FrontendUrl}/auth/callback?token={jwtService.CreateToken(user)}";
    }

    private async Task<GoogleUserInfo> FetchGoogleUserInfoAsync(string code)
    {
        var client = httpClientFactory.CreateClient("google");
        using var tokenResponse = await client.PostAsync(options.GoogleTokenUrl, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = options.GoogleClientId!,
            ["client_secret"] = options.GoogleClientSecret!,
            ["redirect_uri"] = options.GoogleCallbackUrl!,
            ["grant_type"] = "authorization_code"
        }));

        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new AppException(StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Failed to exchange OAuth code");
        }

        var tokenBody = await tokenResponse.Content.ReadFromJsonAsync<GoogleTokenResponse>();
        if (string.IsNullOrWhiteSpace(tokenBody?.AccessToken))
        {
            throw new AppException(StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Google did not return an access token");
        }

        using var infoRequest = new HttpRequestMessage(HttpMethod.Get, options.GoogleUserInfoUrl);
        infoRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenBody.AccessToken);
        using var infoResponse = await client.SendAsync(infoRequest);
        if (!infoResponse.IsSuccessStatusCode)
        {
            throw new AppException(StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Failed to fetch user info from Google");
        }

        return await infoResponse.Content.ReadFromJsonAsync<GoogleUserInfo>() ?? new GoogleUserInfo(null, null, null, null);
    }

    private async Task<string> UniqueUsernameAsync(string usernameBase)
    {
        var username = usernameBase;
        var suffix = 1;
        while (await db.Users.AnyAsync(x => x.Username == username))
        {
            username = $"{usernameBase}_{suffix++}";
        }
        return username;
    }

    private async Task<User> RequireUserAsync(ClaimsPrincipal principal)
    {
        var userId = principal.FindFirstValue("sub");
        if (userId is null) throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Invalid token");
        return await db.Users.FindAsync(userId) ?? throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "User no longer exists");
    }

    private AuthResponse ToAuthResponse(User user) => new(ToUserResponse(user), jwtService.CreateToken(user));

    private static UserResponse ToUserResponse(User user) => new(user.Id, user.Username, user.Email, user.CreatedAt);

    private static AppException GoogleNotConfigured() =>
        new(StatusCodes.Status501NotImplemented, "NOT_CONFIGURED", "Google OAuth is not configured on this server");

    private static string SafeUsername(string value)
    {
        var normalized = new string(value.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) || c == '_' ? c : '_').ToArray()).Trim('_');
        while (normalized.Contains("__", StringComparison.Ordinal)) normalized = normalized.Replace("__", "_", StringComparison.Ordinal);
        return (normalized.Length > 40 ? normalized[..40] : normalized) is { Length: > 0 } result ? result : "user";
    }

    private sealed record GoogleTokenResponse([property: JsonPropertyName("access_token")] string? AccessToken);
    private sealed record GoogleUserInfo(
        [property: JsonPropertyName("email")] string? Email,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("given_name")] string? GivenName,
        [property: JsonPropertyName("sub")] string? Sub);
}
