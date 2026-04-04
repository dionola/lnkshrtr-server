using System.Security.Cryptography;
using Lnkshrtr.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lnkshrtr.Infrastructure.Services;

public sealed class ShortCodeService(AppDbContext db)
{
    private const string Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    public async Task<string> GenerateUniqueAsync()
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = Generate();
            if (!await db.Links.AnyAsync(x => x.ShortCode == code)) return code;
        }

        throw new InvalidOperationException("Unable to generate a unique short code");
    }

    private static string Generate()
    {
        Span<byte> bytes = stackalloc byte[6];
        RandomNumberGenerator.Fill(bytes);
        return new string(bytes.ToArray().Select(b => Alphabet[b % Alphabet.Length]).ToArray());
    }
}
