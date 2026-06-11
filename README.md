# ShuttleUp — Badminton Court Booking & Community Platform

Full-stack web application for discovering badminton courts, booking time slots, managing venues, and connecting players through matching, chat, and social features. This repository contains the complete application: React frontend, ASP.NET Core API, MySQL schema/seed, and project documentation.

**Repository:** [github.com/sonddt/SEP490](https://github.com/sonddt/SEP490)

**Suggested GitHub description:**  
`Full-stack badminton court booking platform with React frontend, ASP.NET Core API, MySQL, real-time chat/notifications, matching, and venue management for players, managers, and admins.`

**Suggested topics:**  
`badminton`, `court-booking`, `fullstack`, `react`, `aspnet-core`, `mysql`, `signalr`, `jwt`, `cloudinary`, `vietqr`, `sep490`, `capstone`

---

## Overview

ShuttleUp is designed as a full-stack sports booking platform with **Player**, **Manager (venue owner)**, and **Admin** workflows in a single monorepo.

- **Players** search courts on a map, book slots, pay via bank transfer (VietQR), find match partners, chat, and receive play-time reminders.
- **Managers** onboard venues, configure pricing, approve bookings, process refunds, and view earnings.
- **Admins** manage accounts, approve venue-owner applications, handle reports, and publish featured content.

This is a **SEP490 capstone / demo project**, not a fully hardened production system. The documentation calls out current limitations and recommended improvements where appropriate.

---

## Key Features

| Area | Supported in this repo |
|------|------------------------|
| **Player** | Venue discovery (list + map), favorites, single & long-term booking, VietQR payment proof upload, booking history, cancellation & refund tracking, play-time email + in-app reminders |
| **Matching** | Post open games, join requests, host approval, threaded comments (replies, images, @mentions), skill-based search & filters |
| **Social** | Friend requests, QR profile sharing, public player profiles, privacy settings |
| **Chat** | Real-time messaging via SignalR (`/hubs/chat`) |
| **Manager** | Venue draft → publish workflow, courts & hourly pricing, coupons, availability blocks, booking approval, refunds, earnings dashboard, bank payment setup (VietQR Lookup) |
| **Admin** | User & role management, manager approval, violation reports, booking/revenue statistics, system featured posts |
| **Notifications** | In-app feed + SignalR push (`/hubs/notifications`), HTML email templates for bookings, reminders, matching, and social events |
| **Background jobs** | Expired slot-hold cleanup, booking auto-completion after play time, upcoming play reminders (default **2h** window), soft-ban finalization |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, React Router 7, Bootstrap 5, Tailwind CSS 4, Axios, SignalR client, Leaflet, Recharts |
| **Backend** | ASP.NET Core 8, Entity Framework Core, JWT Bearer, Swagger |
| **Database** | MySQL 8 (Pomelo EF provider) — schema + seed in `Database/Database.txt` |
| **Real-time** | SignalR hubs (chat, notifications) |
| **File storage** | Cloudinary (avatars, venue gallery, payment proofs, comment attachments) |
| **Email** | Gmail SMTP via MailKit |
| **Payments** | Manual bank transfer + VietQR QR display; VietQR Lookup API for bank account verification |
| **Auth** | Email/password (BCrypt), Google OAuth |
| **Architecture** | 3-layer backend: Presentation → BLL → DAL |

More detail: [docs/TECH_STACK.md](docs/TECH_STACK.md)

---

## Architecture

```
Browser (React SPA)
        |
        |  HTTPS / REST API  +  WebSocket (SignalR)
        v
ASP.NET Core 8 API
  ├── Controllers (REST)
  ├── SignalR Hubs (chat, notifications)
  └── Background Services (reminders, completion, cleanup)
        |
        v
Entity Framework Core  →  MySQL 8 (shuttle_up)
        |
        +--> Cloudinary (images)
        +--> Gmail SMTP (email)
        +--> VietQR Lookup API (bank verification)
```

**Security boundaries implemented in the application:**

- JWT protects authenticated API routes; role-based access for Player / Manager / Admin.
- Banned users are blocked at middleware before reaching controllers.
- Cloudinary and VietQR secrets are required at startup but stored outside Git (User Secrets / environment variables).
- Manager bank account verification uses VietQR Lookup before saving payout details.

More detail: [docs/architecture.md](docs/architecture.md)

---

## Repository Structure

```
SEP490/
├── Database/
│   └── Database.txt                         # Single source of truth: DROP/CREATE/INSERT + conditional ALTER
├── ShuttleUp.Backend/
│   ├── ShuttleUp.Backend.Presentation/      # API host, controllers, hubs, background services
│   │   ├── Controllers/                     # REST endpoints (auth, venues, bookings, matching, admin, …)
│   │   ├── Hubs/                            # ChatHub, NotificationHub
│   │   ├── BackgroundServices/              # Reminders, booking completion, hold cleanup, soft-ban
│   │   ├── Middleware/                      # Banned-user gate
│   │   ├── Templates/Emails/                # HTML email templates
│   │   └── appsettings.json                 # Non-secret defaults
│   ├── ShuttleUp.Backend.BLL/               # Business logic, DTOs, services
│   └── ShuttleUp.Backend.DAL/               # EF models, DbContext, repositories
├── ShuttleUp.Frontend/
│   ├── src/
│   │   ├── pages/                           # Player, manager, admin, booking, matching routes
│   │   ├── components/                      # Shared UI, layouts, domain widgets
│   │   ├── api/                             # Axios API clients
│   │   ├── hooks/                           # SignalR hubs, chat, unread notifications
│   │   └── constants/                       # Notification types, booking statuses, skill levels
│   ├── public/assets/                       # Static theme assets, FontAwesome (not from npm)
│   └── .env.example                         # VITE_API_URL, VITE_CHAT_HUB_URL
├── docs/
│   ├── architecture.md
│   ├── TECH_STACK.md
│   ├── api-contract.md
│   ├── product.md
│   └── memory.md                            # Development history & team conventions
├── README/
│   └── LOCAL_SETUP.md                       # Detailed setup, Cloudinary, VietQR, troubleshooting
├── ShuttleUp.sln
└── README.md
```

---

## Local Development

Full step-by-step guide (including troubleshooting): [README/LOCAL_SETUP.md](README/LOCAL_SETUP.md)

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) 18+
- MySQL or MariaDB
- Cloudinary account (ApiKey + ApiSecret)
- VietQR account (ClientId + ApiKey) — for manager payment settings

