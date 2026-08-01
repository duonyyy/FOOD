import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Job, JobsOptions, Queue } from 'bullmq';
import { QueueNames } from './queue.constants';

export interface QueueJobOptions {
  attempts?: number;
  backoffDelayMs?: number;
  delayMs?: number;
  priority?: number;
  jobId?: string;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueNames.FIND_SHIPPER)
    private readonly findShipperQueue: Queue,
  ) {
    this.logger.log('QueueService initialized with BullMQ');
  }

  async addJob<T extends object>(
    queueName: string,
    jobData: T,
    options?: QueueJobOptions,
  ): Promise<string> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.add(queueName, jobData, this.toBullJobOptions(options));

      if (!job.id) {
        throw new InternalServerErrorException(`BullMQ did not return a job ID for queue '${queueName}'.`);
      }

      return String(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to add job to queue '${queueName}': ${message}`, stack);
      throw new InternalServerErrorException(`Failed to add job to queue '${queueName}': ${message}`);
    }
  }

  async getQueueSize(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      const counts = await queue.getJobCounts('waiting', 'delayed', 'prioritized');

      return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.prioritized ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`Failed to get queue size for '${queueName}': ${message}`);
    }
  }

  async getPendingJobs(queueName: string, limit = 10): Promise<Job[]> {
    try {
      const queue = this.getQueue(queueName);
      const end = Math.max(limit - 1, 0);

      return queue.getJobs(['waiting', 'delayed', 'prioritized'], 0, end, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to fetch pending jobs from '${queueName}': ${message}`, stack);
      throw new InternalServerErrorException(`Failed to fetch pending jobs from '${queueName}': ${message}`);
    }
  }

  async getQueueStats(queueName: string): Promise<{
    size: number;
    pendingJobs: Array<{ id: string; data: any }>;
  }> {
    const [size, jobs] = await Promise.all([
      this.getQueueSize(queueName),
      this.getPendingJobs(queueName, 5),
    ]);

    return {
      size,
      pendingJobs: jobs.map((job) => ({
        id: String(job.id),
        data: job.data,
      })),
    };
  }

  async cancelJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to cancel job ${jobId} in queue '${queueName}': ${message}`, stack);
      throw new InternalServerErrorException(`Failed to cancel job ${jobId} in queue '${queueName}': ${message}`);
    }
  }

  async completeJob(): Promise<boolean> {
    this.logger.warn('completeJob is not used with BullMQ. Jobs complete when the processor returns.');
    return false;
  }

  async failJob(): Promise<boolean> {
    this.logger.warn('failJob is not used with BullMQ. Throw inside the processor to fail a job.');
    return false;
  }

  async archiveCompletedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const removed = await queue.clean(24 * 60 * 60 * 1000, 1000, 'completed');

    return removed.length;
  }

  async purgeArchivedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const removed = await queue.clean(7 * 24 * 60 * 60 * 1000, 1000, 'failed');

    return removed.length;
  }

  async getHealthStatus(): Promise<{ isHealthy: boolean }> {
    try {
      await this.findShipperQueue.getJobCounts('waiting', 'active', 'failed');
      return { isHealthy: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get queue health status: ${message}`);
      return { isHealthy: false };
    }
  }

  private getQueue(queueName: string): Queue {
    if (queueName === QueueNames.FIND_SHIPPER) {
      return this.findShipperQueue;
    }

    throw new InternalServerErrorException(`Queue '${queueName}' is not registered.`);
  }

  private toBullJobOptions(options?: QueueJobOptions): JobsOptions {
    return {
      attempts: options?.attempts ?? 3,
      backoff: {
        type: 'fixed',
        delay: options?.backoffDelayMs ?? 5000,
      },
      delay: options?.delayMs,
      priority: options?.priority,
      jobId: options?.jobId,
      removeOnComplete: options?.removeOnComplete ?? true,
      removeOnFail: options?.removeOnFail ?? 1000,
    };
  }
}
