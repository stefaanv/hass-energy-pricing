import { Controller, Get } from '@nestjs/common'
import { MeteringService } from './hass/metering.service'

@Controller()
export class AppController {
  constructor(private readonly meteringService: MeteringService) {}

  @Get('resume')
  getResume() {
    return this.meteringService.resume
  }
}
