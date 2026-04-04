using Lnkshrtr.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Lnkshrtr.Infrastructure.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Link> Links => Set<Link>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.GoogleId).IsUnique();
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email").IsRequired();
            entity.Property(x => x.Username).HasColumnName("username").IsRequired();
            entity.Property(x => x.Password).HasColumnName("password");
            entity.Property(x => x.GoogleId).HasColumnName("googleId");
            entity.Property(x => x.CreatedAt).HasColumnName("createdAt");
        });

        modelBuilder.Entity<Link>(entity =>
        {
            entity.ToTable("links");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.ShortCode).IsUnique();
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ShortCode).HasColumnName("shortCode").IsRequired();
            entity.Property(x => x.OriginalUrl).HasColumnName("originalUrl").IsRequired();
            entity.Property(x => x.Title).HasColumnName("title");
            entity.Property(x => x.IsPublic).HasColumnName("isPublic");
            entity.Property(x => x.IsActive).HasColumnName("isActive");
            entity.Property(x => x.IsPasswordProtected).HasColumnName("isPasswordProtected");
            entity.Property(x => x.Password).HasColumnName("password");
            entity.Property(x => x.UserId).HasColumnName("userId");
            entity.Property(x => x.Type).HasColumnName("type");
            entity.Property(x => x.Visits).HasColumnName("visits");
            entity.Property(x => x.CreatedAt).HasColumnName("createdAt");
            entity.Property(x => x.UpdatedAt).HasColumnName("updatedAt");
            entity.HasOne(x => x.User).WithMany(x => x.Links).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
