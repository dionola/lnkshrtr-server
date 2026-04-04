using Lnkshrtr.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lnkshrtr.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public virtual async Task InitializeAsync()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Test");
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-at-least-32-characters-long");
        Environment.SetEnvironmentVariable("REDIS_ENABLED", "false");
        Environment.SetEnvironmentVariable("THROTTLE_LIMIT", "5000");
        Environment.SetEnvironmentVariable("APPLY_MIGRATIONS", "true");
        Environment.SetEnvironmentVariable("GOOGLE_CLIENT_ID", null);
        Environment.SetEnvironmentVariable("GOOGLE_CLIENT_SECRET", null);
        Environment.SetEnvironmentVariable("GOOGLE_CALLBACK_URL", null);
        Environment.SetEnvironmentVariable("GOOGLE_TOKEN_URL", null);
        Environment.SetEnvironmentVariable("GOOGLE_USERINFO_URL", null);
        Environment.SetEnvironmentVariable("DATABASE_URL", TestDatabaseUrl);
        Environment.SetEnvironmentVariable("TEST_DATABASE_URL", TestDatabaseUrl);
        ConfigureEnvironment();

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    public new virtual async Task DisposeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");
        ConfigureTestWebHost(builder);
    }

    protected virtual void ConfigureTestWebHost(IWebHostBuilder builder)
    {
    }

    protected virtual void ConfigureEnvironment()
    {
    }

    public virtual async Task ResetDb()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Links.RemoveRange(db.Links);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();
    }

    public async Task<AppDbContext> Db()
    {
        var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await Task.CompletedTask;
        return db;
    }

    private static string TestDatabaseUrl =>
        Environment.GetEnvironmentVariable("TEST_DATABASE_URL")
        ?? "postgresql://postgres:password@localhost:5432/lnkshrtr_aspnet_test";
}
