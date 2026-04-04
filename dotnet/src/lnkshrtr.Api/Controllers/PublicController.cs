using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lnkshrtr.Api.Controllers;

[ApiController]
[Route("api/public")]
public sealed class PublicController(IPublicProfileService publicProfiles) : ControllerBase
{
    [HttpGet("{username}")]
    public Task<UserResponse> GetPublicUser(string username) =>
        publicProfiles.GetPublicUserAsync(username);

    [HttpGet("{username}/links")]
    public async Task<ActionResult<IReadOnlyList<LinkResponse>>> GetPublicLinks(string username, [FromQuery] string? type) =>
        Ok(await publicProfiles.GetPublicLinksAsync(username, type));
}
