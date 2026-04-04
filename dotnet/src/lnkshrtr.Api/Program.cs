using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Lnkshrtr.Application.Config;
using Lnkshrtr.Application.Services;
using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Api.Infrastructure;
using Lnkshrtr.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var options = AppOptions.FromEnvironment(builder.Configuration);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(json =>
{
    json.IncludeScopes = true;
    json.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});

if (string.IsNullOrWhiteSpace(options.DatabaseUrl))
{
    throw new InvalidOperationException("DATABASE_URL is required");
}

if (string.IsNullOrWhiteSpace(options.JwtSecret) || options.JwtSecret.Length < 32)
{
    throw new InvalidOperationException("JWT_SECRET is required and must be at least 32 characters");
}

builder.Services.AddSingleton(options);
builder.Services.AddDbContext<AppDbContext>(db => db.UseNpgsql(DatabaseUrl.ToConnectionString(options.DatabaseUrl)));
builder.Services.AddSingleton<JwtService>();
builder.Services.AddScoped<ShortCodeService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILinkService, LinkService>();
builder.Services.AddScoped<IPublicProfileService, PublicProfileService>();
builder.Services.AddSingleton<RedisConnection>();
builder.Services.AddSingleton<CacheService>();
builder.Services.AddResponseCompression();
builder.Services.AddHttpClient("google");
builder.Services.AddRateLimiter(rateLimiter =>
{
    rateLimiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    rateLimiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = options.ThrottleLimit,
                Window = options.ThrottleWindow,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    rateLimiter.OnRejected = async (context, _) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        var payload = JsonSerializer.Serialize(new { error = new { code = "RATE_LIMITED", message = "Too many requests" } });
        await context.HttpContext.Response.WriteAsync(payload);
    };
});
builder.Services.AddCors(cors =>
{
    cors.AddDefaultPolicy(policy => policy.WithOrigins(options.FrontendUrl).AllowCredentials().WithHeaders("Content-Type", "Authorization").WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
});
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(jwt =>
{
    jwt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.JwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
    jwt.MapInboundClaims = false;
    jwt.Events = new JwtBearerEvents
    {
        OnChallenge = async context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            var payload = JsonSerializer.Serialize(new { error = new { code = "UNAUTHORIZED", message = "Unauthorized" } });
            await context.Response.WriteAsync(payload);
        }
    };
});
builder.Services.AddAuthorization();
builder.Services.AddControllers().ConfigureApiBehaviorOptions(api =>
{
    api.InvalidModelStateResponseFactory = ValidationResponse.Create;
});
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (options.ApplyMigrations)
    {
        db.Database.Migrate();
    }
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api")
        && (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) || HttpMethods.IsPatch(context.Request.Method))
        && context.Request.ContentLength is > 0
        && !context.Request.HasJsonContentType())
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = new { code = "VALIDATION_ERROR", message = "Request body must be JSON" } }));
        return;
    }

    await next();
});
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    if (response.HasStarted || response.ContentLength is not null) return;
    if (response.StatusCode == StatusCodes.Status404NotFound)
    {
        response.ContentType = "application/json";
        await response.WriteAsync(JsonSerializer.Serialize(new { error = new { code = "NOT_FOUND", message = "Route not found" } }));
    }
    else if (response.StatusCode == StatusCodes.Status415UnsupportedMediaType)
    {
        response.StatusCode = StatusCodes.Status400BadRequest;
        response.ContentType = "application/json";
        await response.WriteAsync(JsonSerializer.Serialize(new { error = new { code = "VALIDATION_ERROR", message = "Request body must be JSON" } }));
    }
});
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
    context.Response.Headers.TryAdd("Referrer-Policy", "no-referrer");
    context.Response.Headers.TryAdd("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.TryAdd("Cache-Control", "no-store");
    }
    await next();
});
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
app.UseRateLimiter();
app.UseResponseCompression();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
