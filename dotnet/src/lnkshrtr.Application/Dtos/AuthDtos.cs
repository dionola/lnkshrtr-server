using System.ComponentModel.DataAnnotations;

namespace Lnkshrtr.Application.Dtos;

public sealed record SignupRequest(
    [Required, MinLength(3)] string? Username,
    [Required, EmailAddress] string? Email,
    [Required, MinLength(6)] string? Password);

public sealed record LoginRequest(
    [Required, EmailAddress] string? Email,
    [Required] string? Password);

public sealed record UserResponse(string Id, string Username, string Email, DateTime CreatedAt);
public sealed record AuthResponse(UserResponse User, string AccessToken);
