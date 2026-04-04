using Lnkshrtr.Infrastructure.Data;
using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Errors;
using Lnkshrtr.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class PublicProfileService(AppDbContext db, CacheService cache) : IPublicProfileService
{
    public async Task<UserResponse> GetPublicUserAsync(string username)
    {
        var cacheKey = CacheService.PublicUser(username);
        var cached = await cache.GetAsync<UserResponse>(cacheKey);
        if (cached is not null) return cached;

        var user = await db.Users.FirstOrDefaultAsync(x => x.Username == username)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "User not found");
        var response = new UserResponse(user.Id, user.Username, user.Email, user.CreatedAt);
        await cache.SetAsync(cacheKey, response);
        return response;
    }

    public async Task<IReadOnlyList<LinkResponse>> GetPublicLinksAsync(string username, string? type)
    {
        if (type is not null && type != "link") throw new AppException(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Invalid type");
        var cacheKey = CacheService.PublicLinks(username, type);
        var cached = await cache.GetAsync<List<LinkResponse>>(cacheKey);
        if (cached is not null) return cached;

        var user = await db.Users.FirstOrDefaultAsync(x => x.Username == username)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "User not found");

        var links = await db.Links
            .Where(x => x.UserId == user.Id && x.IsPublic && x.IsActive && (type == null || x.Type == type))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => LinkResponse.From(x))
            .ToListAsync();

        await cache.SetAsync(cacheKey, links);
        return links;
    }
}
