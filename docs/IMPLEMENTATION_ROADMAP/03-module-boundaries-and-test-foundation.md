# Phase 3 — Module Boundaries và Test Foundation

## Mục tiêu

Tạo nền test đủ mạnh để tách các service lớn mà không làm thay đổi nghiệp vụ ngoài ý muốn.

## 1. Phân loại module

### Module lớn cần chia theo use case

- `order`
- `food`
- `shipper`
- `restaurant`
- `role` nếu tiếp tục mở rộng permission

### Module nhỏ giữ cấu trúc đơn giản

- `address`
- `category`
- `review`
- `notification`

Không ép module nhỏ dùng đủ tầng `domain/application/infrastructure` nếu không có business rule phức tạp.

## 2. Cấu trúc mục tiêu cho module lớn

```txt
module-name/
├── api/
│   ├── *.controller.ts
│   └── *.resolver.ts
├── application/
│   ├── create-*.service.ts
│   ├── update-*.service.ts
│   └── get-*.service.ts
├── domain/
│   ├── *.policy.ts
│   └── *.types.ts
├── dto/
├── mappers/
├── repositories/
├── tests/
└── module-name.module.ts
```

## 3. Trình tự refactor mỗi service lớn

1. Liệt kê public methods và caller bằng search/code graph.
2. Nhóm method theo use case, không nhóm chỉ theo CRUD.
3. Viết characterization test cho hành vi hiện tại.
4. Tách một use case nhưng giữ facade cũ để caller không đổi đồng loạt.
5. Chuyển caller sang service mới theo từng PR.
6. Xóa method facade chỉ khi không còn caller và test pass.

## 4. Test pyramid áp dụng

- Unit test: policy, parser, validator, calculator.
- Application test: use case với repository/service mock.
- Integration test: TypeORM + PostgreSQL test cho transaction/query quan trọng.
- E2E: auth, create order, payment webhook, chat happy path.

## 5. Test infrastructure

- [ ] Tạo factory fixture cho user, role, restaurant, food, address, order.
- [ ] Không phụ thuộc ID seed cố định trong unit test.
- [ ] Có cách reset database test an toàn, không dùng database dev.
- [ ] Mock external service: Firebase, mail, payment gateway, MinIO/LLM ở unit test.
- [ ] Integration test dùng container/service riêng và schema riêng.

## 6. Logging và error boundaries

- [ ] Request ID middleware/interceptor.
- [ ] Mapper từ domain/application error sang HTTP exception.
- [ ] Không catch rồi throw `new Error()` làm mất status/context.
- [ ] Error log có module, action, requestId và resource ID phù hợp.

## 7. Deliverables theo module

### Order

- Tách create order, cancel order, update status, history và shipper assignment.

### Food

- Tách query/search, command/update, image handling và review aggregation.

### Shipper

- Tách assignment, delivery lifecycle, profile/performance và earnings.

### Restaurant

- Tách registration/approval, profile/files, analytics và queries.

## Rủi ro và rollback

- Refactor làm thay đổi query/relations: giữ snapshot response hoặc contract test.
- Circular dependency: dùng exported application interfaces, không thêm `forwardRef` như giải pháp mặc định.
- PR quá lớn: giới hạn một use case hoặc một dependency direction mỗi PR.

## Exit criteria

- Có fixture/test foundation dùng lại được.
- Mỗi module lớn đã có ít nhất một use case được tách làm mẫu.
- Facade cũ vẫn bảo đảm compatibility trong thời gian chuyển đổi.
- Không tăng thêm `any`, console runtime hoặc controller business logic.

