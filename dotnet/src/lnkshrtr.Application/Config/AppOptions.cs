using Microsoft.Extensions.Configuration;

namespace Lnkshrtr.Application.Config;

public sealed class AppOptions
{
    public string DatabaseUrl { get; init; } = "";
    public string JwtSecret { get; init; } = "";
    public string JwtExpiresIn { get; init; } = "7d";
    public int BcryptRounds { get; init; } = 10;
    public string FrontendUrl { get; init; } = "http://localhost:5173";
    public string? RedisUrl { get; init; }
    public bool RedisEnabled { get; init; } = true;
    public string? GoogleClientId { get; init; }
    public string? GoogleClientSecret { get; init; }
    public string? GoogleCallbackUrl { get; init; }
    public string GoogleAuthUrl { get; init; } = "https://accounts.google.com/o/oauth2/v2/auth";
    public string GoogleTokenUrl { get; init; } = "https://oauth2.googleapis.com/token";
    public string GoogleUserInfoUrl { get; init; } = "https://www.googleapis.com/oauth2/v3/userinfo";
    public int ThrottleLimit { get; init; } = 500;
    public TimeSpan ThrottleWindow { get; init; } = TimeSpan.FromMinutes(15);
    public bool ApplyMigrations { get; init; } = true;

    public static AppOptions FromEnvironment(IConfiguration configuration)
    {
        var isTest = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Test", StringComparison.OrdinalIgnoreCase);
        var databaseUrl = isTest
            ? Environment.GetEnvironmentVariable("TEST_DATABASE_URL") ?? Environment.GetEnvironmentVariable("DATABASE_URL")
            : Environment.GetEnvironmentVariable("DATABASE_URL");

        return new AppOptions
        {
            DatabaseUrl = databaseUrl ?? configuration.GetConnectionString("Default") ?? "",
            JwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? configuration["Jwt:Secret"] ?? "",
            JwtExpiresIn = Environment.GetEnvironmentVariable("JWT_EXPIRES_IN") ?? configuration["Jwt:ExpiresIn"] ?? "7d",
            BcryptRounds = int.TryParse(Environment.GetEnvironmentVariable("BCRYPT_ROUNDS") ?? configuration["BcryptRounds"], out var rounds) ? rounds : 10,
            FrontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? configuration["FrontendUrl"] ?? "http://localhost:5173",
            RedisUrl = Environment.GetEnvironmentVariable("REDIS_URL") ?? configuration["Redis:Url"],
            RedisEnabled = !string.Equals(Environment.GetEnvironmentVariable("REDIS_ENABLED") ?? configuration["Redis:Enabled"], "false", StringComparison.OrdinalIgnoreCase),
            GoogleClientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? configuration["Google:ClientId"],
            GoogleClientSecret = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET") ?? configuration["Google:ClientSecret"],
            GoogleCallbackUrl = Environment.GetEnvironmentVariable("GOOGLE_CALLBACK_URL") ?? configuration["Google:CallbackUrl"] ?? "http://localhost:3006/api/auth/google/callback",
            GoogleAuthUrl = Environment.GetEnvironmentVariable("GOOGLE_AUTH_URL") ?? configuration["Google:AuthUrl"] ?? "https://accounts.google.com/o/oauth2/v2/auth",
            GoogleTokenUrl = Environment.GetEnvironmentVariable("GOOGLE_TOKEN_URL") ?? configuration["Google:TokenUrl"] ?? "https://oauth2.googleapis.com/token",
            GoogleUserInfoUrl = Environment.GetEnvironmentVariable("GOOGLE_USERINFO_URL") ?? configuration["Google:UserInfoUrl"] ?? "https://www.googleapis.com/oauth2/v3/userinfo",
            ThrottleLimit = int.TryParse(Environment.GetEnvironmentVariable("THROTTLE_LIMIT") ?? configuration["Throttle:Limit"], out var throttleLimit) ? throttleLimit : 500,
            ThrottleWindow = ParseDuration(Environment.GetEnvironmentVariable("THROTTLE_WINDOW") ?? configuration["Throttle:Window"], TimeSpan.FromMinutes(15)),
            ApplyMigrations = !string.Equals(Environment.GetEnvironmentVariable("APPLY_MIGRATIONS") ?? configuration["ApplyMigrations"], "false", StringComparison.OrdinalIgnoreCase)
        };
    }

    public TimeSpan JwtLifetime()
    {
        if (JwtExpiresIn.EndsWith('d') && int.TryParse(JwtExpiresIn[..^1], out var days)) return TimeSpan.FromDays(days);
        if (JwtExpiresIn.EndsWith('h') && int.TryParse(JwtExpiresIn[..^1], out var hours)) return TimeSpan.FromHours(hours);
        if (JwtExpiresIn.EndsWith('m') && int.TryParse(JwtExpiresIn[..^1], out var minutes)) return TimeSpan.FromMinutes(minutes);
        return TimeSpan.FromDays(7);
    }

    public bool GoogleConfigured() =>
        !string.IsNullOrWhiteSpace(GoogleClientId)
        && !string.IsNullOrWhiteSpace(GoogleClientSecret)
        && !string.IsNullOrWhiteSpace(GoogleCallbackUrl);

    private static TimeSpan ParseDuration(string? value, TimeSpan fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        if (TimeSpan.TryParse(value, out var parsed)) return parsed;
        if (value.EndsWith('d') && int.TryParse(value[..^1], out var days)) return TimeSpan.FromDays(days);
        if (value.EndsWith('h') && int.TryParse(value[..^1], out var hours)) return TimeSpan.FromHours(hours);
        if (value.EndsWith('m') && int.TryParse(value[..^1], out var minutes)) return TimeSpan.FromMinutes(minutes);
        if (value.EndsWith('s') && int.TryParse(value[..^1], out var seconds)) return TimeSpan.FromSeconds(seconds);
        return fallback;
    }
}
