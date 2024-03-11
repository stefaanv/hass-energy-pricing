import { Controller, Get, Logger, LoggerService } from '@nestjs/common'
import { MeteringService } from '@src/metering/metering.service'
import { CostService } from './pricing/cost.service'

@Controller()
export class AppController {
  private readonly _log: LoggerService

  constructor(
    private readonly meteringService: MeteringService,
    private readonly costService: CostService,
  ) {
    this._log = new Logger(AppController.name)
  }

  @Get('resume')
  getResume() {
    return this.meteringService.resume
  }

  @Get('cost-today')
  getTodayCost() {
    return this.costService.costOn(new Date(), (msg: string) => this._log.warn(msg))
  }
}
