using System.Text.Json;
using Lnkshrtr.Application.Errors;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Lnkshrtr.Api.Infrastructure;

public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            await WriteError(context, ex.StatusCode, ex.Code, ex.Message);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await WriteError(context, StatusCodes.Status409Conflict, "CONFLICT", "Resource already exists");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled request error");
            await WriteError(context, StatusCodes.Status500InternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error");
        }
    }

    private static async Task WriteError(HttpContext context, int statusCode, string code, string message)
    {
        if (context.Response.HasStarted) return;
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        var payload = JsonSerializer.Serialize(new { error = new { code, message } });
        await context.Response.WriteAsync(payload);
    }
}
