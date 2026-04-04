using System;
using Lnkshrtr.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lnkshrtr.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.7")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity("Lnkshrtr.Domain.Models.Link", b =>
        {
            b.Property<string>("Id").HasColumnType("text").HasColumnName("id");
            b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone").HasColumnName("createdAt");
            b.Property<bool>("IsActive").HasColumnType("boolean").HasColumnName("isActive");
            b.Property<bool>("IsPasswordProtected").HasColumnType("boolean").HasColumnName("isPasswordProtected");
            b.Property<bool>("IsPublic").HasColumnType("boolean").HasColumnName("isPublic");
            b.Property<string>("OriginalUrl").IsRequired().HasColumnType("text").HasColumnName("originalUrl");
            b.Property<string>("Password").HasColumnType("text").HasColumnName("password");
            b.Property<string>("ShortCode").IsRequired().HasColumnType("text").HasColumnName("shortCode");
            b.Property<string>("Title").HasColumnType("text").HasColumnName("title");
            b.Property<string>("Type").IsRequired().HasColumnType("text").HasColumnName("type");
            b.Property<DateTime>("UpdatedAt").HasColumnType("timestamp with time zone").HasColumnName("updatedAt");
            b.Property<string>("UserId").HasColumnType("text").HasColumnName("userId");
            b.Property<int>("Visits").HasColumnType("integer").HasColumnName("visits");
            b.HasKey("Id");
            b.HasIndex("ShortCode").IsUnique();
            b.HasIndex("UserId");
            b.ToTable("links", (string)null);
        });

        modelBuilder.Entity("Lnkshrtr.Domain.Models.User", b =>
        {
            b.Property<string>("Id").HasColumnType("text").HasColumnName("id");
            b.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone").HasColumnName("createdAt");
            b.Property<string>("Email").IsRequired().HasColumnType("text").HasColumnName("email");
            b.Property<string>("GoogleId").HasColumnType("text").HasColumnName("googleId");
            b.Property<string>("Password").HasColumnType("text").HasColumnName("password");
            b.Property<string>("Username").IsRequired().HasColumnType("text").HasColumnName("username");
            b.HasKey("Id");
            b.HasIndex("Email").IsUnique();
            b.HasIndex("GoogleId").IsUnique();
            b.HasIndex("Username").IsUnique();
            b.ToTable("users", (string)null);
        });

        modelBuilder.Entity("Lnkshrtr.Domain.Models.Link", b =>
        {
            b.HasOne("Lnkshrtr.Domain.Models.User", "User")
                .WithMany("Links")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.SetNull);
            b.Navigation("User");
        });

        modelBuilder.Entity("Lnkshrtr.Domain.Models.User", b => b.Navigation("Links"));
    }
}
