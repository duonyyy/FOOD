import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('system')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check Foodee API liveness' })
  @ApiResponse({ status: 200, description: 'API process is live' })
  getHealth() {
    return { status: 'ok', service: 'foodee-api' };
  }
}
