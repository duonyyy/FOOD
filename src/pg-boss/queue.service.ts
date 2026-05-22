import { Injectable, Logger, Inject, InternalServerErrorException } from '@nestjs/common';
import * as PgBoss from 'pg-boss';
import { PG_BOSS_INSTANCE } from '../pg-boss/pg-boss.module';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@Inject(PG_BOSS_INSTANCE) private readonly boss: PgBoss) {
    this.logger.log('QueueService initialized with pg-boss');
  }

  /**
   * [NHÀ SẢN XUẤT - PRODUCER]
   * Hàm chính chuyên dùng để tống 1 công việc (Job) vào hàng đợi.
   * Các chỗ khác trong App (như khi khách vừa bấm đặt hàng) sẽ gọi hàm này.
   * 
   * @param queueName Tên hàng đợi (Lấy từ biến QueueNames ở bài trước).
   * @param jobData Dữ liệu truyền vào (như orderId, khu vực... - theo chuẩn Interface).
   * @param options Các option phụ (vd: Sau bao lâu thì Job hết hạn, có thử lặp lại không).
   * @returns Trả về một mã ID duy nhất của cái Job vừa tạo thành công.
   */
  async addJob<T extends object>(
    queueName: string,
    jobData: T,
    options?: PgBoss.SendOptions,
  ): Promise<string> {
    //this.logger.log(`Attempting to add job to queue '${queueName}'...`);
    try {
      // pg-boss send() should throw an error on failure, but we check jobId just in case.
      const jobId: string | null = await this.boss.send(queueName, jobData, options || {});
      if (!jobId) {
        // This case indicates an unexpected issue where send completed without error but returned no ID.
        this.logger.error(
          `pg-boss.send returned null for queue '${queueName}'. This indicates a potential issue with pg-boss or the DB connection.`,
        );
        throw new InternalServerErrorException(`Failed to obtain job ID from pg-boss for queue '${queueName}'.`);
      }

      //this.logger.log(`Job added to queue '${queueName}' with ID: ${jobId}`);
      return jobId;
    } catch (error) {

      // Log the original error from pg-boss for detailed debugging.
      this.logger.error(
        `Failed to add job to queue '${queueName}': ${error.message}`,
        error.stack, // Include stack trace for better context
      );

      // Throw a NestJS standard exception for consistency in error handling.
      throw new InternalServerErrorException(`Failed to add job to queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Đếm số lượng Job đang nằm chờ (chưa được xử lý) trong 1 hàng đợi cụ thể.
   * Hữu ích để theo dõi xem hệ thống có đang bị kẹt/quá tải (khi số này tăng quá nhanh) hay không.
   */
  async getQueueSize(queueName: string): Promise<number> {
    try {
      //this.logger.debug(`Getting queue size for '${queueName}'...`);
      const size = await this.boss.getQueueSize(queueName);
      //this.logger.debug(`Queue '${queueName}' has ${size} jobs`);
      return size;
    } catch (error) {
      //this.logger.error(`Failed to get queue size for '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to get queue size for '${queueName}': ${error.message}`);
    }
  }

  /**
   * Kéo danh sách một vài Job đang chờ (Pending) ra để xem thử thông tin của chúng nó.
   * Chủ yếu dùng để debug hoặc in lên giao diện Dashboard cho Admin xem có đơn nào đang nghẽn.
   * @param limit Giới hạn lấy ra tối đa bao nhiêu job (mặc định lấy thử 10 cái).
   */
  async getPendingJobs(queueName: string, limit: number = 10): Promise<PgBoss.Job<any>[]> {
    try {
     // this.logger.log(`Fetching up to ${limit} pending jobs from queue '${queueName}'...`);
      
      const jobs = await this.boss.fetch(queueName);
      
      if (jobs && jobs.length > 0) {
        //this.logger.log(`📋 Found ${jobs.length} pending jobs in queue '${queueName}':`);
        jobs.forEach((job, index) => {
          this.logger.log(`  ${index + 1}. Job ID: ${job.id}, Data: ${JSON.stringify(job.data)}`);
        });
      } else {
       // this.logger.log(`✅ No pending jobs found in queue '${queueName}'`);
      }
      
      return jobs || [];
    } catch (error) {
      this.logger.error(`Failed to fetch pending jobs from '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fetch pending jobs from '${queueName}': ${error.message}`);
    }
  }

  /**
   * Lấy bản báo cáo chi tiết về hàng đợi (bao gồm tổng số Job đang nghẽn và chi tiết 5 Job đầu tiên).
   */
  async getQueueStats(queueName: string): Promise<{
    size: number;
    pendingJobs: Array<{ id: string; data: any; }>;
  }> {
    try {
      //this.logger.debug(`Getting detailed stats for queue '${queueName}'...`);
      
      const [size, jobs] = await Promise.all([
        this.getQueueSize(queueName),
        this.getPendingJobs(queueName, 5) // Get up to 5 jobs for stats
      ]);

      const stats = {
        size,
        pendingJobs: jobs.map(job => ({
          id: job.id,
          data: job.data,
        }))
      };

     // this.logger.debug(`Stats for queue '${queueName}': ${JSON.stringify(stats, null, 2)}`);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get queue stats for '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to get queue stats for '${queueName}': ${error.message}`);
    }
  }

  /**
   * Hủy ngang một Job chưa kịp chạy, hoặc xóa hẳn nó khỏi hàng đợi.
   * 
   * @param queueName Tên hàng đợi
   * @param jobId Mã ID của cái Job muốn hủy
   */
  async cancelJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      //this.logger.log(`Attempting to cancel job ${jobId} in queue '${queueName}'...`);
      await this.boss.cancel(queueName, jobId);
     // this.logger.log(`Job ${jobId} cancelled successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId} in queue '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to cancel job ${jobId} in queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Đánh dấu bằng tay (Manual) rằn một Job đã hoàn thành xuất sắc (Completed).
   * Thường thư viện tự làm việc này, nhưng đôi khi ta muốn ép nó hoàn thành sớm.
   */
  async completeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
     // this.logger.log(`Attempting to complete job ${jobId} in queue '${queueName}'...`);
      await this.boss.complete(queueName, jobId);
      //this.logger.log(`Job ${jobId} completed successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to complete job ${jobId} in queue '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to complete job ${jobId} in queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Đánh dấu bằng tay rằng một Job đã Thất Bại (Failed) và ghi kèm lý do lỗi 
   * để sau này hệ thống có cớ chui vào tra lỗi (Log).
   */
  async failJob(queueName: string, jobId: string, errorMessage?: string): Promise<boolean> {
    try {
      this.logger.log(`Attempting to fail job ${jobId} in queue '${queueName}'...`);
      await this.boss.fail(queueName, jobId);
      this.logger.log(`Job ${jobId} failed successfully. Reason: ${errorMessage || 'No reason provided'}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to fail job ${jobId} in queue '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to fail job ${jobId} in queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Đóng gói (Lưu trữ/Archive) tất cả các Job đã chạy xong (quá 24 giờ).
   * Mục đích: Gom chúng sang một góc riêng trong Database để không làm nặng bảng chính.
   */
  async archiveCompletedJobs(queueName: string, olderThanHours: number = 24): Promise<number> {
    try {
      this.logger.log(`Attempting to archive completed jobs in queue '${queueName}' older than ${olderThanHours} hours...`);
      const result = await this.boss.archive();
      this.logger.log(`Archived ${result} completed jobs from queue '${queueName}'`);
      return 0;
    } catch (error) {
      this.logger.error(`Failed to archive completed jobs in queue '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to archive completed jobs in queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Tiêu hủy (Purge) VĨNH VIỄN các Job đã đóng gói mà quá cũ (mặc định 7 ngày).
   * Giúp Database không bị phình to (tiết kiệm ổ cứng server).
   */
  async purgeArchivedJobs(queueName: string, olderThanDays: number = 7): Promise<number> {
    try {
      this.logger.log(`Attempting to purge archived jobs in queue '${queueName}' older than ${olderThanDays} days...`);
      const result = await this.boss.purge();
      this.logger.log(`Purged ${result} archived jobs from queue '${queueName}'`);
      return  0;
    } catch (error) {
      this.logger.error(`Failed to purge archived jobs in queue '${queueName}': ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to purge archived jobs in queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Kiểm tra tình trạng "Sức khỏe" của toàn bộ hệ thống Hàng Đợi (Queue).
   * Dùng báo đèn xanh/đỏ trên server để biết pg-boss có kết nối thành công với Database hay đã chết.
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
  }> {
    try {
      this.logger.debug('Getting queue system health status...');
      
      // Get basic health information
      const health = await this.boss.schemaVersion();
      
      const status = {
        isHealthy: true,
      };

      this.logger.debug(`Queue health status: ${JSON.stringify(status)}`);
      return status;
    } catch (error) {
      this.logger.error(`Failed to get queue health status: ${error.message}`, error.stack);
      return {
        isHealthy: false,
      };
    }
  }
}