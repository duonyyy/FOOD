import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import type { DeliveryAssignmentJobData } from 'src/shared/types/delivery/delivery-assignment.types';
import { DeliveryDispatchService } from '../services/delivery-dispatch.service';
import { DELIVERY_ASSIGNMENT_QUEUE } from './delivery-queue.constants';

function isDeliveryAssignmentJobData(data: unknown): data is DeliveryAssignmentJobData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const job = data as Partial<DeliveryAssignmentJobData>;
  return (
    typeof job.pendingAssignmentId === 'string' &&
    typeof job.orderId === 'string' &&
    typeof job.attempt === 'number'
  );
}

@Processor(DELIVERY_ASSIGNMENT_QUEUE, { concurrency: 1 })
export class FindShipperProcessor extends WorkerHost {
  private readonly logger = new Logger(FindShipperProcessor.name);

  constructor(private readonly deliveryDispatchService: DeliveryDispatchService) {
    super();
  }

  async process(job: Job<DeliveryAssignmentJobData>): Promise<void> {
    try {
      if (!isDeliveryAssignmentJobData(job.data)) {
        throw new UnrecoverableError('Invalid find-shipper job data');
      }

      await this.deliveryDispatchService.processShipperAssignmentJobData(String(job.id), job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const isNonRetryable = error instanceof UnrecoverableError;
      this.logger.error(
        {
          event: isFinalAttempt || isNonRetryable ? 'queue_dead_letter' : 'queue_job_failed',
          queue: DELIVERY_ASSIGNMENT_QUEUE,
          jobId: String(job.id),
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts ?? 1,
          retryable: !isNonRetryable,
          error: message,
        },
        stack,
      );
      throw error;
    }
  }
}
