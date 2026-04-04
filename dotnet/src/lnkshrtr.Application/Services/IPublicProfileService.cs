using Lnkshrtr.Application.Dtos;

namespace Lnkshrtr.Application.Services;

public interface IPublicProfileService
{
    Task<UserResponse> GetPublicUserAsync(string username);
    Task<IReadOnlyList<LinkResponse>> GetPublicLinksAsync(string username, string? type);
}
