using System.ComponentModel.DataAnnotations;
using Lnkshrtr.Domain.Models;

namespace Lnkshrtr.Application.Dtos;

public sealed record CreateLinkRequest(
    string? Url,
    string? CustomCode,
    bool IsPublic = true,
    bool IsPasswordProtected = false,
    string? Password = null,
    string? UserId = null,
    string Type = "link");

public sealed record UpdateLinkRequest(string? Title, bool? IsPublic, bool? IsActive, bool? IsPasswordProtected, string? Password);
public sealed record VerifyPasswordRequest([Required] string? Password);

public sealed record LinkResponse(
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
    DateTime UpdatedAt)
{
    public static LinkResponse From(Link link) => new(
        link.Id,
        link.ShortCode,
        link.OriginalUrl,
        link.Title,
        link.IsPublic,
        link.IsActive,
        link.IsPasswordProtected,
        link.UserId,
        link.Type,
        link.Visits,
        link.CreatedAt,
        link.UpdatedAt);
}
