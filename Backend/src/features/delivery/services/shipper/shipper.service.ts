import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import {
  OrderDeliveryLifecycleCommandService,
  OrderDeliveryShipperReaderService,
} from 'src/features/orders/order-delivery-shipper.public-api';
import { Repository } from 'typeorm';
import { UpdateDriverProfileDto } from '../../dto/update-driver-dto';
import { DeliveryAssignmentScheduler } from '../dispatch/delivery-dispatch.service';
import { DeliveryAssignmentSagaService } from './delivery-assignment-saga.service';
import { DeliveryCompletionService } from './delivery-completion.service';
import { DeliveryReportService } from './delivery-report.service';
import { ShipperDeliveryService } from './shipper-delivery.service';
import { ShipperProfileService } from './shipper-profile.service';

/**
 * Backward compatibility facade for ShipperService.
 * Core domain operations are divided into specialized actor-driven services:
 * - ShipperDeliveryService: Trip lifecycle (Offer, Accept, Start, Complete, Cancel, Reject)
 * - ShipperProfileService: Driver identity, verification certificates, and GPS broadcasts
 * - DeliveryReportService: Income analytics, dashboards, and milestone rankings
 * - AdminDeliveryService: Administrative driver approval and platform tracking
 * - DeliveryIntegrationService: Cross-module read and quote ports
 */
@Injectable()
export class ShipperService extends ShipperDeliveryService {
  constructor(
    @InjectRepository(ShippingDetail)
    shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(ShipperProfile)
    shipperProfileRepository: Repository<ShipperProfile>,
    pendingAssignmentService: DeliveryAssignmentScheduler,
    deliveryAssignmentSagaService: DeliveryAssignmentSagaService,
    deliveryCompletionService: DeliveryCompletionService,
    orderLifecycleCommand: OrderDeliveryLifecycleCommandService,
    orderShipperReader: OrderDeliveryShipperReaderService,
    private readonly reportService: DeliveryReportService,
    private readonly profileService: ShipperProfileService,
  ) {
    super(
      shippingDetailRepository,
      shipperProfileRepository,
      pendingAssignmentService,
      deliveryAssignmentSagaService,
      deliveryCompletionService,
      orderLifecycleCommand,
      orderShipperReader,
    );
  }

  async getIncomeReport(
    shipperId: string,
    range: 'today' | 'week' | 'month',
    monthStr?: string,
    yearStr?: string,
  ) {
    return this.reportService.getIncomeReport(shipperId, range, monthStr, yearStr);
  }

  async getShipperDashboard(shipperId: string) {
    return this.reportService.getShipperDashboard(shipperId);
  }

  async getShipperStats(shipperId: string) {
    return this.reportService.getShipperStats(shipperId);
  }

  async updateDriverProfile(userId: string, dto: UpdateDriverProfileDto) {
    return this.profileService.updateDriverProfile(userId, dto);
  }

  async getDriverProfile(userId: string) {
    return this.profileService.getDriverProfile(userId);
  }

  async updateLocation(shipperId: string, latitude: number, longitude: number) {
    return this.profileService.updateLocation(shipperId, latitude, longitude);
  }
}
