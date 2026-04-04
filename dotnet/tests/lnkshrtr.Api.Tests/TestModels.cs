namespace Lnkshrtr.Api.Tests;

public sealed record ErrorEnvelope(ErrorBody Error);
public sealed record ErrorBody(string Code, string Message);
public sealed record AuthBody(UserBody User, string AccessToken);
public sealed record UserBody(string Id, string Username, string Email, DateTime CreatedAt);
public sealed record LinkBody(
    string Id,
    string ShortCode,
    string OriginalUrl,
    string? Title,
    bool IsPublic,
    bool IsActive,
    bool IsPasswordProtected,
    string? UserId,
    string Type,
    int Visits,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ReadyBody(string Status, DateTime Timestamp, Dictionary<string, string> Checks);
