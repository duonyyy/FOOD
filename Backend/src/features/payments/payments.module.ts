import { Module } from '@nestjs/common';
import { PaymentModule } from '../../payment/payment.module';

/** Compatibility shell for checkout and payment gateway lifecycle. */
@Module({ imports: [PaymentModule] })
export class PaymentsModule {}
