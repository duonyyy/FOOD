import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PendingAssignmentService } from '../pending-assignment.service';
import { FindShipperJobData, QueueNames } from '../queue.constants';

@Processor(QueueNames.FIND_SHIPPER, {
  concurrency: 1,
})
export class FindShipperProcessor extends WorkerHost {
  private readonly logger = new Logger(FindShipperProcessor.name);

  constructor(private readonly pendingAssignmentService: PendingAssignmentService) {
    super();
  }

  async process(job: Job<FindShipperJobData>): Promise<void> {
    try {
      await this.pendingAssignmentService.processShipperAssignmentJobData(String(job.id), job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to process find-shipper job ${job.id}: ${message}`, stack);
      throw error;
    }
  }
}
