import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from 'src/entities/conversation.entity';
import { Message } from 'src/entities/message.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { OrdersModule } from 'src/features/orders/public-api';
import { RestaurantsModule } from 'src/features/restaurants/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { MessengerController } from './messenger.controller';
import { MessengerResolver } from './messenger.resolver';
import { MessengerService } from './messenger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    AuthModule,
    IdentityModule,
    RestaurantsModule,
    OrdersModule,
    JwtModule,
  ],
  controllers: [MessengerController],
  providers: [MessengerService, MessengerResolver],
  exports: [MessengerService],
})
export class MessengerModule {}
