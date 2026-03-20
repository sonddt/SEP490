using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Pomelo.EntityFrameworkCore.MySql.Scaffolding.Internal;

namespace ShuttleUp.DAL.Models;

public partial class ShuttleUpDbContext : DbContext
{
    public ShuttleUpDbContext()
    {
    }

    public ShuttleUpDbContext(DbContextOptions<ShuttleUpDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Booking> Bookings { get; set; }

    public virtual DbSet<BookingItem> BookingItems { get; set; }

    public virtual DbSet<ChatMessage> ChatMessages { get; set; }

    public virtual DbSet<ChatRoom> ChatRooms { get; set; }

    public virtual DbSet<ChatRoomMember> ChatRoomMembers { get; set; }

    public virtual DbSet<Court> Courts { get; set; }

    public virtual DbSet<CourtBlock> CourtBlocks { get; set; }

    public virtual DbSet<CourtPrice> CourtPrices { get; set; }

    public virtual DbSet<FavoriteVenue> FavoriteVenues { get; set; }

    public virtual DbSet<File> Files { get; set; }

    public virtual DbSet<MatchingJoinRequest> MatchingJoinRequests { get; set; }

    public virtual DbSet<MatchingMember> MatchingMembers { get; set; }

    public virtual DbSet<MatchingPost> MatchingPosts { get; set; }

    public virtual DbSet<Payment> Payments { get; set; }

    public virtual DbSet<RefundRequest> RefundRequests { get; set; }

    public virtual DbSet<RefundTransaction> RefundTransactions { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<Venue> Venues { get; set; }

    public virtual DbSet<VenueApprovalRequest> VenueApprovalRequests { get; set; }

    public virtual DbSet<VenueOpenHour> VenueOpenHours { get; set; }

    public virtual DbSet<CourtOpenHour> CourtOpenHours { get; set; }

    public virtual DbSet<VenueReview> VenueReviews { get; set; }

    public virtual DbSet<ViolationReport> ViolationReports { get; set; }

    public virtual DbSet<ManagerProfile> ManagerProfiles { get; set; }

    // OnConfiguring removed because connection is provided via Dependency Injection in Program.cs

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("bookings");

            entity.HasIndex(e => e.UserId, "user_id");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.DiscountAmount)
                .HasPrecision(15, 2)
                .HasDefaultValueSql("'0.00'")
                .HasColumnName("discount_amount");
            entity.Property(e => e.FinalAmount)
                .HasPrecision(15, 2)
                .HasColumnName("final_amount");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");
            entity.Property(e => e.TotalAmount)
                .HasPrecision(15, 2)
                .HasColumnName("total_amount");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");

            entity.HasOne(d => d.User).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("bookings_ibfk_1");

            entity.HasOne(d => d.Venue).WithMany(p => p.Bookings)
                .HasForeignKey(d => d.VenueId)
                .HasConstraintName("bookings_ibfk_2");
        });

        modelBuilder.Entity<BookingItem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("booking_items");

            entity.HasIndex(e => e.BookingId, "booking_id");

            entity.HasIndex(e => e.CourtId, "court_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BookingId).HasColumnName("booking_id");
            entity.Property(e => e.CourtId).HasColumnName("court_id");
            entity.Property(e => e.EndTime)
                .HasColumnType("datetime")
                .HasColumnName("end_time");
            entity.Property(e => e.FinalPrice)
                .HasPrecision(15, 2)
                .HasColumnName("final_price");
            entity.Property(e => e.StartTime)
                .HasColumnType("datetime")
                .HasColumnName("start_time");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasColumnName("status");

            entity.HasOne(d => d.Booking).WithMany(p => p.BookingItems)
                .HasForeignKey(d => d.BookingId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("booking_items_ibfk_1");

            entity.HasOne(d => d.Court).WithMany(p => p.BookingItems)
                .HasForeignKey(d => d.CourtId)
                .HasConstraintName("booking_items_ibfk_2");
        });

        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("chat_messages");

            entity.HasIndex(e => e.ChatRoomId, "chat_room_id");

            entity.HasIndex(e => e.SenderUserId, "sender_user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ChatRoomId).HasColumnName("chat_room_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.MessageText)
                .HasColumnType("text")
                .HasColumnName("message_text");
            entity.Property(e => e.SenderUserId).HasColumnName("sender_user_id");

            entity.HasOne(d => d.ChatRoom).WithMany(p => p.ChatMessages)
                .HasForeignKey(d => d.ChatRoomId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("chat_messages_ibfk_1");

            entity.HasOne(d => d.SenderUser).WithMany(p => p.ChatMessages)
                .HasForeignKey(d => d.SenderUserId)
                .HasConstraintName("chat_messages_ibfk_2");

            entity.HasMany(d => d.Files).WithMany(p => p.ChatMessages)
                .UsingEntity<Dictionary<string, object>>(
                    "ChatMessageFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("chat_message_files_ibfk_2"),
                    l => l.HasOne<ChatMessage>().WithMany()
                        .HasForeignKey("ChatMessageId")
                        .HasConstraintName("chat_message_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("ChatMessageId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("chat_message_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("ChatMessageId").HasColumnName("chat_message_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<ChatRoom>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("chat_rooms");

            entity.HasIndex(e => e.PostId, "post_id").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasMaxLength(255).HasColumnName("name");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");

            entity.HasOne(d => d.CreatedByUser).WithMany()
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("chat_rooms_ibfk_creator");

            entity.HasOne(d => d.Post).WithOne(p => p.ChatRoom)
                .HasForeignKey<ChatRoom>(d => d.PostId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("chat_rooms_ibfk_1");
        });

        modelBuilder.Entity<ChatRoomMember>(entity =>
        {
            entity.HasKey(e => new { e.RoomId, e.UserId }).HasName("PRIMARY");

            entity.ToTable("chat_room_members");

            entity.Property(e => e.RoomId).HasColumnName("room_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.JoinedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("joined_at");

            entity.HasOne(d => d.Room).WithMany(p => p.Members)
                .HasForeignKey(d => d.RoomId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("chat_room_members_ibfk_1");

            entity.HasOne(d => d.User).WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("chat_room_members_ibfk_2");
        });

        modelBuilder.Entity<Court>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("courts");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.MaxGuest).HasColumnName("max_guest");
            entity.Property(e => e.IsActive)
                .HasDefaultValueSql("'1'")
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.Surface)
                .HasMaxLength(50)
                .HasColumnName("surface");
            entity.Property(e => e.SportType)
                .HasMaxLength(50)
                .HasColumnName("sport_type");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");

            entity.HasOne(d => d.Venue).WithMany(p => p.Courts)
                .HasForeignKey(d => d.VenueId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("courts_ibfk_1");

            entity.HasMany(d => d.CourtOpenHours)
                .WithOne(p => p.Court)
                .HasForeignKey(d => d.CourtId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("court_open_hours_ibfk_1");

            entity.HasMany(d => d.Files).WithMany(p => p.Courts)
                .UsingEntity<Dictionary<string, object>>(
                    "CourtFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("court_files_ibfk_2"),
                    l => l.HasOne<Court>().WithMany()
                        .HasForeignKey("CourtId")
                        .HasConstraintName("court_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("CourtId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("court_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("CourtId").HasColumnName("court_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<CourtBlock>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("court_blocks");

            entity.HasIndex(e => e.CourtId, "court_id");

            entity.HasIndex(e => e.CreatedBy, "created_by");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CourtId).HasColumnName("court_id");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.EndTime)
                .HasColumnType("datetime")
                .HasColumnName("end_time");
            entity.Property(e => e.StartTime)
                .HasColumnType("datetime")
                .HasColumnName("start_time");

            entity.HasOne(d => d.Court).WithMany(p => p.CourtBlocks)
                .HasForeignKey(d => d.CourtId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("court_blocks_ibfk_1");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.CourtBlocks)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("court_blocks_ibfk_2");
        });

        modelBuilder.Entity<CourtPrice>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("court_prices");

            entity.HasIndex(e => e.CourtId, "court_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CourtId).HasColumnName("court_id");
            entity.Property(e => e.EndTime)
                .HasColumnType("time")
                .HasColumnName("end_time");
            entity.Property(e => e.IsWeekend)
                .HasDefaultValueSql("'0'")
                .HasColumnName("is_weekend");
            entity.Property(e => e.Price)
                .HasPrecision(15, 2)
                .HasColumnName("price");
            entity.Property(e => e.StartTime)
                .HasColumnType("time")
                .HasColumnName("start_time");

            entity.HasOne(d => d.Court).WithMany(p => p.CourtPrices)
                .HasForeignKey(d => d.CourtId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("court_prices_ibfk_1");
        });

        modelBuilder.Entity<CourtOpenHour>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("court_open_hours");

            entity.HasIndex(e => e.CourtId, "court_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CourtId).HasColumnName("court_id");
            entity.Property(e => e.DayOfWeek).HasColumnName("day_of_week");

            entity.Property(e => e.OpenTime)
                .HasColumnType("time")
                .HasColumnName("open_time");

            entity.Property(e => e.CloseTime)
                .HasColumnType("time")
                .HasColumnName("close_time");

            entity.HasOne(d => d.Court).WithMany(p => p.CourtOpenHours)
                .HasForeignKey(d => d.CourtId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("court_open_hours_ibfk_1");

            entity.HasIndex(e => new { e.CourtId, e.DayOfWeek }, "uq_court_open_hours");
        });

        modelBuilder.Entity<FavoriteVenue>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.VenueId })
                .HasName("PRIMARY")
                .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });

            entity.ToTable("favorite_venues");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");

            entity.HasOne(d => d.User).WithMany(p => p.FavoriteVenues)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("favorite_venues_ibfk_1");

            entity.HasOne(d => d.Venue).WithMany(p => p.FavoriteVenues)
                .HasForeignKey(d => d.VenueId)
                .HasConstraintName("favorite_venues_ibfk_2");
        });

        modelBuilder.Entity<File>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("files");

            entity.HasIndex(e => e.UploadedByUserId, "uploaded_by_user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.FileSize).HasColumnName("file_size");
            entity.Property(e => e.FileUrl)
                .HasMaxLength(255)
                .HasColumnName("file_url");
            entity.Property(e => e.MimeType)
                .HasMaxLength(50)
                .HasColumnName("mime_type");
            entity.Property(e => e.UploadedByUserId).HasColumnName("uploaded_by_user_id");

            entity.HasOne(d => d.UploadedByUser).WithMany(p => p.Files)
                .HasForeignKey(d => d.UploadedByUserId)
                .HasConstraintName("files_ibfk_1");
        });

        modelBuilder.Entity<MatchingJoinRequest>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("matching_join_requests");

            entity.HasIndex(e => e.PostId, "post_id");

            entity.HasIndex(e => e.UserId, "user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Post).WithMany(p => p.MatchingJoinRequests)
                .HasForeignKey(d => d.PostId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("matching_join_requests_ibfk_1");

            entity.HasOne(d => d.User).WithMany(p => p.MatchingJoinRequests)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("matching_join_requests_ibfk_2");
        });

        modelBuilder.Entity<MatchingMember>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("matching_members");

            entity.HasIndex(e => e.PostId, "post_id");

            entity.HasIndex(e => e.UserId, "user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Post).WithMany(p => p.MatchingMembers)
                .HasForeignKey(d => d.PostId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("matching_members_ibfk_1");

            entity.HasOne(d => d.User).WithMany(p => p.MatchingMembers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("matching_members_ibfk_2");
        });

        modelBuilder.Entity<MatchingPost>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("matching_posts");

            entity.HasIndex(e => e.BookingId, "booking_id");

            entity.HasIndex(e => e.CreatorUserId, "creator_user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BookingId).HasColumnName("booking_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatorUserId).HasColumnName("creator_user_id");
            entity.Property(e => e.GenderPref)
                .HasMaxLength(50)
                .HasColumnName("gender_pref");
            entity.Property(e => e.Notes)
                .HasColumnType("text")
                .HasColumnName("notes");
            entity.Property(e => e.RequiredPlayers).HasColumnName("required_players");
            entity.Property(e => e.SkillLevel)
                .HasMaxLength(50)
                .HasColumnName("skill_level");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'OPEN'")
                .HasColumnName("status");

            entity.HasOne(d => d.Booking).WithMany(p => p.MatchingPosts)
                .HasForeignKey(d => d.BookingId)
                .HasConstraintName("matching_posts_ibfk_2");

            entity.HasOne(d => d.CreatorUser).WithMany(p => p.MatchingPosts)
                .HasForeignKey(d => d.CreatorUserId)
                .HasConstraintName("matching_posts_ibfk_1");
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payments");

            entity.HasIndex(e => e.BookingId, "booking_id");

            entity.HasIndex(e => e.ConfirmedBy, "confirmed_by");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(15, 2)
                .HasColumnName("amount");
            entity.Property(e => e.BookingId).HasColumnName("booking_id");
            entity.Property(e => e.ConfirmedAt)
                .HasColumnType("datetime")
                .HasColumnName("confirmed_at");
            entity.Property(e => e.ConfirmedBy).HasColumnName("confirmed_by");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.GatewayReference)
                .HasMaxLength(255)
                .HasColumnName("gateway_reference");
            entity.Property(e => e.Method)
                .HasMaxLength(50)
                .HasColumnName("method");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");

            entity.HasOne(d => d.Booking).WithMany(p => p.Payments)
                .HasForeignKey(d => d.BookingId)
                .HasConstraintName("payments_ibfk_1");

            entity.HasOne(d => d.ConfirmedByNavigation).WithMany(p => p.Payments)
                .HasForeignKey(d => d.ConfirmedBy)
                .HasConstraintName("payments_ibfk_2");
        });

        modelBuilder.Entity<RefundRequest>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("refund_requests");

            entity.HasIndex(e => e.BookingId, "booking_id");

            entity.HasIndex(e => e.ProcessedBy, "processed_by");

            entity.HasIndex(e => e.UserId, "user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BookingId).HasColumnName("booking_id");
            entity.Property(e => e.ProcessedAt)
                .HasColumnType("datetime")
                .HasColumnName("processed_at");
            entity.Property(e => e.ProcessedBy).HasColumnName("processed_by");
            entity.Property(e => e.RequestedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("requested_at");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Booking).WithMany(p => p.RefundRequests)
                .HasForeignKey(d => d.BookingId)
                .HasConstraintName("refund_requests_ibfk_1");

            entity.HasOne(d => d.ProcessedByNavigation).WithMany(p => p.RefundRequestProcessedByNavigations)
                .HasForeignKey(d => d.ProcessedBy)
                .HasConstraintName("refund_requests_ibfk_3");

            entity.HasOne(d => d.User).WithMany(p => p.RefundRequestUsers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("refund_requests_ibfk_2");

            entity.HasMany(d => d.Files).WithMany(p => p.RefundRequests)
                .UsingEntity<Dictionary<string, object>>(
                    "RefundRequestFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("refund_request_files_ibfk_2"),
                    l => l.HasOne<RefundRequest>().WithMany()
                        .HasForeignKey("RefundRequestId")
                        .HasConstraintName("refund_request_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("RefundRequestId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("refund_request_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("RefundRequestId").HasColumnName("refund_request_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<RefundTransaction>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("refund_transactions");

            entity.HasIndex(e => e.PaymentId, "payment_id");

            entity.HasIndex(e => e.ProcessedBy, "processed_by");

            entity.HasIndex(e => e.RefundRequestId, "refund_request_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(15, 2)
                .HasColumnName("amount");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.GatewayReference)
                .HasMaxLength(255)
                .HasColumnName("gateway_reference");
            entity.Property(e => e.Method)
                .HasMaxLength(50)
                .HasColumnName("method");
            entity.Property(e => e.PaymentId).HasColumnName("payment_id");
            entity.Property(e => e.ProcessedAt)
                .HasColumnType("datetime")
                .HasColumnName("processed_at");
            entity.Property(e => e.ProcessedBy).HasColumnName("processed_by");
            entity.Property(e => e.RefundRequestId).HasColumnName("refund_request_id");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasColumnName("status");

            entity.HasOne(d => d.Payment).WithMany(p => p.RefundTransactions)
                .HasForeignKey(d => d.PaymentId)
                .HasConstraintName("refund_transactions_ibfk_2");

            entity.HasOne(d => d.ProcessedByNavigation).WithMany(p => p.RefundTransactions)
                .HasForeignKey(d => d.ProcessedBy)
                .HasConstraintName("refund_transactions_ibfk_3");

            entity.HasOne(d => d.RefundRequest).WithMany(p => p.RefundTransactions)
                .HasForeignKey(d => d.RefundRequestId)
                .HasConstraintName("refund_transactions_ibfk_1");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("roles");

            entity.HasIndex(e => e.Name, "name").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name)
                .HasMaxLength(50)
                .HasColumnName("name");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("users");

            entity.HasIndex(e => e.Email, "email").IsUnique();

            entity.HasIndex(e => e.AvatarFileId, "fk_user_avatar");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AvatarFileId).HasColumnName("avatar_file_id");
            entity.Property(e => e.BlockedAt)
                .HasColumnType("datetime")
                .HasColumnName("blocked_at");
            entity.Property(e => e.BlockedBy).HasColumnName("blocked_by");
            entity.Property(e => e.BlockedReason)
                .HasColumnType("text")
                .HasColumnName("blocked_reason");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.FullName)
                .HasMaxLength(255)
                .HasColumnName("full_name");
            entity.Property(e => e.About)
                .HasColumnType("text")
                .HasColumnName("about");
            entity.Property(e => e.Address)
                .HasMaxLength(500)
                .HasColumnName("address");
            entity.Property(e => e.District)
                .HasMaxLength(100)
                .HasColumnName("district");
            entity.Property(e => e.Province)
                .HasMaxLength(100)
                .HasColumnName("province");
            entity.Property(e => e.Gender)
                .HasMaxLength(20)
                .HasColumnName("gender");
            entity.Property(e => e.IsActive)
                .HasDefaultValueSql("'1'")
                .HasColumnName("is_active");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20)
                .HasColumnName("phone_number");
            entity.Property(e => e.UpdatedAt)
                .ValueGeneratedOnAddOrUpdate()
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.AvatarFile).WithMany(p => p.Users)
                .HasForeignKey(d => d.AvatarFileId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_user_avatar");

            entity.HasMany(d => d.Roles).WithMany(p => p.Users)
                .UsingEntity<Dictionary<string, object>>(
                    "UserRole",
                    r => r.HasOne<Role>().WithMany()
                        .HasForeignKey("RoleId")
                        .HasConstraintName("user_roles_ibfk_2"),
                    l => l.HasOne<User>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("user_roles_ibfk_1"),
                    j =>
                    {
                        j.HasKey("UserId", "RoleId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("user_roles");
                        j.HasIndex(new[] { "RoleId" }, "role_id");
                        j.IndexerProperty<Guid>("UserId").HasColumnName("user_id");
                        j.IndexerProperty<Guid>("RoleId").HasColumnName("role_id");
                    });
        });

        modelBuilder.Entity<Venue>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("venues");

            entity.HasIndex(e => e.OwnerUserId, "owner_user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Address)
                .HasColumnType("text")
                .HasColumnName("address");
            entity.Property(e => e.ApprovalStatus)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("approval_status");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValueSql("'0'")
                .HasColumnName("is_active");
            entity.Property(e => e.Lat)
                .HasPrecision(10, 8)
                .HasColumnName("lat");
            entity.Property(e => e.Lng)
                .HasPrecision(11, 8)
                .HasColumnName("lng");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.OwnerUserId).HasColumnName("owner_user_id");

            entity.HasOne(d => d.OwnerUser).WithMany(p => p.Venues)
                .HasForeignKey(d => d.OwnerUserId)
                .HasConstraintName("venues_ibfk_1");

            entity.HasMany(d => d.Files).WithMany(p => p.Venues)
                .UsingEntity<Dictionary<string, object>>(
                    "VenueFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("venue_files_ibfk_2"),
                    l => l.HasOne<Venue>().WithMany()
                        .HasForeignKey("VenueId")
                        .HasConstraintName("venue_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("VenueId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("venue_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("VenueId").HasColumnName("venue_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<VenueApprovalRequest>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("venue_approval_requests");

            entity.HasIndex(e => e.AdminUserId, "admin_user_id");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(e => e.DecisionAt)
                .HasColumnType("datetime")
                .HasColumnName("decision_at");
            entity.Property(e => e.DecisionNote)
                .HasColumnType("text")
                .HasColumnName("decision_note");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasColumnName("status");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");

            entity.HasOne(d => d.AdminUser).WithMany(p => p.VenueApprovalRequests)
                .HasForeignKey(d => d.AdminUserId)
                .HasConstraintName("venue_approval_requests_ibfk_2");

            entity.HasOne(d => d.Venue).WithMany(p => p.VenueApprovalRequests)
                .HasForeignKey(d => d.VenueId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("venue_approval_requests_ibfk_1");
        });

        modelBuilder.Entity<VenueOpenHour>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("venue_open_hours");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CloseTime)
                .HasColumnType("time")
                .HasColumnName("close_time");
            entity.Property(e => e.DayOfWeek).HasColumnName("day_of_week");
            entity.Property(e => e.OpenTime)
                .HasColumnType("time")
                .HasColumnName("open_time");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");

            entity.HasOne(d => d.Venue).WithMany(p => p.VenueOpenHours)
                .HasForeignKey(d => d.VenueId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("venue_open_hours_ibfk_1");
        });

        modelBuilder.Entity<VenueReview>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("venue_reviews");

            entity.HasIndex(e => e.BookingId, "booking_id");

            entity.HasIndex(e => e.UserId, "user_id");

            entity.HasIndex(e => e.VenueId, "venue_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BookingId).HasColumnName("booking_id");
            entity.Property(e => e.Comment)
                .HasColumnType("text")
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("created_at");
            entity.Property(e => e.Stars).HasColumnName("stars");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.VenueId).HasColumnName("venue_id");

            entity.HasOne(d => d.Booking).WithMany(p => p.VenueReviews)
                .HasForeignKey(d => d.BookingId)
                .HasConstraintName("venue_reviews_ibfk_3");

            entity.HasOne(d => d.User).WithMany(p => p.VenueReviews)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("venue_reviews_ibfk_2");

            entity.HasOne(d => d.Venue).WithMany(p => p.VenueReviews)
                .HasForeignKey(d => d.VenueId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("venue_reviews_ibfk_1");

            entity.HasMany(d => d.Files).WithMany(p => p.Reviews)
                .UsingEntity<Dictionary<string, object>>(
                    "VenueReviewFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("venue_review_files_ibfk_2"),
                    l => l.HasOne<VenueReview>().WithMany()
                        .HasForeignKey("ReviewId")
                        .HasConstraintName("venue_review_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("ReviewId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("venue_review_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("ReviewId").HasColumnName("review_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<ViolationReport>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("violation_reports");

            entity.HasIndex(e => e.AdminUserId, "admin_user_id");

            entity.HasIndex(e => e.ReporterUserId, "reporter_user_id");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(e => e.DecisionAt)
                .HasColumnType("datetime")
                .HasColumnName("decision_at");
            entity.Property(e => e.Description)
                .HasColumnType("text")
                .HasColumnName("description");
            entity.Property(e => e.Reason)
                .HasMaxLength(255)
                .HasColumnName("reason");
            entity.Property(e => e.ReporterUserId).HasColumnName("reporter_user_id");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.TargetType)
                .HasMaxLength(50)
                .HasColumnName("target_type");

            entity.HasOne(d => d.AdminUser).WithMany(p => p.ViolationReportAdminUsers)
                .HasForeignKey(d => d.AdminUserId)
                .HasConstraintName("violation_reports_ibfk_2");

            entity.HasOne(d => d.ReporterUser).WithMany(p => p.ViolationReportReporterUsers)
                .HasForeignKey(d => d.ReporterUserId)
                .HasConstraintName("violation_reports_ibfk_1");

            entity.HasMany(d => d.Files).WithMany(p => p.Reports)
                .UsingEntity<Dictionary<string, object>>(
                    "ReportFile",
                    r => r.HasOne<File>().WithMany()
                        .HasForeignKey("FileId")
                        .HasConstraintName("report_files_ibfk_2"),
                    l => l.HasOne<ViolationReport>().WithMany()
                        .HasForeignKey("ReportId")
                        .HasConstraintName("report_files_ibfk_1"),
                    j =>
                    {
                        j.HasKey("ReportId", "FileId")
                            .HasName("PRIMARY")
                            .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });
                        j.ToTable("report_files");
                        j.HasIndex(new[] { "FileId" }, "file_id");
                        j.IndexerProperty<Guid>("ReportId").HasColumnName("report_id");
                        j.IndexerProperty<Guid>("FileId").HasColumnName("file_id");
                    });
        });

        modelBuilder.Entity<ManagerProfile>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PRIMARY");

            entity.ToTable("manager_profiles");

            entity.HasIndex(e => e.AdminUserId, "admin_user_id");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(e => e.IdCardNo)
                .HasMaxLength(50)
                .HasColumnName("id_card_no");
            entity.Property(e => e.TaxCode)
                .HasMaxLength(50)
                .HasColumnName("tax_code");
            entity.Property(e => e.BusinessLicenseNo)
                .HasMaxLength(100)
                .HasColumnName("business_license_no");
            entity.Property(e => e.Address)
                .HasColumnType("text")
                .HasColumnName("address");
            entity.Property(e => e.DecisionAt)
                .HasColumnType("datetime")
                .HasColumnName("decision_at");
            entity.Property(e => e.DecisionNote)
                .HasColumnType("text")
                .HasColumnName("decision_note");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("'PENDING'")
                .HasColumnName("status");

            entity.HasOne(d => d.AdminUser).WithMany(p => p.ApprovedManagerProfiles)
                .HasForeignKey(d => d.AdminUserId)
                .HasConstraintName("manager_profiles_ibfk_2");

            entity.HasOne(d => d.User).WithOne(p => p.ManagerProfileManager)
                .HasForeignKey<ManagerProfile>(d => d.UserId)
                .HasConstraintName("manager_profiles_ibfk_1");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
