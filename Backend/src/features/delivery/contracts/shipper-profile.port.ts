export const SHIPPER_PROFILE_READER = Symbol('SHIPPER_PROFILE_READER');

export interface ShipperProfileSnapshot {
  userId: string;
  certificateStatus: string;
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
}
