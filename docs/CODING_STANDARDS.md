# NestJS Feature Module Standard

Đây là bộ quy tắc duy nhất áp dụng cho toàn bộ `src/modules`. Dự án không chia module thành nhiều
kiểu kiến trúc khác nhau và không bắt buộc các tầng `api/application/domain/infrastructure`.

## 1. Module boundary

- Mỗi provider chỉ được đăng ký tại module sở hữu nó.
- Module khác phải import module sở hữu provider; không thêm lại service vào `providers`.
- Chỉ export provider thực sự được module khác sử dụng.
- `TypeOrmModule.forFeature` chỉ khai báo entity được repository trong module inject trực tiếp.
- Không dùng `forwardRef` để che dependency vòng. Khi có vòng phụ thuộc, tách interface hoặc service
  nhỏ hơn.

## 2. Cấu trúc thống nhất

```text
feature/
|-- dto/
|-- services/       # Chỉ tạo khi feature.service.ts cần tách nhỏ
|-- mappers/        # Tùy chọn
|-- types/          # Tùy chọn
|-- feature.controller.ts
|-- feature.resolver.ts     # Tùy chọn
|-- feature.service.ts
|-- feature.service.spec.ts
`-- feature.module.ts
```

- Không tạo thư mục rỗng chỉ để giống cấu trúc mẫu.
- `feature.controller.ts` chỉ xử lý HTTP, validation và gọi service.
- `feature.resolver.ts` chỉ xử lý GraphQL và gọi service.
- `feature.service.ts` là API chính của module. Với module đơn giản, toàn bộ nghiệp vụ có thể nằm
  tại đây.
- Khi service vượt 500 dòng, có trên 10 public method hoặc nhiều nhóm nghiệp vụ, tách vào
  `services/` theo trách nhiệm: `feature-query.service.ts`, `feature-command.service.ts`,
  `feature-image.service.ts`, `feature-statistics.service.ts`.
- Service chính có thể giữ vai trò facade để caller hiện tại không phải đổi đồng loạt.
- Controller không chứa transaction, query database, tính giá hoặc mapping phức tạp.
- Một DTO mô tả một request/response rõ ràng; không tạo DTO chung chứa nhiều field không liên quan.

## 3. API và kiểu dữ liệu

- Không nhận `@Body() body: any`. Mọi input HTTP phải có DTO và validation.
- Không trả entity chứa relation nhạy cảm trực tiếp nếu contract API chưa rõ; dùng response DTO hoặc
  mapper.
- ID dùng `ParseUUIDPipe` hoặc `@IsUUID()` khi entity dùng UUID.
- Không tin `userId`, giá, tổng tiền, role hoặc trạng thái do client gửi lên.
- Dùng union/enum cho status và payment method; không truyền string tùy ý.

## 4. Nghiệp vụ và dữ liệu

- Một use case ghi nhiều bảng phải có transaction boundary rõ ràng.
- Webhook, queue job và event handler phải idempotent.
- Kiểm tra state transition tại một nơi duy nhất.
- Không catch lỗi rồi trả giá trị giả thành công. Giữ nguyên exception có ngữ cảnh hoặc chuyển sang
  exception phù hợp.
- Không thực hiện side effect sau commit mà không có retry/outbox strategy nếu side effect là bắt
  buộc.

## 5. Bảo mật

- Authentication không thay thế authorization: luôn kiểm tra ownership hoặc permission trên
  resource.
- Không log token, secret, payment URL đầy đủ hoặc dữ liệu cá nhân.
- Demo endpoint không được đăng ký trong production module.
- Credential bắt buộc phải fail fast khi thiếu; không fallback sang secret mẫu.

## 6. Chất lượng code

- Dùng Nest `Logger`; không dùng `console.log` trong runtime code.
- Không thêm `any`, floating promise hoặc import/provider không dùng.
- Một file chỉ nên có một trách nhiệm chính.
- Comment giải thích lý do hoặc invariant, không lặp lại câu lệnh bên dưới.
- Chỉ xóa code khi không còn import/caller và build/test xác nhận an toàn.

## 7. Quality gate

Trước khi hoàn tất thay đổi:

```bash
npm run build
npm run lint:modules
npm test -- --runInBand
```

`npm run lint` là quality gate toàn repository. Trong giai đoạn trả nợ kỹ thuật, `lint:modules` là
gate bắt buộc cho phạm vi `src/modules`; warning hiện hữu phải được giảm dần và không được tăng
trong thay đổi mới.

Refactor nghiệp vụ phải có characterization test trước. Payment, promotion, inventory và order state
transition bắt buộc có test cho retry/concurrency.
