FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY lnkshrtr.slnx ./
COPY src/lnkshrtr.Api/lnkshrtr.Api.csproj src/lnkshrtr.Api/
COPY src/lnkshrtr.Application/lnkshrtr.Application.csproj src/lnkshrtr.Application/
COPY src/lnkshrtr.Domain/lnkshrtr.Domain.csproj src/lnkshrtr.Domain/
COPY src/lnkshrtr.Infrastructure/lnkshrtr.Infrastructure.csproj src/lnkshrtr.Infrastructure/
COPY tests/lnkshrtr.Api.Tests/lnkshrtr.Api.Tests.csproj tests/lnkshrtr.Api.Tests/
RUN dotnet restore
COPY . .
RUN dotnet publish src/lnkshrtr.Api/lnkshrtr.Api.csproj -c Release -o /app/publish --no-restore

FROM build AS test
CMD ["dotnet", "test", "lnkshrtr.slnx", "--no-restore", "--logger", "console;verbosity=normal"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runner
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:3006
EXPOSE 3006
ENTRYPOINT ["dotnet", "lnkshrtr.Api.dll"]
