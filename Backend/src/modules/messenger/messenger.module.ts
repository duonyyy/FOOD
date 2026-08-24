import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from 'src/entities/conversation.entity';
import { Message } from 'src/entities/message.entity';
import { Order } from 'src/entities/order.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { RestaurantsModule } from '../../features/restaurants/restaurants.module';
import { UsersModule } from '../users/users.module';
import { MessengerController } from './messenger.controller';
import { MessengerResolver } from './messenger.resolver';
import { MessengerService } from './messenger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User, Order, Restaurant, ShippingDetail]),
    UsersModule,
    RestaurantsModule,
    JwtModule,
  ],
  controllers: [MessengerController],
  providers: [MessengerService, MessengerResolver],
  exports: [MessengerService],
})
export class MessengerModule {}
