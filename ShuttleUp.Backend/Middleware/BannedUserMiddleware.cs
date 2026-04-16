using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Middleware;

public class BannedUserMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<BannedUserMiddleware> _logger;

    public BannedUserMiddleware(RequestDelegate next, ILogger<BannedUserMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IBannedUserCache bannedUserCache)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier) ?? context.User.FindFirst("sub");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                if (bannedUserCache.IsBanned(userId))
                {
                    _logger.LogWarning("Banned user {UserId} attempted to access {Path}", userId, context.Request.Path);
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync("{\"message\": \"account_banned\"}");
                    return;
                }
            }
        }

        await _next(context);
    }
}
