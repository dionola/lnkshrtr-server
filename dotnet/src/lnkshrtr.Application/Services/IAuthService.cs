using System.Security.Claims;
using Lnkshrtr.Application.Dtos;

namespace Lnkshrtr.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> SignupAsync(SignupRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<UserResponse> GetCurrentUserAsync(ClaimsPrincipal principal);
    string BuildGoogleAuthUrl();
    Task<string> CompleteGoogleCallbackAsync(string? code);
}
