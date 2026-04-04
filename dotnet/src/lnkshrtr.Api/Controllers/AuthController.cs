using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lnkshrtr.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("signup")]
    public async Task<ActionResult<AuthResponse>> Signup(SignupRequest request) =>
        Created("", await auth.SignupAsync(request));

    [HttpPost("login")]
    public Task<AuthResponse> Login(LoginRequest request) =>
        auth.LoginAsync(request);

    [Authorize]
    [HttpGet("me")]
    public Task<UserResponse> Me() =>
        auth.GetCurrentUserAsync(User);

    [HttpGet("google")]
    public IActionResult Google() =>
        Redirect(auth.BuildGoogleAuthUrl());

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? code) =>
        Redirect(await auth.CompleteGoogleCallbackAsync(code));
}
