using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace shuttleup.tests.unit.Dependencies;

internal static class ControllerTestHelper
{
    internal static ShuttleUpDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ShuttleUpDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new ShuttleUpDbContext(options);
    }

    internal static void SetUser(ControllerBase controller, Guid userId, bool includeSub = true)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString())
        };

        if (includeSub)
            claims.Add(new("sub", userId.ToString()));

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = principal
            }
        };
    }
}
