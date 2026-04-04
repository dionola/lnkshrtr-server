using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lnkshrtr.Api.Controllers;

[ApiController]
public sealed class HealthController(AppDbContext db, CacheService cache) : ControllerBase
{
    [HttpGet("/health")]
    public IActionResult Health() => Ok(new { status = "ok" });

    [HttpGet("/health/live")]
    public IActionResult Live() => Ok(new { status = "ok", uptime = Environment.TickCount64 });

    [HttpGet("/health/ready")]
    public async Task<IActionResult> Ready()
    {
        var checks = new Dictionary<string, string>();
        checks["database"] = await db.Database.CanConnectAsync() ? "ok" : "error";
        checks["redis"] = await cache.PingAsync() ? "ok" : "error";
        var healthy = checks.Values.All(x => x == "ok");
        return Ok(new { status = healthy ? "ok" : "degraded", timestamp = DateTime.UtcNow, checks });
    }
}
