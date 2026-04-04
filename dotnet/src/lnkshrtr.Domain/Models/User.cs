namespace Lnkshrtr.Domain.Models;

public sealed class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = "";
    public string Username { get; set; } = "";
    public string? Password { get; set; }
    public string? GoogleId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Link> Links { get; set; } = [];
}
