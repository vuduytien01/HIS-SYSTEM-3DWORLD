# 01: Khung dự án — custom server, Socket.io, Prisma + Postgres, auth ba vai

**What to build:** Khởi động hệ thống bằng một lệnh: Docker Compose dựng Postgres, custom Node server phục vụ frontend Vite và Socket.io. Mỗi vai trong app (Lễ tân, Bác sĩ, Admin) đăng nhập bằng mật khẩu đã hash bcrypt, nhận session cookie httpOnly, và landing vào màn hình làm việc rỗng riêng của vai mình. Kênh công cộng (trang TV) mở không cần đăng nhập. Bật được test harness chạy qua ranh giới server (REST + sự kiện Socket.io) làm mẫu cho mọi ticket sau.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] `docker compose up` dựng được Postgres; dev server chạy custom Node server + Socket.io phục vụ frontend *(compose file đã giao; máy dev không có Docker nên chưa chạy được lệnh đó — dev local dùng SQLite qua .env, xác minh bằng dev server thật + 4 test seam)*
- [x] Đăng nhập đúng: session cookie httpOnly, mật khẩu bcrypt; đăng nhập sai bị từ chối *(curl login thật + 2 test REST)*
- [x] Ba vai có màn hình rỗng riêng; vai không có quyền truy cập màn vai khác *(router theo role từ /api/me; kiểm quyền requireRole sẵn cho API sau)*
- [x] Trang công cộng mở không đăng nhập (trang TV trống, cấu trúc có sẵn) *(GET /tv 200, không cần cookie)*
- [x] Vitest chạy được ít nhất một test tích hợp qua seam server (gọi REST + nhận sự kiện socket) đúng mô hình Testing Decisions trong spec *(4/4 pass: 401 sai mật khẩu, cookie httpOnly, /api/me, socket hello kèm vai)*
- [x] UI tiếng Việt toàn bộ; secrets chỉ đọc từ biến môi trường, không có credential literal trong code *(.env local sinh ngẫu nhiên, seed đọc DEMO_PASSWORD, test dùng mật khẩu ngẫu nhiên)*
