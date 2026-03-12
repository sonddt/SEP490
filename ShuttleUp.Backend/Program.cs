namespace ShuttleUp.Backend
{
    using System.Text;
    using Microsoft.AspNetCore.Authentication.JwtBearer;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.IdentityModel.Tokens;
    using Microsoft.OpenApi.Models;
    using ShuttleUp.BLL.Interfaces;
    using ShuttleUp.BLL.Services;
    using ShuttleUp.DAL.Models;
    using ShuttleUp.DAL.Repositories;
    using ShuttleUp.DAL.Repositories.Interfaces;

    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // ── Database ──────────────────────────────────────────────────────────
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            builder.Services.AddDbContext<ShuttleUpDbContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

            // ── DAL — Repositories ────────────────────────────────────────────────
            builder.Services.AddScoped<IUserRepository, UserRepository>();
            builder.Services.AddScoped<IRoleRepository, RoleRepository>();
            builder.Services.AddScoped<IVenueRepository, VenueRepository>();
            builder.Services.AddScoped<IBookingRepository, BookingRepository>();
            builder.Services.AddScoped<ICourtRepository, CourtRepository>();
            builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
            builder.Services.AddScoped<IMatchingRepository, MatchingRepository>();

            // ── BLL — Services ────────────────────────────────────────────────────
            builder.Services.AddScoped<IEmailService, EmailService>();
            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddScoped<IUserService, UserService>();
            builder.Services.AddScoped<IVenueService, VenueService>();
            builder.Services.AddScoped<IBookingService, BookingService>();
            builder.Services.AddScoped<ICourtService, CourtService>();
            builder.Services.AddScoped<IPaymentService, PaymentService>();
            builder.Services.AddScoped<IMatchingService, MatchingService>();

            // ── JWT Authentication ────────────────────────────────────────────────
            var jwtKey = builder.Configuration["Jwt:Key"]!;
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = builder.Configuration["Jwt:Issuer"],
                        ValidAudience = builder.Configuration["Jwt:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    };
                });

            // ── CORS — React/Vite frontend ────────────────────────────────────────
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                    policy.WithOrigins("http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod());
            });

            // ── Controllers + Swagger ─────────────────────────────────────────────
            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "ShuttleUp API", Version = "v1" });

                // Cho phép nhập JWT token trực tiếp trong Swagger UI
                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Nhập JWT token. Ví dụ: eyJhbGci..."
                });
                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            var app = builder.Build();

            // ── Test Database Connection + Seed Roles ─────────────────────────────
            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();
                try
                {
                    if (dbContext.Database.CanConnect())
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("====================================================");
                        Console.WriteLine(" [SUCCESS] Connected to MySQL Database successfully!");
                        Console.WriteLine("====================================================");
                        Console.ResetColor();

                        // Seed default roles if not present
                        var requiredRoles = new[] { "PLAYER", "MANAGER", "ADMIN" };
                        foreach (var roleName in requiredRoles)
                        {
                            if (!dbContext.Roles.Any(r => r.Name == roleName))
                            {
                                dbContext.Roles.Add(new ShuttleUp.DAL.Models.Role
                                {
                                    Id = Guid.NewGuid(),
                                    Name = roleName,
                                });
                                Console.WriteLine($" [SEED] Role '{roleName}' added.");
                            }
                        }
                        dbContext.SaveChanges();
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("====================================================");
                        Console.WriteLine(" [ERROR] Could not connect to the MySQL Database.");
                        Console.WriteLine("====================================================");
                        Console.ResetColor();
                    }
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("====================================================");
                    Console.WriteLine($" [ERROR] Database connection failed. Details: {ex.Message}");
                    Console.WriteLine("====================================================");
                    Console.ResetColor();
                }
            }

            // ── HTTP Pipeline ─────────────────────────────────────────────────────
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseCors("AllowFrontend");

            // Chỉ redirect HTTPS trong production — tránh CORS preflight bị block khi dev
            if (!app.Environment.IsDevelopment())
            {
                app.UseHttpsRedirection();
            }

            app.UseAuthentication();  
            app.UseAuthorization();

            app.MapControllers();

            app.Run();
        }
    }
}
