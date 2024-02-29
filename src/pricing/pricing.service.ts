import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataPoint, PriceDetail, SpotResult } from './spot-result.model'
import axios from 'axios'
import { tryit } from 'radash'
import { addHours, format, parseISO } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { listify } from '@bruyland/utilities'
import { EntityManager } from '@mikro-orm/mariadb'
import { PriceEntity } from './price.entity'
import { Cron } from '@nestjs/schedule'

@Injectable()
export class PricingService {
  private readonly _log: LoggerService

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
  ) {
    this._log = new Logger(PricingService.name)
    // Wait 5 seconds to allow DB stuff to be handled in bootstrap()
    setTimeout(() => this.addLatestPricesToDb(), 5000)
  }

  @Cron('0 10 14-18 * * *')
  async addLatestPricesToDb() {
    const prices = await this.getPricingData()
    const em = this._em.fork()
    const lastPriceInDb = await em.find(PriceEntity, {}, { orderBy: [{ till: -1 }], limit: 1 })
    const lastKnown = lastPriceInDb.length > 0 ? lastPriceInDb[0].till : new Date(1970)
    this._log.log(`last known price is from ${format(lastKnown, 'd MMMM @ HH:mm')}`)
    const newPrices = prices.filter(p => p.till > lastKnown)
    if (newPrices.length > 0) {
      await em.insertMany(PriceEntity, newPrices)
      this._log.log(`${newPrices.length} prices added`)
    }
  }

  async getPricingData(): Promise<PriceDetail[]> {
    // try get the index data from the internet + handle errors
    const belpexSpotConfig = this._config.get<object>('belpexSpot')
    const uri = axios.getUri(belpexSpotConfig)
    // const [error, rawSpotInfo] = await tryit((uri) => axios.get<SpotResult>(uri))(uri)
    const [error, rawSpotInfo] = await tryit(axios.get)<SpotResult>(uri)
    if (error) {
      console.log(error)
      debugger
    }

    // process the result
    //TODO dag/nacht regime nog oplossen
    return rawSpotInfo!.data.data.map(dp => this.indexToPrices(dp))
  }

  indexToPrices(detail: DataPoint) {
    const timeZone = this._config.get('timezone', 'Europe/Brussels')
    const otherPricingInfo = this._config.get<Record<string, number>>('pricing.andere', {})
    const consumptionFormula = this._config.get<(arg0: number) => number>('pricing.energie')
    const injectionFormula = this._config.get<(arg0: number) => number>('pricing.injectie')
    if (!consumptionFormula || !injectionFormula)
      throw new Error(`energie of injectie formule niet gedefinieerd`)
    const startTime = utcToZonedTime(parseISO(detail.st), timeZone)
    const endTime = addHours(startTime, 1)
    const index = parseFloat(detail.p)
    const andereTotaal = listify(otherPricingInfo, (k, v) =>
      k.startsWith('distributie') ? undefined : v,
    ).reduce((ac: number, v) => ac + (v ?? 0), 0)

    return {
      index,
      from: startTime,
      till: endTime,
      energie: consumptionFormula!(index),
      injectie: injectionFormula!(index),
      andereDetail: otherPricingInfo,
      andereTotaalDag: andereTotaal + otherPricingInfo['distributie-dag'],
      andereTotaalNacht: andereTotaal + otherPricingInfo['distributie-nacht'],
    } as PriceDetail
  }

  printPrice(pd: PriceDetail) {
    const dag = format(pd.from, 'd/MM')
    const start = format(pd.from, 'HH:mm')
    const end = format(pd.till, 'HH:mm')
    const cons = pd.energie.toFixed(1)
    const inj = pd.injectie.toFixed(1)
    const andereTot = pd.andereTotaalDag.toFixed(1)
    console.log(
      dag,
      start,
      `${start} -> ${end} : i=${pd.index.toFixed(1)}, e=${cons}, ad=${andereTot}, i=${inj}`,
    )
  }
}
