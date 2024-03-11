import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SpotResult } from './spot-result.model'
import axios from 'axios'
import { first, tryit } from '@bruyland/utilities'
import { addHours, differenceInHours, format, parseISO } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { EntityManager } from '@mikro-orm/mariadb'
import { IndexEntity } from './index-value/index-value.entity'
import { Cron } from '@nestjs/schedule'
import { UnitPrices, UnitPricesWithPeriod } from './unit-prices.model'
import { PriceFormulaEntity } from './formulas/price-formula.entity'
import { mapValues } from '@bruyland/utilities'
import { PriceIndexValue } from './index-value/index-value.model'
import { DualPriceFormulaSet } from './formulas/dual-price-formula-set.model'
import { SinglePriceFormula } from './formulas/single-price-formula.model'
import { Tariff } from '@src/metering/tariff.type'

// TODO: pricing cache vandaag+morgen voorzien (ophalen uit DB + berekening), foutmelding indien de cache niet opgevuld is

@Injectable()
export class PricingService {
  private readonly _log: LoggerService
  private readonly _peakHours: number[]
  private readonly _peakDays: number[]

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
  ) {
    this._log = new Logger(PricingService.name)
    // Wait 5 seconds to allow DB stuff to be handled in bootstrap()
    setTimeout(() => this.addIndexValuesToDb(), 2000)
    this._peakDays = this._config.get('peakPeriods.days', [1, 2, 3, 4, 5])
    const peakFrom = this._config.get('peakPeriods.hours.from', 6)
    const peakTill = this._config.get('peakPeriods.hours.till', 20)
    this._peakHours = Array.from({ length: peakTill - peakFrom + 1 }, (_, i) => peakFrom + i)
  }

  async getUnitPricesSet(time: Date): Promise<UnitPricesWithPeriod | undefined> {
    try {
      return first(await this.getUnitPricesSetForPeriod(time, time))
    } catch (error) {
      this._log.warn(`unable to ertreive price info for ${format(time, 'd/M HH:mm')} timestamp`)
    }
    return undefined
  }

  //TODO! - peak/off-peak berekening introduceren
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
      //TODO geval opvangen als er geen formule gevonden word
      const formula = formulaEntities.find(fe => fe.from <= iv.from && fe.till >= iv.till)!
      return { ...iv, ...this.priceDetailFromIndex(iv, formula) } as UnitPricesWithPeriod
    })
  }

  @Cron('0 10 14-18 * * *')
  async addIndexValuesToDb() {
    const prices = await this.getIndexData()
    const em = this._em.fork()
    const lastPriceInDb = await em.find(IndexEntity, {}, { orderBy: [{ till: -1 }], limit: 1 })
    const lastKnown = lastPriceInDb.length > 0 ? lastPriceInDb[0].till : new Date(1970)
    if (differenceInHours(lastKnown, new Date()) > 24) return // stop if more than 24h available

    this._log.log(`last known price ${format(lastKnown, 'd MMMM @ HH:mm')}`)
    if (!prices) return //spot website down

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
      this._log.error(`Unable to get SPOT data`)
      return
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

  tariffAt(timestamp = new Date()): Tariff {
    const dayOfWeek = timestamp.getDay()
    const hour = timestamp.getHours()
    return this._peakDays.includes(dayOfWeek) && this._peakHours.includes(hour)
      ? 'peak'
      : 'off-peak'
  }

  // TODO: volledige prijzformule peak of off-peak maken en beide eigen DB kolom steken
  priceDetailFromIndex(indexValue: PriceIndexValue, dualFormulaSet: DualPriceFormulaSet) {
    const tariff = this.tariffAt(indexValue.from)
    const index = indexValue.index
    const otherDetails = {
      ...dualFormulaSet.peak.otherDetails,
      ...dualFormulaSet['off-peak'].otherDetails,
    }
    const offPeakSet = { ...dualFormulaSet.peak, ...dualFormulaSet['off-peak'], otherDetails }
    const formulaSet = tariff === 'peak' ? dualFormulaSet.peak : offPeakSet
    const otherTotal = Object.values(formulaSet.otherDetails).reduce((accu, curr) => accu + curr, 0)
    const result = {
      tariff,
      from: indexValue.from,
      till: indexValue.till,
      index,
      consumption: round3d(priceCalcSingle(index, formulaSet.consumption)),
      injection: round3d(priceCalcSingle(index, formulaSet.injection)),
      otherTotal: round3d(otherTotal),
      otherDetails: mapValues(formulaSet.otherDetails, v => round3d(v)),
    } as UnitPrices
    return result
  }
}

function priceCalcSingle(index: number, formula: SinglePriceFormula): number {
  return formula.slope * index + (formula.intersect ?? 0)
}

function round3d(value: number) {
  return Math.round(1000 * value) / 1000
}
