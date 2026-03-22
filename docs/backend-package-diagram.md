# ShuttleUp – Backend package diagram

Sơ đồ phụ thuộc giữa các **project** (.csproj) và **namespace** chính trong solution.

## Project references

| Project | References |
|---------|------------|
| `ShuttleUp.DAL` | — |
| `ShuttleUp.BLL` | `ShuttleUp.DAL` |
| `ShuttleUp.Backend` | `ShuttleUp.BLL`, `ShuttleUp.DAL` |

> Một số controller inject trực tiếp `ShuttleUpDbContext` / entity từ DAL nên Backend tham chiếu cả BLL và DAL.

## Mermaid (xem preview trên GitHub / VS Code)

```mermaid
flowchart TB
  subgraph DAL["ShuttleUp.DAL"]
    DAL_Models["Models\n(Entities, ShuttleUpDbContext)"]
    DAL_Repo["Repositories\n+ Repositories.Interfaces"]
  end

  subgraph BLL["ShuttleUp.BLL"]
    BLL_DTO["DTOs\n(Auth, Manager, Chat, Review, …)"]
    BLL_Int["Interfaces\n(IAuthService, ICourtService, …)"]
    BLL_Svc["Services\n(AuthService, CourtService, …)"]
  end

  subgraph BE["ShuttleUp.Backend"]
    BE_Ctrl["Controllers"]
    BE_Hub["Hubs\n(ChatHub)"]
    BE_Models["Models\n(duplicate EF – legacy / song song DAL)"]
    BE_Prog["Program.cs\n(DI, JWT, Swagger, SignalR)"]
  end

  BLL -->|ProjectReference| DAL
  BE -->|ProjectReference| BLL
  BE -->|ProjectReference| DAL

  BLL_Svc --> DAL_Repo
  BLL_Svc --> DAL_Models
  BE_Ctrl --> BLL_Int
  BE_Ctrl --> BLL_DTO
  BE_Ctrl --> DAL_Models
```

## PlantUML

File tương ứng: [`backend-package-diagram.puml`](./backend-package-diagram.puml) (mở bằng extension PlantUML hoặc render online).
