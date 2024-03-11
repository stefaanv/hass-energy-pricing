import { first, last } from '@bruyland/utilities'
import { QueryOrder, raw } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/mariadb'
import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MeteringResumeEntity } from '@src/metering/metering-resume.entity'
import { addSeconds, format } from 'date-fns'
import { PricingService } from './pricing.service'
import { CostDetail } from './cost-detail.model'
import { UnitPricesWithPeriod } from './unit-prices.model'
import { MeteringResume } from '@src/metering/metering-resume.model'

//TODO: berekening prijs piekvermogen nog toevoegen
//TODO: deze berekening gaat nog niet helemaal goed, nog nakijken !
@Injectable()
export class CostService {
  private readonly _log: LoggerService

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
    private readonly _pricingService: PricingService,
  ) {
    this._log = new Logger(CostService.name)
  }

  async costOn(day: Date, logFn: (msg: string) => void) {
    const em = this._em.fork()
    const qb = em.createQueryBuilder(MeteringResumeEntity, 'm')
    const mData = await qb
      .select('*')
      .where({ [raw('DATE(m.from)')]: format(day, 'yyyy-MM-dd') })
      .orderBy({ from: QueryOrder.ASC })
      .getResultList()
    if (mData.length === 0) return 0
    const from = first(mData)!.from
    const till = last(mData)!.till
    const pData = await this._pricingService.getUnitPricesSetForPeriod(from, till)
    const otherTotalUnitprice = first(pData)!.otherTotal

    //TODO: foutmelding geven als voor sommige meterwaarden geen prijs beschikbaar is
    const totals = this.sumCosts(mData, pData)
    //TODO klasse maken van CostCalc met methode voor toevoegen
    totals.consumption.unitPrice = (totals.consumption.price / totals.consumption.amount) * 100
    totals.injection.unitPrice = (totals.injection.price / totals.injection.amount) * 100
    return totals
  }

  sumCosts(mData: MeteringResume[], pData: UnitPricesWithPeriod[]) {
    const starter = new CostDetail()
    const sum = mData.reduce((accu, curr) => {
      const timestamp = addSeconds(curr.from, 10)
      let p = pData.find(p => p.from <= timestamp && p.till >= timestamp) as UnitPricesWithPeriod
      accu.add(
        curr.consumption,
        curr.injection,
        p.consumption ?? 0,
        p.injection ?? 0,
        p.otherTotal ?? 0,
      )
      return accu
    }, starter)
    sum.other.unitPrice = first(pData)?.otherTotal ?? 0
    return sum.round()
  }
}
