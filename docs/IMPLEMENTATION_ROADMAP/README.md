# Foodee Backend — Lộ Trình Triển Khai Theo Giai Đoạn

Đây là roadmap triển khai chính thức, chi tiết và có thứ tự phụ thuộc cho backend Foodee. Mục tiêu là cải thiện dự án mà vẫn giữ hệ thống chạy được sau mỗi phase, tránh refactor toàn bộ cùng lúc.

## 1. Kết quả cuối cùng cần đạt

Khi hoàn thành toàn bộ roadmap:

- Authentication có validation, rate limit, token lifecycle và test rõ ràng.
- Module lớn được chia theo use case, không tiếp tục phình thành “god service”.
- Ảnh mới được lưu trên MinIO; ảnh public và hồ sơ private được tách quyền.
- Ảnh cũ được migrate có kiểm soát, có dry-run và rollback manifest.
- Order/payment không tin giá từ client, có transaction và idempotency.
- Chatbot có state rõ ràng, xác nhận cuối và validate từ database.
- Docker, migration, healthcheck, logging, backup và CI đủ dùng cho production.

## 2. Thứ tự phase bắt buộc

| Phase | Tài liệu | Kết quả chính | Phụ thuộc |
|---:|---|---|---|
| 0 | [Quy tắc thực hiện](00-execution-rules.md) | Cách làm, bằng chứng và rollback thống nhất | Không |
| 1 | [Baseline và coding standards](01-baseline-and-coding-standards.md) | Có baseline, CI check, quy chuẩn code | Phase 0 |
| 2 | [Security và authentication](02-security-and-authentication.md) | Auth an toàn và có test | Phase 1 |
| 3 | [Module boundaries và test foundation](03-module-boundaries-and-test-foundation.md) | Có cấu trúc use case và test nền | Phase 1–2 |
| 4 | [MinIO storage foundation](04-minio-storage-foundation.md) | Upload mới chạy qua MinIO | Phase 1–3 |
| 5 | [Migration ảnh cũ](05-image-migration.md) | Ảnh được phép chuyển an toàn | Phase 4 |
| 6 | [Order và payment reliability](06-order-and-payment-reliability.md) | Không sai tiền/trùng order/payment | Phase 2–3 |
| 7 | [Chatbot ordering](07-chatbot-ordering.md) | Chat đặt món ổn định và an toàn | Phase 6 |
| 8 | [Production và observability](08-production-and-observability.md) | Deploy, theo dõi, backup được | Phase 1–7 |
| 9 | [Release checklist](09-final-release-checklist.md) | Kiểm tra cuối trước release | Tất cả |

## 3. Luồng thực hiện

```txt
Baseline
   ↓
Security/Auth
   ↓
Test foundation + module boundaries
   ├──────────────→ MinIO foundation → Image migration
   └──────────────→ Order/Payment → Chatbot
                                      ↓
                         Production/Observability
                                      ↓
                            Final release checklist
```

## 4. Thời gian tham khảo

Ước lượng dưới đây dành cho một developer đã quen NestJS ở mức cơ bản, có người review và không phải đồng thời phát triển tính năng sản phẩm lớn. Đây không phải deadline cam kết; cần cập nhật lại sau Phase 1 dựa trên số liệu thực tế.

| Phase | Thời gian tham khảo | Có thể song song |
|---:|---:|---|
| 0 | 0.5–1 ngày | Không |
| 1 | 3–5 ngày | Không |
| 2 | 5–8 ngày | Một phần tài liệu/test |
| 3 | 5–10 ngày | Theo module, sau khi có chuẩn chung |
| 4 | 4–7 ngày | Có thể song song Phase 6 sau Phase 3 |
| 5 | 3–8 ngày | Có thể song song Phase 6; phụ thuộc số ảnh và quyền sử dụng |
| 6 | 8–15 ngày | Có thể song song Phase 4–5 nếu khác người phụ trách |
| 7 | 8–15 ngày | Không nên bắt đầu trước Phase 6 |
| 8 | 5–10 ngày | Một phần observability có thể làm sớm |
| 9 | 1–3 ngày | Không |

Nếu chỉ có một người làm tuần tự, tổng thô khoảng **43–82 ngày làm việc**. Nếu có từ hai người, sau Phase 3 có thể chia:

- Nhánh A: Phase 4 → Phase 5 — storage và dữ liệu ảnh.
- Nhánh B: Phase 6 → Phase 7 — order/payment và chatbot.
- Hai nhánh cùng hội tụ tại Phase 8 → Phase 9.

Không nên rút ngắn bằng cách bỏ test, backup hay rollback. Muốn rút ngắn an toàn, hãy giảm phạm vi của một release và giữ exit criteria.

## 5. Các mốc bàn giao

| Mốc | Phase bao gồm | Bản bàn giao có thể kiểm chứng |
|---|---|---|
| Milestone A — Nền móng an toàn | 0–2 | Baseline, CI gate và auth được bảo vệ |
| Milestone B — Dễ maintain | 3 | Module boundary và test foundation |
| Milestone C — Storage mới | 4–5 | Upload MinIO và migration ảnh có rollback |
| Milestone D — Nghiệp vụ cốt lõi | 6 | Order/payment đúng tiền, đúng trạng thái, không trùng |
| Milestone E — Chat ordering | 7 | Chatbot dùng domain service và xác nhận an toàn |
| Milestone F — Sẵn sàng phát hành | 8–9 | Monitoring, backup, runbook và Go/No-Go |

## 6. Cách dùng tài liệu

1. Tạo issue/task từ từng checkbox trong phase hiện tại.
2. Mỗi PR chỉ giải quyết một nhóm task có thể test độc lập.
3. Chạy các lệnh kiểm tra ghi trong tài liệu trước khi merge.
4. Lưu bằng chứng: test output, API response, migration report hoặc ảnh chụp MinIO Console.
5. Chỉ đánh dấu phase hoàn thành khi toàn bộ exit criteria đạt.
6. Nếu exit criteria chưa đạt, không bắt đầu phase phụ thuộc phía sau.

## 7. Mức ưu tiên

- `P0`: lỗi bảo mật, mất dữ liệu, sai tiền, app không khởi động.
- `P1`: ảnh hưởng trực tiếp flow chính hoặc khả năng maintain.
- `P2`: cải thiện UX, performance hoặc developer experience.

## 8. Quy ước trạng thái

- `[ ]`: chưa làm.
- `[~]`: đang làm; ghi link branch/PR bên cạnh.
- `[x]`: đã làm và có bằng chứng kiểm tra.
- `BLOCKED`: có blocker; phải ghi nguyên nhân và điều kiện gỡ blocker.

## 9. Nguyên tắc phạm vi

- Không chuyển sang microservice trong roadmap này.
- Không rewrite toàn bộ `src/modules`.
- Không xóa GCS trước khi MinIO và migration ảnh đã được xác nhận.
- Không migrate ảnh bên ngoài khi chưa xác minh quyền sử dụng.
- Không tối ưu performance khi chưa đo và chưa có test tính đúng.
