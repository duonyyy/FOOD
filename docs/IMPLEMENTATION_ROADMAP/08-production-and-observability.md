# Phase 8 — Production readiness, quan sát và vận hành

## 1. Mục tiêu

Đưa hệ thống từ trạng thái “chạy được trên máy local” sang “có thể vận hành, phát hiện lỗi và khôi phục có kiểm soát”.

Một service trả HTTP 200 không đồng nghĩa hệ thống sẵn sàng production. Cần kiểm tra dependency, bảo mật, backup, alert và rollback.

## 2. Ma trận môi trường

Tối thiểu nên có:

| Môi trường | Mục đích | Dữ liệu | Public access |
|---|---|---|---|
| Local | Phát triển | Seed giả | Máy cá nhân |
| Test/CI | Test tự động | Tạo mới theo test | Không |
| Staging | Diễn tập release | Dữ liệu giả/gần thật đã ẩn danh | Hạn chế |
| Production | Người dùng thật | Dữ liệu thật | Có kiểm soát |

Không dùng chung database, Redis, bucket hoặc secret giữa staging và production.

## 3. Cấu hình production

### Bước 8.1 — Environment validation

Kiểm tra khi boot:

- `NODE_ENV=production`.
- Database URL/host/credential.
- Redis config.
- JWT access/refresh secrets đủ mạnh và không dùng default.
- Mail config hoặc cờ tắt mail rõ ràng.
- Storage config/bucket.
- Payment secrets/webhook secrets.
- OAuth/Firebase config nếu bật.
- CORS allowed origins.
- Public base URL.

Không để app “chạy tạm” với dummy secret ở production.

### Bước 8.2 — Swagger và debug surface

- Swagger có thể bật ở local/staging.
- Production mặc định tắt hoặc đặt sau auth/IP allowlist.
- Không trả stack trace, SQL hoặc config trong response.
- Tắt endpoint debug/seed/reset database.
- Kiểm tra source maps và log không làm lộ secret.

### Bước 8.3 — CORS, proxy và HTTPS

- Allowlist origin cụ thể, không dùng wildcard với credential.
- Cấu hình `trust proxy` đúng số lớp proxy.
- Cookie nếu dùng phải có `Secure`, `HttpOnly`, `SameSite` phù hợp.
- Redirect HTTP sang HTTPS tại ingress/load balancer.
- Thiết lập request body/file size limit.
- Thêm security headers phù hợp.

## 4. Health checks

Tách hai endpoint:

### Liveness

`GET /health/live`

- Chỉ xác nhận process/event loop còn sống.
- Không phụ thuộc mọi external service.
- Dùng để restart container khi process treo.

### Readiness

`GET /health/ready`

Kiểm tra có timeout:

- PostgreSQL query nhẹ.
- Redis ping nếu Redis cần cho request.
- Storage health/head bucket nếu storage bắt buộc.
- Không gọi LLM/payment provider ở mỗi health request.

Readiness fail thì load balancer ngừng gửi traffic, không nhất thiết restart process ngay.

## 5. Logging và tracing

### Structured logging

Log JSON ở production với các field:

```text
timestamp
level
service
environment
requestId
traceId
userId (nếu đã xác thực và được phép log)
method
route
statusCode
durationMs
errorCode
```

Không log:

- Password/OTP.
- JWT/access token/refresh token.
- Cookie/session secret.
- Authorization header.
- Payment credential.
- Nội dung CCCD/bằng lái.
- Raw file hoặc prompt có dữ liệu nhạy cảm.

### Correlation ID

- Nhận request ID từ proxy nếu đáng tin cậy hoặc tự sinh.
- Truyền ID qua service/event/outbox.
- Trả ID trong response header để hỗ trợ tra lỗi.

### Tracing

Nếu triển khai OpenTelemetry, ưu tiên trace:

- HTTP request.
- Database query chậm.
- Redis.
- Object storage.
- Payment provider.
- LLM request.

Không đưa dữ liệu nhạy cảm vào span attributes.

## 6. Metrics và alert

### Golden signals

- Request rate.
- Error rate theo route/status/error code.
- Latency p50/p95/p99.
- Saturation: CPU, memory, event loop, DB pool.

### Metric nghiệp vụ

- Login success/failure và lockout/rate-limit.
- Orders created/completed/cancelled.
- Payment success/failure/stuck.
- Upload success/failure.
- Chat completion/fallback/LLM timeout.
- Queue/outbox backlog.

### Alert ban đầu

Alert phải có runbook link và tránh quá nhạy:

- 5xx tăng vượt baseline trong 5–10 phút.
- p95 latency vượt ngưỡng.
- Readiness fail nhiều instance.
- DB connection pool gần cạn.
- Disk/storage gần đầy.
- Payment webhook invalid tăng đột biến.
- Order/payment mắc kẹt vượt SLA.
- Backup thất bại.

Ngưỡng chính xác phải lấy từ tải thực tế, không sao chép máy móc.

