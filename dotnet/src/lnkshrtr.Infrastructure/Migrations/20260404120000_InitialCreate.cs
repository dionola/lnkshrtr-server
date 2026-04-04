using System;
using Lnkshrtr.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lnkshrtr.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260404120000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "users",
            columns: table => new
            {
                id = table.Column<string>(type: "text", nullable: false),
                email = table.Column<string>(type: "text", nullable: false),
                username = table.Column<string>(type: "text", nullable: false),
                password = table.Column<string>(type: "text", nullable: true),
                googleId = table.Column<string>(type: "text", nullable: true),
                createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_users", x => x.id));

        migrationBuilder.CreateTable(
            name: "links",
            columns: table => new
            {
                id = table.Column<string>(type: "text", nullable: false),
                shortCode = table.Column<string>(type: "text", nullable: false),
                originalUrl = table.Column<string>(type: "text", nullable: false),
                title = table.Column<string>(type: "text", nullable: true),
                isPublic = table.Column<bool>(type: "boolean", nullable: false),
                isActive = table.Column<bool>(type: "boolean", nullable: false),
                isPasswordProtected = table.Column<bool>(type: "boolean", nullable: false),
                password = table.Column<string>(type: "text", nullable: true),
                userId = table.Column<string>(type: "text", nullable: true),
                type = table.Column<string>(type: "text", nullable: false),
                visits = table.Column<int>(type: "integer", nullable: false),
                createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_links", x => x.id);
                table.ForeignKey("FK_links_users_userId", x => x.userId, "users", "id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex("IX_links_shortCode", "links", "shortCode", unique: true);
        migrationBuilder.CreateIndex("IX_links_userId", "links", "userId");
        migrationBuilder.CreateIndex("IX_users_email", "users", "email", unique: true);
        migrationBuilder.CreateIndex("IX_users_googleId", "users", "googleId", unique: true);
        migrationBuilder.CreateIndex("IX_users_username", "users", "username", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "links");
        migrationBuilder.DropTable(name: "users");
    }
}
