using System.Text.Json;
using Lnkshrtr.Application.Dtos;
using StackExchange.Redis;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class CacheService(RedisConnection redis)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<T?> GetAsync<T>(string key)
    {
        var db = await redis.DatabaseAsync();
        if (db is null) return default;
        var value = await db.StringGetAsync(key);
        return value.HasValue ? JsonSerializer.Deserialize<T>((string)value!, JsonOptions) : default;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? ttl = null)
    {
        var db = await redis.DatabaseAsync();
        if (db is null) return;
        await db.StringSetAsync(key, JsonSerializer.Serialize(value, JsonOptions), ttl ?? TimeSpan.FromMinutes(5));
    }

    public async Task DeleteAsync(params string[] keys)
    {
        var db = await redis.DatabaseAsync();
        if (db is null || keys.Length == 0) return;
        await db.KeyDeleteAsync(keys.Select(k => (RedisKey)k).ToArray());
    }

    public Task<bool> PingAsync() => redis.PingAsync();

    public static string LinkByCode(string code) => $"link:{code}";
    public static string PublicUser(string username) => $"public:user:{username}";
    public static string PublicLinks(string username, string? type) => $"public:links:{username}:{type ?? "all"}";
    public static string UserLinks(string userId, string? type) => $"user:links:{userId}:{type ?? "all"}";
}