### 1. Clone and database

```bash
git clone https://github.com/sonddt/SEP490.git
cd SEP490
```

Run the entire `Database/Database.txt` script in MySQL (Workbench: Ctrl+A → Execute, or CLI).

Update `ShuttleUp.Backend/ShuttleUp.Backend.Presentation/appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "server=localhost;user=root;password=YOUR_PASSWORD;database=shuttle_up"
}
```

### 2. Backend

```bash
cd ShuttleUp.Backend/ShuttleUp.Backend.Presentation

dotnet user-secrets set "Cloudinary:ApiKey" "YOUR_API_KEY"
dotnet user-secrets set "Cloudinary:ApiSecret" "YOUR_API_SECRET"
dotnet user-secrets set "VietQR:ClientId" "YOUR_CLIENT_ID"
dotnet user-secrets set "VietQR:ApiKey" "YOUR_API_KEY"

dotnet run
```

| Endpoint | URL |
|----------|-----|
| API | `http://localhost:5079` |
| Swagger | `http://localhost:5079/swagger` |
| Chat hub | `http://localhost:5079/hubs/chat` |
| Notifications hub | `http://localhost:5079/hubs/notifications` |

The API **fails fast at startup** if Cloudinary or VietQR secrets are missing.

### 3. Frontend

```bash
cd ShuttleUp.Frontend
copy .env.example .env    # Windows — macOS/Linux: cp .env.example .env
npm install
npm run dev
```

| App | URL |
|-----|-----|
| Web UI | `http://localhost:5173` |

### 4. Sample accounts

After running `Database/Database.txt`, seed accounts use password **`Password123@`**.

Examples: `player1@shuttleup.vn`, `admin1@shuttleup.vn`, and manager accounts in the seed section.

---

## Environment Variables

No third-party secrets should be committed to Git. Configure them locally via `dotnet user-secrets` or environment variables when deploying.

### Backend — required secrets (User Secrets / env)

| Key | Purpose |
|-----|---------|
| `Cloudinary:ApiKey` | Cloudinary upload authentication |
| `Cloudinary:ApiSecret` | Cloudinary upload authentication |
| `VietQR:ClientId` | VietQR bank account lookup |
| `VietQR:ApiKey` | VietQR bank account lookup |

### Backend — `appsettings.json` (non-secret defaults)

| Key | Default | Purpose |
|-----|---------|---------|
| `ConnectionStrings:DefaultConnection` | local MySQL | Database connection |
| `Jwt:Key` / `Jwt:ExpiresInMinutes` | dev values | JWT signing |
| `App:FrontendUrl` | `http://localhost:5173` | Links in emails |
| `ReminderSettings:UpcomingHours` | `2` | Play-time reminder window (hours) |
| `ReminderSettings:PollIntervalMinutes` | `5` | Background job poll interval |
| `Email:*` | SMTP settings | Outbound email (externalize for production) |

Override any setting with environment variables using `__` notation, e.g. `ConnectionStrings__DefaultConnection`, `Cloudinary__ApiKey`.

### Frontend — `.env`

| Key | Default | Purpose |
|-----|---------|---------|
| `VITE_API_URL` | `http://localhost:5079/api` | REST API base URL |
| `VITE_CHAT_HUB_URL` | `http://localhost:5079/hubs/chat` | SignalR chat hub |

See `ShuttleUp.Frontend/.env.example`. Do not commit real `.env` files.

---

## Security Considerations

- Cloudinary and VietQR credentials are stored in User Secrets locally, not in the repository.
- JWT protects API routes; roles gate Manager and Admin endpoints.
- Banned users are rejected by middleware before controller execution.
- Database schema is versioned in `Database/Database.txt`; no credentials in SQL seed data beyond bcrypt password hashes.
- SMTP credentials exist in `appsettings.json` for dev convenience — **rotate and externalize before public deployment**.

