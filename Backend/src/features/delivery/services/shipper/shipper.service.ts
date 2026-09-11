import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from 'src/common/events/outbox.service';
import { Order } from 'src/entities/order.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { Repository } from 'typeorm';
import { UpdateDriverProfileDto } from '../../dto/update-driver-dto';
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
  private readonly reportService: DeliveryReportService;
  private readonly profileService: ShipperProfileService;

  constructor(
    @InjectRepository(Order)
    orderRepository: Repository<Order>,
    @InjectRepository(ShippingDetail)
    shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @InjectRepository(ShipperCertificateInfo)
    certRepo: Repository<ShipperCertificateInfo>,
    pendingAssignmentService: PendingAssignmentService,
    @Optional() outboxService?: OutboxService,
    @Optional() deliveryReportService?: DeliveryReportService,
    @Optional() shipperProfileService?: ShipperProfileService,
  ) {
    super(
      orderRepository,
      shippingDetailRepository,
      userRepository,
      certRepo,
      pendingAssignmentService,
      outboxService,
    );
    this.reportService =
      deliveryReportService ?? new DeliveryReportService(shippingDetailRepository, userRepository);
    this.profileService =
      shipperProfileService ?? new ShipperProfileService({} as never, userRepository, certRepo);
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
