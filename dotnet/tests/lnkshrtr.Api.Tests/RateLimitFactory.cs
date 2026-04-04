namespace Lnkshrtr.Api.Tests;

public sealed class RateLimitFactory : ApiFactory
{
    protected override void ConfigureEnvironment()
    {
        Environment.SetEnvironmentVariable("THROTTLE_LIMIT", "2");
        Environment.SetEnvironmentVariable("THROTTLE_WINDOW", "1m");
    }
}
