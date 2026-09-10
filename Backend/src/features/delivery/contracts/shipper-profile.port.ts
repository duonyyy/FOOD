export const SHIPPER_PROFILE_READER = Symbol('SHIPPER_PROFILE_READER');
export const SHIPPER_PROFILE_COMMANDS = Symbol('SHIPPER_PROFILE_COMMANDS');

export const SHIPPER_PROFILE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ShipperProfileStatus =
  (typeof SHIPPER_PROFILE_STATUS)[keyof typeof SHIPPER_PROFILE_STATUS];

export interface CreateShipperProfileCommand {
  userId: string;
  cccd?: string;
  driverLicense?: string;
}

export interface ShipperProfileSnapshot {
  userId: string;
  cccd: string | null;
  driverLicense: string | null;
  certificateStatus: ShipperProfileStatus;
  certificateVerifiedAt: Date | null;
  isAvailable: boolean;
  maxActiveDeliveries: number;
  serviceRadiusKm: number;
  completedDeliveries: number;
  failedDeliveries: number;
  activeDeliveries: number;
  averageRating: number;
  totalEarnings: number;
}

export interface ShipperProfileReaderPort {
  findByUserId(userId: string): Promise<ShipperProfileSnapshot | null>;
  findByStatus(status?: ShipperProfileStatus, userId?: string): Promise<ShipperProfileSnapshot[]>;
}

export interface ShipperProfileCommandPort {
  createPending(command: CreateShipperProfileCommand): Promise<ShipperProfileSnapshot>;
  updateCertificateStatus(
    userId: string,
    status: ShipperProfileStatus,
  ): Promise<ShipperProfileSnapshot>;
}
