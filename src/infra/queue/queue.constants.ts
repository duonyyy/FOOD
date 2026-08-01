export const QueueNames = {
  FIND_SHIPPER: 'find-shipper',
  NOTIFY_SHIPPERS: 'notify-shippers',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

export interface FindShipperJobData {
  readonly pendingAssignmentId: string;
  readonly orderId: string;
  readonly attempt: number;
  readonly isRetry?: boolean;
  readonly originalJobId?: string;
  readonly retryAttempt?: number;
}

export interface GcsUploadJobData {
  readonly tempFilePath: string;
  readonly originalname: string;
  readonly mimetype: string;
  readonly folder: string;
  readonly isPublic: boolean;
  readonly transcodingConfig?: any;
  readonly contentId?: string;
}
