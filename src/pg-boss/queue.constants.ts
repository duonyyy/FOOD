/**
 * Khai báo các tên cố định (constants) dùng làm ID định danh cho các hàng đợi (queues) khác nhau trong hệ thống.
 * Việc gom các tên (chuỗi string) này vào một biến object dùng chung giúp tránh lỗi gõ sai chính tả 
 * khi gọi tên hàng đợi ở nhiều file khác nhau.
 */
export const QueueNames = {
  // Tên hàng đợi chuyên dùng cho các Job phát lệnh "Tự động đi tìm Shipper gần nhất cho một đơn hàng"
  FIND_SHIPPER: 'find-shipper',
  
  // Tên hàng đợi dùng cho các Job đi gửi thông báo (notify) đến điện thoại/app của các shipper đã tìm được
  NOTIFY_SHIPPERS: 'notify-shippers',
} as const;

/**
 * Định nghĩa cấu trúc dữ liệu (Interfaces) bắt buộc phải truyền vào khi tạo một Job (Công việc).
 * Giúp TypeScript bắt lỗi ngay lúc code nếu code ở chỗ khác tạo một Job mà truyền thiếu thông tin.
 */

// Format dữ liệu bắt buộc khi ném một Job hệ thống vào hàng đợi "FIND_SHIPPER"
export interface FindShipperJobData {
  readonly pendingAssignmentId: string; // ID của bản ghi lưu cục phân công đang bị "treo" (chờ xử lý)
  readonly orderId: string;             // ID của đơn hàng đang cần tìm shipper
  readonly attempt: number;             // Số lần thử tìm (vd: lần 1 thất bại do ko có ai, thì tự động gọi lần 2, lần 3)
  
  // Các option phụ (có dấu ?)
  readonly isRetry?: boolean;           // Cờ đánh dấu: Đây có phải là lần thuật toán thử tìm lại (retry) không?
  readonly originalJobId?: string;      // ID gốc của cái Job đầu tiên (Nếu đây là lần chạy lại)
  readonly retryAttempt?: number;       // Đây là lần thử lại thứ mấy?
}

// Format dữ liệu bắt buộc khi gán 1 Job tải file nền vào hàng đợi tải ảnh/video lên 
// Google Cloud Storage (GCS - Nếu có hàng đợi dành riêng cho Upload).
export interface GcsUploadJobData {
  readonly tempFilePath: string;        // Đường dẫn tạm thời của file ảnh/video lưu trên máy chủ
  readonly originalname: string;        // Tên gốc của file lúc user tải lên (vd: avatar.png)
  readonly mimetype: string;            // Loại file (vd: image/jpeg)
  readonly folder: string;              // Thư mục trên Google Cloud muốn lưu file vào
  readonly isPublic: boolean;           // Public file để cho ai cũng xem được (true), hay private (false)
  readonly transcodingConfig?: any;     // Cấu hình mã hóa (Dùng nếu file upload là video cần convert độ phân giải)
  readonly contentId?: string;          // ID nội dung liên đới
}

