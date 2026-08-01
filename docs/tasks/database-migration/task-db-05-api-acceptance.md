# Task DB-05: Nghiệm thu các API đọc restaurants, foods và promotions

## Mục tiêu

Xác nhận lỗi HTTP 500 hiện tại biến mất sau khi migration hoàn tất và các API đọc dữ liệu thực tế từ PostgreSQL.

## API trong phạm vi

| API | Hiện trạng | Kết quả mong đợi |
|---|---:|---|
| `GET /restaurants/all?page=1&pageSize=1` | 500 do thiếu `restaurants` | 200 |
| `GET /foods?page=1&pageSize=1` | 500 do thiếu `foods` | 200 |
| `GET /promotions/all?page=1&pageSize=1` | 500 do thiếu `promotions` | 200 |

## Công việc chi tiết

1. Chạy migration thành công trên đúng database API đang dùng.
2. Khởi động/restart API sau migration.
3. Gọi cả ba endpoint với query pagination như trên.
4. Kiểm tra HTTP status, cấu trúc response, metadata phân trang và kiểu dữ liệu.
5. Kiểm tra log API không còn `relation "restaurants" does not exist`, `relation "foods" does not exist` hoặc `relation "promotions" does not exist`.
6. Kiểm tra response có thể rỗng hợp lệ nếu seed không tạo dữ liệu, nhưng không được là lỗi database.

## Kiểm thử đề xuất

```powershell
Invoke-WebRequest http://localhost:<API_PORT>/restaurants/all?page=1&pageSize=1
Invoke-WebRequest http://localhost:<API_PORT>/foods?page=1&pageSize=1
Invoke-WebRequest http://localhost:<API_PORT>/promotions/all?page=1&pageSize=1
docker logs fooddie_api | Select-String 'relation|QueryFailedError|restaurants|foods|promotions'
```

Kiểm tra dữ liệu ở tầng database:

```powershell
docker exec fooddie_postgres psql -U postgres -d fooddie_db -c "SELECT COUNT(*) FROM restaurants; SELECT COUNT(*) FROM foods; SELECT COUNT(*) FROM promotions;"
```

## Tiêu chí nghiệm thu

- Cả ba endpoint trả HTTP 200.
- Response đúng contract hiện có của từng controller/service.
- Pagination không gây lỗi khi `page=1&pageSize=1`.
- Không còn lỗi thiếu relation trong log.
- Restart API không làm mất schema hoặc dữ liệu.
- Smoke test MinIO vẫn pass, chứng minh migration fix không làm regression task MinIO.

## Lưu ý phản biện

HTTP 200 chỉ chứng minh route không còn fail ở request đó. Cần kiểm tra thêm response contract và dữ liệu trong database; nếu seed chưa có bản ghi, API có thể trả danh sách rỗng nhưng vẫn là trạng thái hợp lệ.