## 7. Database và migration release

Áp dụng expand-and-contract:

1. Thêm schema mới nullable/tương thích.
2. Deploy code đọc cả cũ và mới.
3. Backfill theo batch.
4. Deploy code chỉ ghi mới.
5. Quan sát.
6. Sau release khác mới xóa cột/logic cũ.

Pipeline migration:

- Backup trước migration rủi ro.
- Chạy `migration:show` hoặc lệnh tương đương.
- Chạy migration một lần bằng release job, không để mọi replica tranh nhau.
- Ghi log version/checksum/thời gian.
- Dừng release nếu migration fail.
- Không tự động rollback migration phá hủy dữ liệu.

## 8. Backup và disaster recovery

### PostgreSQL

- Backup tự động theo lịch.
- Mã hóa khi lưu và truyền.
- Retention theo nhu cầu nghiệp vụ/pháp lý.
- Restore test định kỳ vào môi trường tách biệt.

### MinIO/object storage

- Versioning nếu phù hợp.
- Lifecycle cho object tạm/orphan.
- Replication hoặc backup sang hệ thống/vùng khác cho production.
- Không coi Docker volume trên một máy là backup.

### Redis

Xác định Redis chứa cache hay state quan trọng. Nếu chat session/job/idempotency phụ thuộc Redis, thiết kế persistence/HA hoặc khả năng tái tạo phù hợp.

Định nghĩa:

- RPO: chấp nhận mất tối đa bao nhiêu dữ liệu.
- RTO: khôi phục trong bao lâu.
- Người chịu trách nhiệm và trình tự phục hồi.

## 9. Container và deployment

- Multi-stage Docker build.
- Chạy bằng non-root user.
- Ghim base image và dependency versions.
- Không copy `.env`, credential, test data vào image.
- Có liveness/readiness healthcheck.
- Graceful shutdown: ngừng nhận request, hoàn tất request đang chạy, đóng DB/Redis.
- Resource requests/limits phù hợp.
- Tối thiểu hai instance API nếu yêu cầu high availability và state đã tách ra Redis/DB.

MinIO production:

- Không mặc định dùng single-node local Compose.
- Quyết định managed object storage, MinIO distributed hoặc hạ tầng khác dựa trên đội vận hành.
- Có TLS, domain, backup/replication và monitoring.

## 10. CI/CD pipeline

### Pull request

- Install bằng lockfile.
- Format/lint.
- Typecheck/build.
- Unit tests.
- Integration tests với Postgres/Redis/MinIO disposable.
- Migration validation.
- Dependency/secret scan theo công cụ của dự án.

### Deploy staging

- Build image một lần và gắn immutable tag/digest.
- Chạy migration job.
- Deploy.
- Smoke test auth, data API, upload, order và chat.
- Ghi release metadata.

### Deploy production

- Promote đúng image đã test ở staging.
- Backup/check migration readiness.
- Rolling/canary deploy.
- Automated smoke test không tạo dữ liệu nguy hiểm.
- Theo dõi error/latency/business metrics.
- Có tiêu chí tự động hoặc thủ công để rollback.

## 11. Runbooks bắt buộc

Tạo tài liệu thao tác cho:

- API không readiness.
- Database hết connection/slow query.
- Redis unavailable.
- MinIO upload/read lỗi.
- Payment webhook ngừng đến.
- Order/payment mắc kẹt.
- LLM provider outage.
- Secret bị lộ và rotation.
- Backup restore.
- Rollback release.

Mỗi runbook có: dấu hiệu, mức độ ảnh hưởng, kiểm tra đầu tiên, lệnh an toàn, cách giảm ảnh hưởng, escalation và bước xác nhận hồi phục.

## 12. Kiểm thử trước production

- Load test các route đọc phổ biến và tạo order có kiểm soát.
- Test file upload gần giới hạn.
- Test dependency timeout và retry storm.
- Kill một API instance để kiểm tra graceful failover.
- Tạm ngắt Redis/MinIO trong staging để kiểm tra response.
- Diễn tập DB restore.
- Diễn tập rollback ứng dụng.
- Kiểm tra log/metric/alert thực sự phát sinh và đến đúng người.

## 13. Điều kiện hoàn thành

- [ ] Config production được validate, không còn dummy secret.
- [ ] Swagger/debug endpoint được kiểm soát.
- [ ] Liveness/readiness phản ánh đúng trạng thái.
- [ ] Log có request ID và đã redact dữ liệu nhạy cảm.
- [ ] Dashboard và alert cốt lõi hoạt động.
- [ ] Backup thành công và restore đã được chứng minh.
- [ ] CI/CD dùng immutable artifact và có smoke test.
- [ ] Graceful shutdown/rollback đã diễn tập.
- [ ] Runbook sự cố quan trọng đã có owner.
- [ ] MinIO production có quyết định hạ tầng và backup rõ ràng.

