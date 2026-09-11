# Test layout

Test được tách khỏi `src` để code ứng dụng và code kiểm thử không bị trộn lẫn.

```text
test/
├── unit/         # Kiểm tra service, policy, DTO và domain rule
├── integration/  # Kiểm tra module, database, migration, queue và boundary
└── e2e/          # Kiểm tra HTTP/API qua route thật của ứng dụng
```

## Lệnh chạy

```bash
npm test                 # Unit + integration
npm run test:unit        # Chỉ unit test
npm run test:integration # Chỉ integration test
npm run test:e2e         # Chỉ API E2E test
```

Test dùng import `src/...` để không phụ thuộc vị trí của file test trong thư mục `test`.
