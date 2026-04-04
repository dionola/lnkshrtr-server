using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Lnkshrtr.Api.Tests;

public sealed class OAuthFactory : ApiFactory
{
    public FakeGoogleHttpClientFactory Google { get; } = new();

    protected override void ConfigureEnvironment()
    {
        Environment.SetEnvironmentVariable("GOOGLE_CLIENT_ID", "google-client");
        Environment.SetEnvironmentVariable("GOOGLE_CLIENT_SECRET", "google-secret");
        Environment.SetEnvironmentVariable("GOOGLE_CALLBACK_URL", "http://localhost:3006/api/auth/google/callback");
        Environment.SetEnvironmentVariable("GOOGLE_TOKEN_URL", "https://google.test/token");
        Environment.SetEnvironmentVariable("GOOGLE_USERINFO_URL", "https://google.test/userinfo");
    }

    protected override void ConfigureTestWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IHttpClientFactory>(Google);
        });
    }
}

public sealed class FakeGoogleHttpClientFactory : IHttpClientFactory
{
    public HttpStatusCode TokenStatus { get; set; } = HttpStatusCode.OK;
    public HttpStatusCode UserInfoStatus { get; set; } = HttpStatusCode.OK;
    public string TokenBody { get; set; } = """{"access_token":"google-access-token"}""";
    public string UserInfoBody { get; set; } = """{"email":"GoogleUser@Example.com","name":"Google User","given_name":"Google","sub":"google-sub-1"}""";

    public HttpClient CreateClient(string name) => new(new Handler(this)) { BaseAddress = new Uri("https://google.test") };

    private sealed class Handler(FakeGoogleHttpClientFactory owner) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri?.AbsoluteUri == "https://google.test/token")
            {
                return Task.FromResult(Json(owner.TokenStatus, owner.TokenBody));
            }

            if (request.RequestUri?.AbsoluteUri == "https://google.test/userinfo")
            {
                return Task.FromResult(Json(owner.UserInfoStatus, owner.UserInfoBody));
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }

        private static HttpResponseMessage Json(HttpStatusCode status, string body) => new(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
    }
}
