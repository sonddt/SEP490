# Test Bug List (tổng hợp lỗi đã gặp)

> Ghi chú:
> - Danh sách này tổng hợp theo những lỗi đã xuất hiện trong các lần làm việc gần đây (nhớ trong phạm vi trao đổi).
> - **Thời gian** bên dưới ghi theo dạng **ước lượng** (không phải log hệ thống), dựa trên mốc các lần trao đổi và thời điểm dev gần đây.
> - Mỗi mục gồm “**Thời gian**”, “**Sai chỗ nào**” và “**Sửa ra sao**”.

## Frontend (React)

- **Trắng trang ở `ManagerProfile` (ReferenceError `handleSubmit` is not defined)**
  - **Thời gian (ước lượng)**: 2026-03-26
  - **Sai chỗ nào**: `ManagerProfile.jsx` đổi tên handler submit nhưng JSX vẫn gọi `handleSubmit`.
  - **Sửa ra sao**: đồng bộ lại `onSubmit`/button handler sang `handleSubmitPersonal` và tách riêng luồng submit personal vs business.

- **Hiển thị giới tính dạng `MALE/FEMALE`**
  - **Thời gian (ước lượng)**: 2026-03-26
  - **Sai chỗ nào**: FE render trực tiếp giá trị enum từ backend.
  - **Sửa ra sao**: map sang nhãn tiếng Việt `Nam/Nữ/Khác` khi hiển thị; dropdown edit lưu `MALE/FEMALE/OTHER`.

- **Trắng trang khi gõ “Địa chỉ” ở màn `ManagerAddVenue` (TypeError đọc `[0]` của `null`)**
  - **Thời gian (ước lượng)**: 2026-03-26
  - **Sai chỗ nào**: `getFieldError` giả định `fieldErrors[key]` luôn là array, nhưng `onChange` set `{ address: null }` → `null[0]`.
  - **Sửa ra sao**: làm `getFieldError` an toàn với `null` / `string` / `array` trước khi đọc phần tử.

- **401 Unauthorized khi submit `POST /api/manager/venues`**
  - **Thời gian (ước lượng)**: 2026-03-26
  - **Sai chỗ nào**: request bị từ chối do chưa đăng nhập, token hết hạn, hoặc không có role `MANAGER` (không phải lỗi UI).
  - **Sửa ra sao**: đăng nhập lại tài khoản có role `MANAGER`, kiểm tra `localStorage.token` tồn tại và interceptor `axiosClient` đính kèm `Authorization` header đúng.

- **Lỗi patch/context mismatch khi chỉnh `VenueCard.jsx`**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: khác biệt whitespace/đoạn code thực tế khiến áp thay đổi không khớp context.
  - **Sửa ra sao**: chia nhỏ thay đổi và áp theo từng khối ngắn, bám sát context thực tế trong file.

## Backend / Runtime (ASP.NET Core)

- **Build lỗi Swagger/OpenAPI do lệch version package (Swashbuckle ↔ Microsoft.OpenApi)**
  - **Thời gian (ước lượng)**: 2026-03 (đợt setup Swagger/Auth ban đầu)
  - **Sai chỗ nào**: project tham chiếu `Swashbuckle.AspNetCore` và `Microsoft.OpenApi` không tương thích → lỗi namespace/API models khi build.
  - **Sửa ra sao**: bỏ/đồng bộ reference `Microsoft.OpenApi` theo version Swashbuckle yêu cầu (để Swashbuckle quản lý dependency), hoặc hạ Swashbuckle về version tương thích.

- **API favorites trả 404 Not Found**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: server backend đang chạy chưa được restart nên chưa load controller/route mới.
  - **Sửa ra sao**: dừng process `dotnet run` và chạy lại backend.

- **API favorites trả 401 Unauthorized**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: endpoint có `[Authorize]` nên cần token hợp lệ.
  - **Sửa ra sao**: đăng nhập lại để có token; FE xử lý theo hướng optimistic UI nhưng revert khi API lỗi.

- **SignalR chat “Backend chưa chạy / không kết nối được” dù REST API chạy**
  - **Thời gian (ước lượng)**: 2026-03 (đợt làm chat)
  - **Sai chỗ nào**:
    - FE kết nối sai scheme/port (VS chạy `https://localhost:7073` nhưng FE gọi `http://localhost:5079`), hoặc
    - CORS policy thiếu `AllowCredentials()` cho WebSocket/SignalR, hoặc
    - Backend chưa đọc JWT từ query string `access_token` (SignalR không luôn gửi header Authorization như REST).
  - **Sửa ra sao**:
    - Đồng bộ `axiosClient`/SignalR base URL đúng port đang chạy,
    - CORS thêm `.AllowCredentials()` (và dùng `.WithOrigins(...)` thay vì `AllowAnyOrigin`),
    - Cấu hình JWT bearer `OnMessageReceived` để lấy token từ `context.Request.Query["access_token"]` cho route hub.

## Build/Dev Environment

- **`dotnet build` lỗi file bị lock (MSB3026/MSB3027)**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: DLL/outputs bị khóa bởi process backend đang chạy.
  - **Sửa ra sao**: stop/kills process backend trước khi build (hoặc build với target phù hợp), sau đó build lại.

- **PowerShell command lỗi do dùng `&&`**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: PowerShell không hỗ trợ `&&` kiểu bash cho statement separator (tùy version).
  - **Sửa ra sao**: dùng `;` để nối lệnh, hoặc chạy từng lệnh riêng.

- **FE/BE lệch port (FE gọi `http://localhost:5079/api` nhưng BE chạy https 7073 trong Visual Studio)**
  - **Thời gian (ước lượng)**: 2026-03 (đợt setup chạy local)
  - **Sai chỗ nào**: chạy 2 profile/2 instance (http 5079 vs https 7073) dẫn đến “gọi API fail/không đúng backend đang chạy”.
  - **Sửa ra sao**: chọn 1 profile chạy (khuyến nghị http 5079 khi FE dùng 5173), hoặc đổi `axiosClient.baseURL` sang `https://localhost:7073/api` nếu chạy bằng nút ▶ trong VS.

## Git / Workflow

- **Pull branch gây conflict**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: `git pull` tạo merge conflict ở một số file FE.
  - **Sửa ra sao**: nếu quyết định “giữ hết remote” thì checkout “theirs” cho file conflict, add và commit merge.

- **Route Venue details bị thiếu param (link đi `/venue-details` thay vì `/venue-details/:venueId`)**
  - **Thời gian (ước lượng)**: 2026-03 (đợt nối UI venue details)
  - **Sai chỗ nào**: routing/link chưa truyền `venueId` nên trang detail không có dữ liệu đúng theo sân được chọn.
  - **Sửa ra sao**: chuẩn hóa route detail có `:venueId` và update link ở card/list để truyền id; thêm fallback nếu thiếu param.

- **Đổi author/committer cho commit đã tạo**
  - **Thời gian (ước lượng)**: 2026-03-25
  - **Sai chỗ nào**: commit ban đầu dùng sai tên author/committer.
  - **Sửa ra sao**: `git reset --soft HEAD~1`, set `GIT_AUTHOR_*` và `GIT_COMMITTER_*`, commit lại; rồi `git push --force-with-lease` (chỉ khi đã hiểu tác động rewrite history).

