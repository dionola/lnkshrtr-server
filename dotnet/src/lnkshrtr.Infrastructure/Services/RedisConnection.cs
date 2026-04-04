using Lnkshrtr.Application.Config;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class RedisConnection(AppOptions options, ILogger<RedisConnection> logger) : IAsyncDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private ConnectionMultiplexer? _connection;
    private bool _attempted;

    public bool Enabled => options.RedisEnabled && !string.IsNullOrWhiteSpace(options.RedisUrl);

    public async Task<IDatabase?> DatabaseAsync()
    {
        var connection = await ConnectionAsync();
        return connection?.GetDatabase();
    }

    public async Task<bool> PingAsync()
    {
        try
        {
            var db = await DatabaseAsync();
            if (db is null) return false;
            await db.PingAsync();
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis ping failed");
            return false;
        }
    }

    private async Task<ConnectionMultiplexer?> ConnectionAsync()
    {
        if (!Enabled) return null;
        if (_connection is { IsConnected: true }) return _connection;
        if (_attempted && _connection is null) return null;

        await _lock.WaitAsync();
        try
        {
            if (_connection is { IsConnected: true }) return _connection;
            if (_attempted && _connection is null) return null;

            _attempted = true;
            _connection = await ConnectionMultiplexer.ConnectAsync(options.RedisUrl!);
            _connection.ConnectionFailed += (_, args) => logger.LogWarning("Redis connection failed: {FailureType}", args.FailureType);
            _connection.ConnectionRestored += (_, _) => logger.LogInformation("Redis connection restored");
            return _connection;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis unavailable; continuing without cache");
            _connection = null;
            return null;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null) await _connection.DisposeAsync();
        _lock.Dispose();
    }
}
