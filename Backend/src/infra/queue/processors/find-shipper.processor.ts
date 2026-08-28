import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { DeliveryAssignmentScheduler } from '../../../features/delivery/services/delivery-assignment-scheduler.service';
import { FindShipperJobData, isFindShipperJobData, QueueNames } from '../queue.constants';

@Processor(QueueNames.FIND_SHIPPER, {
  concurrency: 1,
})
export class FindShipperProcessor extends WorkerHost {
  private readonly logger = new Logger(FindShipperProcessor.name);

  constructor(private readonly deliveryAssignmentScheduler: DeliveryAssignmentScheduler) {
    super();
  }

  async process(job: Job<FindShipperJobData>): Promise<void> {
    try {
      if (!isFindShipperJobData(job.data)) {
        throw new UnrecoverableError('Invalid find-shipper job data');
      }

      await this.deliveryAssignmentScheduler.processShipperAssignmentJobData(
        String(job.id),
        job.data,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const isNonRetryable = error instanceof UnrecoverableError;
      this.logger.error({
        event: isFinalAttempt || isNonRetryable ? 'queue_dead_letter' : 'queue_job_failed',
        queue: QueueNames.FIND_SHIPPER,
        jobId: String(job.id),
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
        retryable: !isNonRetryable,
        error: message,
      }, stack);
      throw error;
    }
  }
}
