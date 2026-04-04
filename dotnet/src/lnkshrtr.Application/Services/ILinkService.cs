using System.Security.Claims;
using Lnkshrtr.Application.Dtos;

namespace Lnkshrtr.Application.Services;

public interface ILinkService
{
    Task<IReadOnlyList<LinkResponse>> GetUserLinksAsync(ClaimsPrincipal principal, string? type);
    Task<LinkResponse> CreateAsync(CreateLinkRequest request, ClaimsPrincipal principal, string authorizationHeader);
    Task<LinkResponse> UpdateAsync(ClaimsPrincipal principal, string id, UpdateLinkRequest request);
    Task DeleteAsync(ClaimsPrincipal principal, string id);
    Task<LinkResponse> GetPublicByCodeAsync(string shortCode);
    Task RecordClickAsync(string shortCode);
    Task<bool> VerifyPasswordAsync(string shortCode, VerifyPasswordRequest request);
}
