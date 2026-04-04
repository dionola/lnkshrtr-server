using Microsoft.AspNetCore.Mvc;

namespace Lnkshrtr.Api.Infrastructure;

public static class ValidationResponse
{
    public static IActionResult Create(ActionContext context)
    {
        var message = context.ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault()
            ?? "Validation failed";
        return new BadRequestObjectResult(new { error = new { code = "VALIDATION_ERROR", message } });
    }
}
