import { ApiContract } from './config/api-docs';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiContract('app.getHello')
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
