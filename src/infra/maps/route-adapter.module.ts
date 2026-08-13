import { Global, Module } from '@nestjs/common';
import { ROUTE_PORT } from '../contracts/route.port';
import { MapsModule } from './maps.module';
import { RoutePortAdapter } from './route-port.adapter';

@Global()
@Module({
  imports: [MapsModule],
  providers: [RoutePortAdapter, { provide: ROUTE_PORT, useExisting: RoutePortAdapter }],
  exports: [ROUTE_PORT],
})
export class RouteAdapterModule {}
