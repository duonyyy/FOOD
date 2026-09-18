import type { JobsOptions } from 'bullmq';

/** Generic technical options understood by the queue adapter. */
export interface QueueJobOptions {
  attempts?: number;
  backoffDelayMs?: number;
  delayMs?: number;
  priority?: number;
  jobId?: string;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface QueueRegistrationOptions {
  name: string;
  defaultJobOptions?: JobsOptions;
}
