import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Order } from '../entities/order.entity';
import { OrderDetail } from '../entities/orderDetail.entity';
import { Checkout } from '../entities/checkout.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PaymentGatewayModule } from 'src/infra/payment-gateways/payment-gateway.module';
import { DemoPaymentController } from './demo-payment.controller';
import { OrderService } from 'src/modules/order/order.service';
import { User } from 'src/entities/user.entity';
import { Food } from 'src/entities/food.entity';
import { UsersService } from 'src/modules/users/users.service';
import { Promotion } from 'src/entities/promotion.entity';
import { PromotionService } from 'src/modules/promotion/promotion.service';
import { Role } from 'src/entities/role.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Address } from 'src/entities/address.entity';
import { QueueModule } from 'src/infra/queue/queue.module';
import { MapsModule } from 'src/infra/maps/maps.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { Review } from 'src/entities/review.entity';
import { Notification } from 'src/entities/notification.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { SystemConstraint } from 'src/entities/systemConstaints.entity';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { Topping } from 'src/entities/topping.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Order,SystemConstraint, Topping,
			 OrderDetail, Checkout, User,Food, Role, Promotion, Restaurant, Address, Promotion, Review, Notification, ShippingDetail]),
		ConfigModule,
		QueueModule,
		MapsModule,
		StorageModule,
		PaymentGatewayModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET'),
				signOptions: { expiresIn: '1d' },
			}),
			inject: [ConfigService],
		}),
	],
	controllers: [PaymentController, DemoPaymentController],
	providers: [PaymentService, PromotionService, OrderService, UsersService, PromotionService, SystemConstraintsService],
	exports: [PaymentService],
})
export class PaymentModule { } 
