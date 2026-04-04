namespace Lnkshrtr.Domain.Models;

public sealed class Link
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ShortCode { get; set; } = "";
    public string OriginalUrl { get; set; } = "";
    public string? Title { get; set; }
    public bool IsPublic { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public bool IsPasswordProtected { get; set; }
    public string? Password { get; set; }
    public string? UserId { get; set; }
    public string Type { get; set; } = "link";
    public int Visits { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public User? User { get; set; }
}
