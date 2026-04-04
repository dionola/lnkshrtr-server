using System.Security.Claims;
using Lnkshrtr.Application.Config;
using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Errors;
using Lnkshrtr.Application.Services;
using Lnkshrtr.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class LinkService(AppDbContext db, ShortCodeService shortCodes, CacheService cache, AppOptions options, ILogger<LinkService> logger) : ILinkService
{
    public async Task<IReadOnlyList<LinkResponse>> GetUserLinksAsync(ClaimsPrincipal principal, string? type)
    {
        if (type is not null && type != "link") throw ValidationError("Invalid type");
        var user = await RequireUserAsync(principal);
        var cacheKey = CacheService.UserLinks(user.Id, type);
        var cached = await cache.GetAsync<List<LinkResponse>>(cacheKey);
        if (cached is not null) return cached;

        var links = await db.Links
            .Where(x => x.UserId == user.Id && (type == null || x.Type == type))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => LinkResponse.From(x))
            .ToListAsync();

        await cache.SetAsync(cacheKey, links);
        return links;
    }

    public async Task<LinkResponse> CreateAsync(CreateLinkRequest request, ClaimsPrincipal principal, string authorizationHeader)
    {
        ValidateCreate(request);
        var user = await OptionalUserAsync(principal, authorizationHeader);
        var shortCode = request.CustomCode ?? await shortCodes.GenerateUniqueAsync();

        if (request.CustomCode is not null && await db.Links.AnyAsync(x => x.ShortCode == shortCode))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Short code is already in use");
        }

        var link = new Link
        {
            ShortCode = shortCode,
            OriginalUrl = request.Url!,
            Title = ExtractTitle(request.Url!),
            IsPublic = request.IsPublic,
            IsPasswordProtected = request.IsPasswordProtected,
            Password = request.IsPasswordProtected ? BCrypt.Net.BCrypt.HashPassword(request.Password!, options.BcryptRounds) : null,
            UserId = user?.Id,
            Type = request.Type
        };

        db.Links.Add(link);
        await db.SaveChangesAsync();
        if (user is not null) await ClearUserLinkCachesAsync(user, link.ShortCode);

        return LinkResponse.From(link);
    }

    public async Task<LinkResponse> UpdateAsync(ClaimsPrincipal principal, string id, UpdateLinkRequest request)
    {
        var user = await RequireUserAsync(principal);
        var link = await OwnedLinkAsync(user, id);

        if (request.Title is not null && request.Title.Length == 0) throw ValidationError("Title is required");
        if (request.IsPasswordProtected == true && request.Password is { Length: < 6 }) throw ValidationError("Password must be at least 6 characters");

        if (request.Title is not null) link.Title = request.Title;
        if (request.IsPublic.HasValue) link.IsPublic = request.IsPublic.Value;
        if (request.IsActive.HasValue) link.IsActive = request.IsActive.Value;
        if (request.IsPasswordProtected.HasValue)
        {
            link.IsPasswordProtected = request.IsPasswordProtected.Value;
            if (request.IsPasswordProtected.Value && request.Password is not null)
            {
                link.Password = BCrypt.Net.BCrypt.HashPassword(request.Password, options.BcryptRounds);
            }
            else if (!request.IsPasswordProtected.Value)
            {
                link.Password = null;
            }
        }

        link.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await ClearUserLinkCachesAsync(user, link.ShortCode);
        return LinkResponse.From(link);
    }

    public async Task DeleteAsync(ClaimsPrincipal principal, string id)
    {
        var user = await RequireUserAsync(principal);
        var link = await OwnedLinkAsync(user, id);

        db.Links.Remove(link);
        await db.SaveChangesAsync();
        await ClearUserLinkCachesAsync(user, link.ShortCode);
    }

    public async Task<LinkResponse> GetPublicByCodeAsync(string shortCode)
    {
        var cacheKey = CacheService.LinkByCode(shortCode);
        var cached = await cache.GetAsync<LinkResponse>(cacheKey);
        if (cached is not null) return cached;

        var link = await PublicLinkByCodeAsync(shortCode)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "Short code not found");
        if (link.IsPasswordProtected)
        {
            throw new AppException(StatusCodes.Status403Forbidden, "PASSWORD_REQUIRED", "Password is required to access this link");
        }

        var response = LinkResponse.From(link);
        await cache.SetAsync(cacheKey, response);
        return response;
    }

    public async Task RecordClickAsync(string shortCode)
    {
        try
        {
            var link = await PublicLinkByCodeAsync(shortCode);
            if (link is null) return;

            link.Visits += 1;
            link.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await cache.DeleteAsync(CacheService.LinkByCode(shortCode));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to increment visit count for {ShortCode}", shortCode);
        }
    }

    public async Task<bool> VerifyPasswordAsync(string shortCode, VerifyPasswordRequest request)
    {
        var link = await PublicLinkByCodeAsync(shortCode)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "Short code not found");

        return !link.IsPasswordProtected || link.Password is null || BCrypt.Net.BCrypt.Verify(request.Password!, link.Password);
    }

    private async Task<Link> OwnedLinkAsync(User user, string id)
    {
        var link = await db.Links.FindAsync(id) ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "Link not found");
        if (link.UserId != user.Id) throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "You do not own this link");
        return link;
    }

    private Task<Link?> PublicLinkByCodeAsync(string shortCode) =>
        db.Links.FirstOrDefaultAsync(x => x.ShortCode == shortCode && x.IsActive && x.IsPublic);

    private async Task<User> RequireUserAsync(ClaimsPrincipal principal)
    {
        var userId = principal.FindFirstValue("sub");
        if (userId is null) throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Invalid token");
        return await db.Users.FindAsync(userId) ?? throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "User no longer exists");
    }

    private async Task<User?> OptionalUserAsync(ClaimsPrincipal principal, string authorizationHeader)
    {
        if (!authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        return principal.Identity?.IsAuthenticated == true ? await RequireUserAsync(principal) : null;
    }

    private Task ClearUserLinkCachesAsync(User user, string shortCode) =>
        cache.DeleteAsync(
            CacheService.LinkByCode(shortCode),
            CacheService.UserLinks(user.Id, null),
            CacheService.UserLinks(user.Id, "link"),
            CacheService.PublicLinks(user.Username, null),
            CacheService.PublicLinks(user.Username, "link"));

    private static void ValidateCreate(CreateLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Url)) throw ValidationError("URL is required");
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            throw ValidationError("URL must be a valid http or https address");
        }
        if (request.CustomCode is { Length: 0 }) throw ValidationError("Custom code is required");
        if (request.CustomCode is not null && !ValidCustomCode(request.CustomCode))
        {
            throw ValidationError("Custom code must be 3-64 characters and use only letters, numbers, hyphens, or underscores");
        }
        if (request.Type != "link") throw ValidationError("Invalid type");
        if (request.IsPasswordProtected && (request.Password is null || request.Password.Length < 6))
        {
            throw ValidationError("Password must be at least 6 characters when protection is enabled");
        }
    }

    private static AppException ValidationError(string message) => new(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", message);

    private static bool ValidCustomCode(string value) =>
        value.Length is >= 3 and <= 64 && value.All(c => char.IsLetterOrDigit(c) || c is '-' or '_');

    private static string ExtractTitle(string url)
    {
        try { return new Uri(url).Host; }
        catch { return url[..Math.Min(url.Length, 50)]; }
    }
}
