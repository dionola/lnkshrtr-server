using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Lnkshrtr.Application.Config;
using Lnkshrtr.Domain.Models;
using Microsoft.IdentityModel.Tokens;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class JwtService(AppOptions options)
{
    public string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: [new Claim(JwtRegisteredClaimNames.Sub, user.Id)],
            expires: DateTime.UtcNow.Add(options.JwtLifetime()),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