**Recommended improvements:**

- Move JWT, SMTP, Cloudinary, and VietQR secrets to a secret manager or CI/CD-injected env vars.
- Add refresh-token rotation and shorter access-token TTL.
- Add HTTPS termination and secure cookie/session policy for production hosting.
- Add automated security scanning in CI (e.g. dependency audit, SAST).
- Restrict CORS to explicit frontend domains in production.

More detail: see **Security Notes** below and [README/LOCAL_SETUP.md](README/LOCAL_SETUP.md).

---

## Screenshots / Evidence

No screenshots are included in this repository yet.

Add evidence images to `docs/images/` and reference them here, for example:

```markdown
![Venue listing page](docs/images/venue-listing.png)
![Manager booking dashboard](docs/images/manager-bookings.png)
![Matching hub](docs/images/matching-hub.png)
```

**Suggested evidence to add:**

- Homepage and venue map search
- Booking flow (slot selection → payment proof)
- Manager dashboard (bookings, earnings)
- Matching hub and post detail
- Admin manager-approval screen
- Swagger API overview

---

## What We Learned

- Built a decoupled full-stack app with clear separation: React SPA, REST API, EF Core data layer.
- Applied a 3-layer backend (Presentation / BLL / DAL) with repository pattern and DTO mapping.
- Integrated real-time features (SignalR) for chat and in-app notifications alongside email dispatch.
- Managed a single-file database workflow (`Database/Database.txt`) suitable for academic team collaboration.
- Practiced secret handling with .NET User Secrets and documented setup for new developers.
- Designed role-based workflows for players, venue owners, and platform administrators.

---

## Future Improvements

- Add Docker Compose for one-command local/prod-like deployment.
- Add cloud deployment guide (e.g. Azure App Service + Azure Database for MySQL, or AWS EC2 + RDS).
- Replace manual bank-transfer flow with a payment gateway webhook (e.g. VNPay).
- Add refresh tokens, email verification hardening, and rate limiting on auth endpoints.
- Add automated tests (API integration tests, critical-path E2E).
- Add CI pipeline (`dotnet build`, `npm run build`, lint, optional security scan).
- Add matching play-time reminders (currently reminders apply to confirmed bookings only).
- Migrate from single SQL file to EF migrations for production-grade schema evolution.

---

## Development Conventions

- **Database:** edit `Database/Database.txt` only — no separate `.sql` migration files; reset DB by re-running the full script.
- **UI language:** Vietnamese end-user copy; font **Be Vietnam Pro**.
- **Validation:** inline messages near inputs, friendly tone (no browser `alert()`).
- **Icons:** FontAwesome from `public/assets/plugins/` — not installed via npm.

Internal history: [docs/memory.md](docs/memory.md)

---

## Related Documents

- [Local setup guide](README/LOCAL_SETUP.md)
- [Architecture overview](docs/architecture.md)
- [Tech stack reference](docs/TECH_STACK.md)
- [API contract](docs/api-contract.md)
- [Product scope](docs/product.md)
- [Development memory / changelog](docs/memory.md)

---

## Security Notes

This project demonstrates security-conscious practices for a student capstone deployment. It is **not** a complete production hardening baseline.

### Secrets and environment variables

- Cloudinary **ApiKey** and **ApiSecret** are not stored in this repository.
- VietQR **ClientId** and **ApiKey** are configured via `dotnet user-secrets` or environment variables.
- SMTP credentials are in `appsettings.json` for local dev — externalize before any public deployment.

**Recommended improvement:** use a secret manager (Azure Key Vault, AWS Secrets Manager, or similar) and keep `appsettings.json` free of credentials.

### JWT and authentication

- API issues JWT Bearer tokens (default 60-minute expiry).
- Google OAuth is supported via `Google:ClientId`.
- Banned users are blocked by `BannedUserMiddleware` with a cached ban list.

**Recommended improvement:** add refresh-token rotation, stable secret storage, and intentional key rotation policy.

### Database

- Schema and seed data live in `Database/Database.txt` (single source of truth).
- Conditional `ALTER` blocks at the end of the file support partial migration on older DBs.
- Reset dev environment by running the full script from top to bottom.

**Recommended improvement:** for production, use managed MySQL with automated backups, deletion protection, and least-privilege DB users.

### File uploads

- Images are uploaded to Cloudinary via the backend; URLs are stored in MySQL.
- Payment proofs and manager documents (CCCD, business license) go through the same pipeline.

**Recommended improvement:** add virus scanning, file-type validation at the edge, and signed upload policies.

### CORS and SignalR

- Development allows the Vite dev server origin for API and WebSocket connections.
- SignalR hubs: `/hubs/chat`, `/hubs/notifications`.

**Recommended improvement:** restrict CORS to explicit production frontend domains; enable HTTPS/WSS only in production.

---

## License

Academic project — **SEP490**. Contact the development team before reuse or redistribution.
