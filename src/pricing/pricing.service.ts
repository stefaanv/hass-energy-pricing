import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SpotResult } from './spot-result.model'
import axios from 'axios'
import { tryit } from '@bruyland/utilities'
import { addHours, format, parseISO } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { EntityManager } from '@mikro-orm/mariadb'
import { IndexEntity } from './price.entity'
import { Cron } from '@nestjs/schedule'
import {
  DualPriceFormulaSet,
  PriceFormulaSet,
  PriceIndexValue,
  SinglePriceFormula,
  UnitPrices,
  UnitPricesWithPeriod,
} from './price-calculation.model'
import { PriceFormulaEntity } from './price-formula.entity'
import { mapValues } from 'radash'

// TODO: alleen de index waarden opslaan
// TODO: berekeningsparameters in DB stoppen
// TODO: funtie maken die prijs onmiddellijk berekent (uit index opgehaald uit DB)

@Injectable()
export class PricingService {
  private readonly _log: LoggerService

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
  ) {
    this._log = new Logger(PricingService.name)
    // Wait 5 seconds to allow DB stuff to be handled in bootstrap()
    setTimeout(() => this.addIndexValuesToDb(), 2000)
  }

  async getUnitPricesSet(time: Date): Promise<UnitPricesWithPeriod> {
    const em = this._em.fork()
    const indexValue = (await em.findOne(
      IndexEntity,
      { from: { $lte: time } },
      { orderBy: [{ from: -1 }] },
    )) as PriceIndexValue
    const formulaEntity = await em.findOne(
      PriceFormulaEntity,
      { from: { $lte: time } },
      { orderBy: [{ from: -1 }] },
    )
    if (!formulaEntity?.peak) throw new Error(`Pricing formula not found in the database`)
    const peakFormula = formulaEntity?.peak as PriceFormulaSet
    return { ...indexValue, ...priceDetailFromIndex(indexValue, peakFormula) }
  }

  async getUnitPricesSetForPeriod(from: Date, till: Date) {
    const em = this._em.fork()
    const indexValues = await em.find(
      IndexEntity,
      { from: { $lte: till }, till: { $gte: from } },
      { orderBy: [{ from: 1 }] },
    )
    const formulaEntities = (await em.find(
      PriceFormulaEntity,
      { from: { $lte: till }, till: { $gte: from } },
      { orderBy: [{ from: 1 }] },
    )) as DualPriceFormulaSet[]
    return indexValues.map((iv: PriceIndexValue) => {
      //TODO geval opvangen als er geen formule gevonden wordt
      const formula = formulaEntities.find(fe => fe.from <= iv.from && fe.till >= iv.till)!.peak
      return { ...iv, ...priceDetailFromIndex(iv, formula) }
    })
  }

  @Cron('0 10 14-18 * * *')
  async addIndexValuesToDb() {
    const prices = await this.getIndexData()
    const em = this._em.fork()
    const lastPriceInDb = await em.find(IndexEntity, {}, { orderBy: [{ till: -1 }], limit: 1 })
    const lastKnown = lastPriceInDb.length > 0 ? lastPriceInDb[0].till : new Date(1970)
    this._log.log(`last known price is from ${format(lastKnown, 'd MMMM @ HH:mm')}`)
    const newPrices = prices.filter(p => p.till > lastKnown)
    if (newPrices.length > 0) {
      await em.insertMany(IndexEntity, newPrices)
      this._log.log(`${newPrices.length} prices added`)
    }
  }

  async getIndexData() {
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
    return rawSpotInfo!.data.data.map(dp => {
      const timeZone = this._config.get('timezone', 'Europe/Brussels')
      const startTime = utcToZonedTime(parseISO(dp.st), timeZone)
      return {
        from: startTime,
        till: addHours(startTime, 1),
        index: parseFloat(dp.p),
      } as PriceIndexValue
    })
  }

  // indexToPrices(detail: DataPoint) {
  //   const timeZone = this._config.get('timezone', 'Europe/Brussels')
  //   const otherPricingInfo = this._config.get<Record<string, number>>('pricing.andere', {})
  //   const consumptionFormula = this._config.get<(arg0: number) => number>('pricing.energie')
  //   const injectionFormula = this._config.get<(arg0: number) => number>('pricing.injectie')
  //   if (!consumptionFormula || !injectionFormula)
  //     throw new Error(`energie of injectie formule niet gedefinieerd`)
  //   const startTime = utcToZonedTime(parseISO(detail.st), timeZone)
  //   const endTime = addHours(startTime, 1)
  //   const index = parseFloat(detail.p)
  //   const andereTotaal = listify(otherPricingInfo, (k, v) =>
  //     k.startsWith('distributie') ? undefined : v,
  //   ).reduce((ac: number, v) => ac + (v ?? 0), 0)

  //   return {
  //     index,
  //     from: startTime,
  //     till: endTime,
  //     consumption: consumptionFormula!(index),
  //     injection: injectionFormula!(index),
  //     otherDetails: otherPricingInfo,
  //     otherTotalPeak: andereTotaal + otherPricingInfo['distributie-dag'],
  //     otherTotalOffPeak: andereTotaal + otherPricingInfo['distributie-nacht'],
  //   } as PriceDetail
  // }

  printPrice(pd: UnitPricesWithPeriod) {
    const dag = format(pd.from, 'd/MM')
    const start = format(pd.from, 'HH:mm')
    const end = format(pd.till, 'HH:mm')
    const cons = pd.consumption.toFixed(1)
    const inj = pd.injection.toFixed(1)
    const andereTot = pd.otherTotal.toFixed(1)
    console.log(
      `${dag} ${start} -> ${end} : i=${pd.index.toFixed(1)}, ` +
        `e=${cons}, ad=${andereTot}, i=${inj}`,
    )
  }
}

// TODO: volledige prijzformule peak of off-peak maken en beide eigen DB kolom steken
function priceDetailFromIndex(indexValue: PriceIndexValue, formulaSet: PriceFormulaSet) {
  const index = indexValue.index
  const otherTotal = Object.values(formulaSet.otherDetails).reduce((accu, curr) => accu + curr, 0)

  return {
    from: indexValue.from,
    till: indexValue.till,
    index,
    consumption: round3d(priceCalcSingle(index, formulaSet.consumption)),
    injection: round3d(priceCalcSingle(index, formulaSet.injection)),
    otherTotal: round3d(otherTotal),
    otherDetails: mapValues(formulaSet.otherDetails, v => round3d(v)),
  } as UnitPrices
}

function priceCalcSingle(index: number, formula: SinglePriceFormula): number {
  return formula.slope * index + (formula.intersect ?? 0)
}

function round3d(value: number) {
  return Math.round(1000 * value) / 1000
}
