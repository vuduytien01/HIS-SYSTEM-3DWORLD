# 14: Deploy Docker Compose + seed dữ liệu + tài liệu chạy

**What to build:** Toàn hệ thống chạy trên một máy bằng `docker compose up`: app (custom Node server) + Postgres, biến môi trường cho mọi bí mật (không credential literal trong code). Seed dữ liệu khởi động: Phòng theo mặt bằng v1 (sảnh, quầy lễ tân, khu chờ, nội, ngoại, nhi, mắt, răng, tai mũi họng, X-quang, siêu âm, xét nghiệm, quầy thuốc, Khu thu ngân, hành lang), nhân viên demo cho ba vai, vài Bệnh nhân. Tài liệu chạy cho người triển khai.

**Blocked by:** 13 — Admin bulk/audit/metrics

**Status:** ready-for-agent

- [ ] `docker compose up` một lần chạy cả app + Postgres; đăng nhập, tiếp nhận, gọi số, xếp phòng đều được trên bản build
- [ ] Seed: 15 vị trí mặt bằng v1 + 3 tài khoản ba vai + vài Bệnh nhân; seed chạy lại không nhân đôi (idempotent)
- [ ] Mọi bí mật đọc từ biến môi trường; .env đi kèm là ví dụ, không chứa giá trị thật
- [ ] Smoke test qua seam server chạy được trên bản build (login → tiếp nhận → gọi → xếp phòng)
- [ ] Tài liệu chạy cho người triển khai: khởi động, seed, tài khoản demo, các biến môi trường
