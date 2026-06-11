# ShuttleUp

**Online badminton court booking platform** — connecting players, venue owners, and administrators in one unified system. Built as part of **SEP490** (Capstone Project).

Players can discover courts by area, book slots, pay online, find match partners, and receive play-time reminders. Venue managers handle courts, bookings, revenue, and refunds. Admins oversee the entire platform.

---

## Key Features

### Player
- Sign up / sign in (email, Google OAuth), personalized profile (skill level, play goals)
- Find courts on a map, by area or distance; view venue details and hourly pricing
- Single and long-term bookings; bank transfer payment (VietQR), payment proof upload
- Manage bookings, cancel per venue policy, track refunds
- **Matching:** post open games, approve join requests, comment and discuss
- Add friends, find friends via QR, real-time chat (SignalR)
- In-app notifications + email (booking confirmation, play-time reminders, matching, friends, etc.)

### Manager (Venue Owner)
- Register and get approved by Admin
- Manage venues (draft → publish), courts, pricing, coupons, availability
- Approve / reject bookings, process refunds, revenue analytics
- Configure bank payment (VietQR Lookup), cancellation & refund policies
- Featured posts, new-booking notifications

### Admin
- Overview dashboard, account & role management
- Approve venue owner profiles, handle reports / complaints
- Booking & revenue statistics; system-wide featured content

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite 7, React Router, Bootstrap 5, Tailwind CSS 4, Axios, SignalR, Leaflet, Recharts |
| **Backend** | ASP.NET Core 8, Entity Framework Core, JWT Bearer |
| **Database** | MySQL (Pomelo EF provider) |
| **External Services** | Cloudinary (image upload), Gmail SMTP (email), VietQR (bank account lookup), Google OAuth |

---

## Project Structure

```
SEP490/
├── Database/
│   └── Database.txt          # Schema + seed data (single source of truth)
├── ShuttleUp.Backend/
│   ├── ShuttleUp.Backend.Presentation/   # API, controllers, background jobs
│   ├── ShuttleUp.Backend.BLL/            # Business logic, services
│   └── ShuttleUp.Backend.DAL/            # EF models, repositories
├── ShuttleUp.Frontend/       # React SPA (Vite)
├── docs/                     # Development history, internal notes
├── README/
│   └── LOCAL_SETUP.md        # Detailed local setup guide
└── ShuttleUp.sln
```

**Backend architecture:** Presentation → BLL → DAL (3-layer).

**Background services:** auto-complete bookings after play time; send play-time reminders (default window **2 hours**, configured via `ReminderSettings:UpcomingHours`).

---

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) 18+
- MySQL or MariaDB

---

## Quick Start (Local)

Full details: [`README/LOCAL_SETUP.md`](README/LOCAL_SETUP.md)

### 1. Database

Run the entire `Database/Database.txt` script in MySQL (Workbench or CLI).

Update the connection string in `ShuttleUp.Backend/ShuttleUp.Backend.Presentation/appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "server=localhost;user=root;password=YOUR_PASSWORD;database=shuttle_up"
}
```

### 2. Backend

```bash
cd ShuttleUp.Backend/ShuttleUp.Backend.Presentation

# Cloudinary & VietQR — use User Secrets (do not commit keys)
dotnet user-secrets set "Cloudinary:ApiKey" "YOUR_API_KEY"
dotnet user-secrets set "Cloudinary:ApiSecret" "YOUR_API_SECRET"
dotnet user-secrets set "VietQR:ClientId" "YOUR_CLIENT_ID"
dotnet user-secrets set "VietQR:ApiKey" "YOUR_API_KEY"

dotnet run
```

- API: `http://localhost:5079`
- Swagger: `http://localhost:5079/swagger`

### 3. Frontend

```bash
cd ShuttleUp.Frontend
copy .env.example .env    # Windows — macOS/Linux: cp .env.example .env
npm install
npm run dev
```

- Web: `http://localhost:5173`
- Environment variables: `VITE_API_URL`, `VITE_CHAT_HUB_URL` (see `.env.example`)

### Sample Accounts (after running Database.txt)

Default seed password: **`Password123@`**

Examples: `player1@shuttleup.vn`, `admin1@shuttleup.vn`, and corresponding manager accounts in the seed file.

---

## Configuration

| Item | File / Location |
|------|-----------------|
| JWT, Email, Frontend URL | `appsettings.json` |
| Cloudinary, VietQR secrets | `dotnet user-secrets` (dev) or environment variables (deploy) |
| Play-time reminder window | `ReminderSettings:UpcomingHours` (default `2`) |
| API URL (FE) | `ShuttleUp.Frontend/.env` |

> **Security:** Do not commit API keys, secrets, SMTP passwords, or production JWT keys to Git.

---

## Development Conventions

- **Database:** edit `Database/Database.txt` only — no separate `.sql` migration files; reset DB by re-running the full script.
- **UI:** Vietnamese language, **Be Vietnam Pro** font.
- **Validation:** inline messages near inputs, friendly tone.

See also: `docs/memory.md`, `.cursor/rules/project-context.mdc`.

---

## License

Academic project — SEP490. Contact the development team before reuse or redistribution.
