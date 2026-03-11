namespace ShuttleUp.Backend
{
    using Microsoft.EntityFrameworkCore;
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

            // Database
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            builder.Services.AddDbContext<ShuttleUpDbContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

            // DAL - Repositories
            builder.Services.AddScoped<IUserRepository, UserRepository>();
            builder.Services.AddScoped<IVenueRepository, VenueRepository>();
            builder.Services.AddScoped<IBookingRepository, BookingRepository>();
            builder.Services.AddScoped<ICourtRepository, CourtRepository>();
            builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
            builder.Services.AddScoped<IMatchingRepository, MatchingRepository>();

            // BLL - Services
            builder.Services.AddScoped<IUserService, UserService>();
            builder.Services.AddScoped<IVenueService, VenueService>();
            builder.Services.AddScoped<IBookingService, BookingService>();
            builder.Services.AddScoped<ICourtService, CourtService>();
            builder.Services.AddScoped<IPaymentService, PaymentService>();
            builder.Services.AddScoped<IMatchingService, MatchingService>();

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            // Allow CORS for React Vite Frontend default port 5173
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins("http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod();
                });
            });

            var app = builder.Build();

            // Test Database Connection
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

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseCors("AllowFrontend");

            app.UseAuthorization();

            app.MapControllers();

            app.Run();
        }
    }
}
