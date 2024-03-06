import { first, last } from '@bruyland/utilities'
import { QueryOrder, raw } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/mariadb'
import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MeteringEntity } from '@src/hass/metering.entity'
import { format } from 'date-fns'
import { costStarter } from './cost-detail.model'
import { PricingService } from './pricing.service'
import { CostDetail } from './cost-detail.model'
import { UnitPricesWithPeriod } from './unit-prices.model'

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

  async costOn(day: Date) {
    const em = this._em.fork()
    const qb = em.createQueryBuilder(MeteringEntity, 'm')
    const mData = await qb
      .select('*')
      .where({ [raw('DATE(m.from)')]: format(day, 'yyyy-MM-dd') })
      .orderBy({ from: QueryOrder.ASC })
      .getResultList()
    if (mData.length === 0) return 0
    const from = first(mData)!.from
    const till = last(mData)!.till
    const pData = await this._pricingService.getUnitPricesSetForPeriod(from, till)
    const otherTotalUP = first(pData)!.otherTotal
    const totals = mData.reduce((accu, curr) => {
      const p = pData.find(p => p.from <= curr.from && p.till >= curr.till)! as UnitPricesWithPeriod
      return {
        consumption: {
          amount: accu.consumption.amount + curr.consumption,
          price: accu.consumption.price + p.consumption * curr.consumption,
        },
        injection: {
          amount: accu.injection.amount + curr.injection,
          price: accu.injection.price + p.injection * curr.injection,
        },
        other: {
          amount: accu.other.amount + curr.consumption,
          price: accu.other.price + otherTotalUP * curr.consumption,
        },
      } as CostDetail
    }, costStarter(otherTotalUP))
    //TODO! unit price other nakijken, is factor 100 te klein
    //TODO klasse maken van CostCalc met methode voor toevoegen
    totals.consumption.unitPrice = totals.consumption.price / totals.consumption.amount
    totals.injection.unitPrice = totals.injection.price / totals.injection.amount
    return totals
  }
}
