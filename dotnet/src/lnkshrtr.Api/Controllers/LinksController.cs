using Lnkshrtr.Application.Dtos;
using Lnkshrtr.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lnkshrtr.Api.Controllers;

[ApiController]
[Route("api/links")]
public sealed class LinksController(ILinkService links) : ControllerBase
{
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LinkResponse>>> GetUserLinks([FromQuery] string? type) =>
        Ok(await links.GetUserLinksAsync(User, type));

    [HttpPost]
    public async Task<ActionResult<LinkResponse>> Create(CreateLinkRequest request) =>
        Created("", await links.CreateAsync(request, User, Request.Headers.Authorization.ToString()));

    [Authorize]
    [HttpPut("{id}")]
    public Task<LinkResponse> Update(string id, UpdateLinkRequest request) =>
        links.UpdateAsync(User, id, request);

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await links.DeleteAsync(User, id);
        return NoContent();
    }

    [HttpGet("code/{shortCode}")]
    public Task<LinkResponse> GetByCode(string shortCode) =>
        links.GetPublicByCodeAsync(shortCode);

    [HttpPost("code/{shortCode}/click")]
    public async Task<IActionResult> RecordClick(string shortCode)
    {
        await links.RecordClickAsync(shortCode);
        return Ok(new { });
    }

    [HttpPost("code/{shortCode}")]
    public Task<bool> VerifyPassword(string shortCode, VerifyPasswordRequest request) =>
        links.VerifyPasswordAsync(shortCode, request);
}
