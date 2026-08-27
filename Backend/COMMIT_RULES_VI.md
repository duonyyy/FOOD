# Quy tắc viết commit cho Foodee

Tài liệu này hướng dẫn cách đặt tên commit để mọi người trong nhóm dễ đọc
`git log`, dễ tìm lại thay đổi và dễ review code.

## 1. Công thức chung

Mỗi commit viết theo mẫu:

```text
<loại>: <mô tả ngắn bằng tiếng Anh hoặc tiếng Việt>
```

Ví dụ:

```text
feat: add payment reconciliation job
fix: validate payment webhook amount
test: add review policy tests
docs: update API testing guide
```

Mô tả nên:

- Viết ở dạng hành động: `add`, `fix`, `update`, `remove`.
- Nói rõ mình đã thay đổi gì.
- Không viết quá dài; nên giữ dưới khoảng 72 ký tự.
- Không chấm `.` ở cuối câu.
- Không dùng các câu quá chung chung như `update code`, `fix bug`, `changes`.

## 2. Các loại commit được dùng

| Loại | Dùng khi | Ví dụ |
|---|---|---|
| `feat` | Thêm chức năng mới | `feat: add restaurant approval flow` |
| `fix` | Sửa lỗi chức năng | `fix: prevent duplicate payment callback` |
| `test` | Thêm hoặc sửa test | `test: cover concurrent review creation` |
| `refactor` | Đổi cấu trúc code nhưng không đổi chức năng | `refactor: split food command and query service` |
| `docs` | Sửa tài liệu Markdown/API | `docs: add commit rules in Vietnamese` |
| `chore` | Việc bảo trì, cấu hình, dependency | `chore: update Docker healthcheck` |
| `perf` | Cải thiện hiệu năng | `perf: add menu query cache` |
| `revert` | Hoàn tác một commit trước đó | `revert: undo invalid payment transition` |

Nếu một thay đổi vừa có code vừa có test, chọn loại chính của thay đổi. Ví dụ
thêm chức năng và viết test đi kèm thì dùng `feat`, không cần tạo hai commit.

## 3. Quy tắc quan trọng

### Một commit nên làm một việc

Nên:

```text
feat: add payment reconciliation job
```

Không nên gộp vào cùng commit đó các việc không liên quan như sửa giao diện,
đổi tên biến ở module khác và cập nhật tài liệu Phase 3.

### Không commit file nhạy cảm

Không đưa các file sau lên GitHub:

- `.env` hoặc file chứa mật khẩu, secret, token.
- `node_modules/`, `dist/`, `coverage/`.
- Log, file tạm và dữ liệu cá nhân.

### Kiểm tra trước khi commit

Trong thư mục `Backend`, chạy tối thiểu:

```powershell
npm run build
npx jest --runInBand <test-lien-quan>
git diff --check
git status
```

Nếu test hoặc build lỗi, phải ghi rõ nguyên nhân trong lúc review. Không dùng
`--no-verify` để bỏ qua kiểm tra nếu chưa được cả nhóm đồng ý.

### Không đưa thay đổi của người khác vào commit

Trước khi `git add`, kiểm tra:

```powershell
git status
git diff
```

Chỉ add đúng file thuộc task đang làm. Không dùng `git add .` một cách máy móc
nếu trong thư mục đang có file của task khác.

## 4. Quy trình commit và push

Ví dụ hoàn thành một task:

```powershell
git status
git diff --check
git add Backend/src/payment/payment.service.ts
git add Backend/src/payment/payment-reconciliation.service.ts
git add Backend/src/payment/payment-reconciliation.service.spec.ts
git commit -m "feat: add payment reconciliation job"
git push origin main
```

Sau khi push, kiểm tra lại:

```powershell
git status
git log -1 --oneline
```

Kết quả mong muốn là commit đã xuất hiện trên `origin/main` và không còn file
thay đổi ngoài ý muốn.

## 5. Một số mẫu dùng ngay

```text
feat: add restaurant approval policy
feat: add food command service
fix: reject unauthorized restaurant approval
fix: prevent duplicate order payment event
test: add payment webhook replay tests
test: cover invalid restaurant state transition
refactor: move category ownership to catalog
docs: update phase 4 handoff report
chore: fix TypeORM migration file pattern
```

## 6. Cách đặt commit cho task theo Phase

Nên dùng tên chức năng, không cần ghi quá nhiều mã Phase trong commit:

```text
feat: add payment reconciliation and bounded retries
feat: add delivery assignment commands
fix: enforce admin approval capability
test: add delivery concurrent accept tests
```

Mã Phase/TASK nên ghi trong phần mô tả commit hoặc tài liệu evidence khi cần
truy vết, còn tiêu đề commit nên ngắn và dễ hiểu.
