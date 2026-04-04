using Npgsql;

namespace Lnkshrtr.Infrastructure.Data;

public static class DatabaseUrl
{
    public static string ToConnectionString(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) return value;
        if (uri.Scheme is not ("postgres" or "postgresql")) return value;

        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? ""),
            Password = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "")
        };

        return builder.ConnectionString;
    }
}
