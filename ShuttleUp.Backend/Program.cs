namespace ShuttleUp.Backend
{
    using Microsoft.EntityFrameworkCore;
    using ShuttleUp.Backend.Models;

    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            builder.Services.AddDbContext<ShuttleUpDbContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

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
            if (app.Environment.IsDevelopment() || !app.Environment.IsDevelopment()) // Enable Swagger in both for testing if needed, or just Dev. Let's do Dev.
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
