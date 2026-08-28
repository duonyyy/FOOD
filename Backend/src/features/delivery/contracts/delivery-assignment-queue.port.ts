export const DELIVERY_ASSIGNMENT_QUEUE = 'find-shipper';
export const DELIVERY_ASSIGNMENT_QUEUE_PORT = Symbol('DELIVERY_ASSIGNMENT_QUEUE_PORT');

export interface DeliveryAssignmentJobData {
  readonly pendingAssignmentId: string;
  readonly orderId: string;
  readonly attempt: number;
  readonly isRetry?: boolean;
  readonly originalJobId?: string;
  readonly retryAttempt?: number;
}

export interface DeliveryQueueJobOptions {
  attempts?: number;
  backoffDelayMs?: number;
  delayMs?: number;
  priority?: number;
  jobId?: string;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface DeliveryAssignmentQueuePort {
  addJob(
    queueName: string,
    jobData: DeliveryAssignmentJobData,
    options?: DeliveryQueueJobOptions,
  ): Promise<string>;
  getQueueSize(queueName: string): Promise<number>;
}

export function isDeliveryAssignmentJobData(data: unknown): data is DeliveryAssignmentJobData {
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
