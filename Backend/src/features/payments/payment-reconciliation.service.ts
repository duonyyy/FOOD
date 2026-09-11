import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PaymentService, type PaymentReconciliationResult } from './payment.service';

export interface PaymentReconciliationSummary {
  scanned: number;
  attempted: number;
  reconciled: number;
  mismatches: number;
  stillPending: number;
  failed: number;
  skipped: number;
}

/**
 * Periodically repairs a provider-success/internal-pending gap without
 * putting provider I/O inside the checkout transaction.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @InjectRepository(Checkout)
    private readonly checkoutRepository: Repository<Checkout>,
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileScheduledPayments(): Promise<void> {
    try {
      await this.reconcilePendingPayments();
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'payment_reconciliation_job_failed',
          error: this.errorMessage(error),
        }),
      );
    }
  }

  async reconcilePendingPayments(): Promise<PaymentReconciliationSummary> {
    const maxAttempts = this.maxAttempts;
    const cutoff = new Date(Date.now() - this.staleAfterMinutes * 60_000);
    const candidates = await this.checkoutRepository.find({
      where: {
        status: CheckoutStatus.PENDING,
        updatedAt: LessThanOrEqual(cutoff),
      },
      order: { updatedAt: 'ASC' },
      take: this.batchSize,
    });
    const summary: PaymentReconciliationSummary = {
      scanned: candidates.length,
      attempted: 0,
      reconciled: 0,
      mismatches: 0,
      stillPending: 0,
      failed: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      if (!candidate.paymentIntentId) {
        summary.skipped += 1;
        continue;
      }

      const claimed = await this.claim(candidate.id, cutoff, maxAttempts);
      if (!claimed) {
        summary.skipped += 1;
        continue;
      }
      summary.attempted += 1;

      try {
        const result = await this.paymentService.reconcilePendingCheckout(claimed.id);
        await this.recordResult(claimed.id, result);
        this.updateSummary(summary, result);
        this.logger.log(
          JSON.stringify({
            event: 'payment_reconciliation_result',
            checkoutId: claimed.id,
            paymentIntentId: claimed.paymentIntentId,
            attempt: claimed.reconciliationAttempts,
            maxAttempts,
            result: result.status,
            reason: 'reason' in result ? result.reason : undefined,
          }),
        );
      } catch (error) {
        summary.failed += 1;
        await this.checkoutRepository.update(claimed.id, {
          reconciliationLastError: this.errorMessage(error),
        });
        this.logger.error(
          JSON.stringify({
            event: 'payment_reconciliation_attempt_failed',
            checkoutId: claimed.id,
            paymentIntentId: claimed.paymentIntentId,
            attempt: claimed.reconciliationAttempts,
            maxAttempts,
            error: this.errorMessage(error),
          }),
        );
      }
    }

    this.logger.log(JSON.stringify({ event: 'payment_reconciliation_summary', ...summary }));
    return summary;
  }

  private async claim(
    checkoutId: string,
    cutoff: Date,
    maxAttempts: number,
  ): Promise<Checkout | null> {
    return this.checkoutRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Checkout);
      const checkout = await repository.findOne({
        where: { id: checkoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!checkout || checkout.status !== CheckoutStatus.PENDING || !checkout.paymentIntentId) {
        return null;
      }
      if (checkout.updatedAt && checkout.updatedAt > cutoff) return null;

      const attempts = Number(checkout.reconciliationAttempts || 0);
      if (attempts >= maxAttempts) {
        this.logger.warn(
          JSON.stringify({
            event: 'payment_reconciliation_exhausted',
            checkoutId: checkout.id,
            paymentIntentId: checkout.paymentIntentId,
            attempts,
            maxAttempts,
          }),
        );
        return null;
      }

      checkout.reconciliationAttempts = attempts + 1;
      checkout.reconciliationLastAttemptAt = new Date();
      checkout.reconciliationLastError = null;
      return repository.save(checkout);
    });
  }

  private async recordResult(
    checkoutId: string,
    result: PaymentReconciliationResult,
  ): Promise<void> {
    const lastError =
      result.status === 'mismatch'
        ? result.reason
        : result.status === 'still_pending'
          ? `provider_status:${result.providerStatus}`
          : null;
    await this.checkoutRepository.update(checkoutId, { reconciliationLastError: lastError });
  }

  private updateSummary(
    summary: PaymentReconciliationSummary,
    result: PaymentReconciliationResult,
  ): void {
    if (result.status === 'reconciled' || result.status === 'already_completed') {
      summary.reconciled += 1;
    } else if (result.status === 'mismatch') {
      summary.mismatches += 1;
    } else if (result.status === 'still_pending') {
      summary.stillPending += 1;
    } else {
      summary.skipped += 1;
    }
  }

  private get maxAttempts(): number {
    return this.positiveInteger('PAYMENT_RECONCILIATION_MAX_ATTEMPTS', 3);
  }

  private get batchSize(): number {
    return this.positiveInteger('PAYMENT_RECONCILIATION_BATCH_SIZE', 50);
  }

  private get staleAfterMinutes(): number {
    return this.positiveInteger('PAYMENT_RECONCILIATION_STALE_AFTER_MINUTES', 10);
  }

  private positiveInteger(name: string, fallback: number): number {
    const configured = Number(this.configService.get<string | number>(name, fallback));
    return Number.isInteger(configured) && configured > 0 ? configured : fallback;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
