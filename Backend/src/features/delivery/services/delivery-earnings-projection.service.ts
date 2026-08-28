import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeliveryCompletedEvent } from 'src/common/events/delivery-completed.event';
import { DeliveryEarningsEvent } from 'src/entities/deliveryEarningsEvent.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { EntityManager, Repository } from 'typeorm';

export interface DeliveryEarningsProjectionSnapshot {
  shipperId: string;
  completedDeliveries: number;
  totalEarnings: number;
  averageDeliveryTime: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
}

@Injectable()
export class DeliveryEarningsProjectionService {
  private readonly logger = new Logger(DeliveryEarningsProjectionService.name);

  constructor(
    @InjectRepository(DeliveryEarningsEvent)
    private readonly eventRepository: Repository<DeliveryEarningsEvent>,
    @InjectRepository(ShipperProfile)
    private readonly profileRepository: Repository<ShipperProfile>,
  ) {}

  async project(event: DeliveryCompletedEvent): Promise<boolean> {
    try {
      return await this.eventRepository.manager.transaction(async (manager) => {
        const eventRepository = manager.getRepository(DeliveryEarningsEvent);
        const existing = await eventRepository.findOne({
          where: { idempotencyKey: `delivery-completed:${event.orderId}` },
        });
        if (existing) return false;

        await eventRepository.save(
          eventRepository.create({
            idempotencyKey: `delivery-completed:${event.orderId}`,
            orderId: event.orderId,
            shipperId: event.shipperId,
            earnings: event.earnings,
            completedAt: new Date(event.completedAt),
            deliveryTimeMinutes: event.deliveryTimeMinutes,
            onTime: event.onTime,
          }),
        );

        await this.rebuildProfile(manager, event.shipperId);
        return true;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.debug(`DeliveryCompleted already projected for order ${event.orderId}`);
        return false;
      }
      throw error;
    }
  }

  async rebuild(shipperId: string): Promise<DeliveryEarningsProjectionSnapshot> {
    return this.eventRepository.manager.transaction((manager) =>
      this.rebuildProfile(manager, shipperId),
    );
  }

  async rebuildAll(): Promise<number> {
    const profiles = await this.profileRepository.find();
    for (const profile of profiles) {
      await this.rebuild(profile.userId);
    }
    return profiles.length;
  }

  private async rebuildProfile(
    manager: EntityManager,
    shipperId: string,
  ): Promise<DeliveryEarningsProjectionSnapshot> {
    const eventRepository = manager.getRepository(DeliveryEarningsEvent);
    const profileRepository = manager.getRepository(ShipperProfile);
    const entries = await eventRepository.find({ where: { shipperId } });
    const profile =
      (await profileRepository.findOne({
        where: { userId: shipperId },
        lock: { mode: 'pessimistic_write' },
      })) ?? profileRepository.create({ userId: shipperId });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    const dayOfWeek = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sum = (items: DeliveryEarningsEvent[]) =>
      items.reduce((total, entry) => total + Number(entry.earnings || 0), 0);
    const inPeriod = (from: Date) => entries.filter((entry) => entry.completedAt >= from);
    const durations = entries
      .map((entry) => entry.deliveryTimeMinutes)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const dailyEntries = inPeriod(startOfDay);
    const weeklyEntries = inPeriod(startOfWeek);
    const monthlyEntries = inPeriod(startOfMonth);

    profile.completedDeliveries = entries.length;
    profile.totalEarnings = sum(entries);
    profile.averageDeliveryTime = durations.length
      ? durations.reduce((total, value) => total + value, 0) / durations.length
      : 0;
    profile.onTimeDeliveries = entries.filter((entry) => entry.onTime === true).length;
    profile.lateDeliveries = entries.filter((entry) => entry.onTime === false).length;
    profile.dailyEarnings = sum(dailyEntries);
    profile.weeklyEarnings = sum(weeklyEntries);
    profile.monthlyEarnings = sum(monthlyEntries);
    await profileRepository.save(profile);

    return {
      shipperId,
      completedDeliveries: profile.completedDeliveries,
      totalEarnings: profile.totalEarnings,
      averageDeliveryTime: profile.averageDeliveryTime,
      onTimeDeliveries: profile.onTimeDeliveries,
      lateDeliveries: profile.lateDeliveries,
      dailyEarnings: profile.dailyEarnings,
      weeklyEarnings: profile.weeklyEarnings,
      monthlyEarnings: profile.monthlyEarnings,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23505',
    );
  }
}
