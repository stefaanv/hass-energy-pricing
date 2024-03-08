import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { Axios } from 'axios'
import { differenceInMinutes, format } from 'date-fns'
import { EntityManager } from '@mikro-orm/mariadb'
import { Cron } from '@nestjs/schedule'
import { HassStateResponse } from './hass-state.model'
import { MeteringEntity } from './metering.entity'
import { PricingService } from '@src/pricing/pricing.service'
import { MeteringSnapshotEntity } from './meter-snapshots.entity'
import { first, tryit } from '@bruyland/utilities'
import { MeterValues, RequestableMeterValueKeys } from './meter-values.model'
import { UnitPrices } from '@src/pricing/unit-prices.model'
import { MeteringResume } from './metering-resume.model'

@Injectable()
export class MeteringService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  startQuarterMeterValues = new MeterValues()
  private _lastGoodMeterValues!: MeterValues
  private readonly _entityNameTranslation: Record<RequestableMeterValueKeys, string>
  monthPeakExceededFlagged = false

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
    private readonly _pricingService: PricingService,
  ) {
    this._log = new Logger(MeteringService.name)
    const baseURL = this._config.get('homeAssistant.baseUrl')
    if (!baseURL) throw new Error('HomeAssitant host not known')
    const bearer = this._config.get('homeAssistant.bearerToken')
    if (!bearer) throw new Error('HomeAssitant auth bearer token not known')
    const tTrans = this._config.get<Record<RequestableMeterValueKeys, string>>(
      'homeAssistant.entityNames',
    )
    if (!tTrans) throw new Error('HomeAssitant entity tranlation table not found')
    this._entityNameTranslation = tTrans

    this._axios = axios.create({
      baseURL,
      timeout: 1000,
      headers: {
        Accept: 'Application/json',
        Authorization: `Bearer ${bearer}`,
      },
    })
    this.getLastSnapshot()
  }

  async getLastSnapshot() {
    const snaps = await this._em
      .fork()
      .find(MeteringSnapshotEntity, {}, { orderBy: { timestamp: 'desc' }, limit: 1 })
    const snap = first(snaps)
    if (!snap) return
    const age = differenceInMinutes(new Date(), snap.timestamp)
    this.startQuarterMeterValues = new MeterValues(snap)
    this._lastGoodMeterValues = new MeterValues(snap)
    this._log.log(`retreived metering snapshot timestamped ${format(snap.timestamp, 'HH:mm')}`)
  }

  @Cron('*/10 * * * * *')
  async getMeasurements() {
    const now = roundTime(new Date())
    const meterValues = new MeterValues()
    const em = this._em.fork()

    // get all requestable values from Home Assistant
    for (const key of Object.keys(this._entityNameTranslation) as RequestableMeterValueKeys[]) {
      const [error, value] = await tryit(() => this.getHassNumericState(key))()
      if (error) {
        this._log.error(error.message)
        meterValues[key] = this.startQuarterMeterValues?.[key] ?? 0
      } else {
        meterValues[key] = value
      }
      // update the monthly consumption peak if exceeded
      if (meterValues.consTotal > meterValues.monthPeakValue) {
        if (!this.monthPeakExceededFlagged)
          this._log.log(`monthly consumption peak is being exceeded`)
        meterValues.monthPeakValue = meterValues.consTotal
        meterValues.monthPeakTime = this.startQuarterMeterValues?.timestamp ?? new Date()
        this.monthPeakExceededFlagged = true
      }
    }

    if (isQuarter(now)) {
      // 15min boundary
      const prices = await this._pricingService.getUnitPricesSet(meterValues.timestamp)
      const resume = meterValues.makeResume(this.startQuarterMeterValues)

      try {
        await em.upsert(MeteringEntity, resume)
        if (isQuarter(now)) {
          try {
            await em.upsert(MeteringSnapshotEntity, meterValues)
          } catch (err2) {
            debugger
          }
          this.printMeteringResume(resume, prices)
          this.startQuarterMeterValues = meterValues
        } else {
        }
      } catch (error) {
        console.error(error)
      }
      this.monthPeakExceededFlagged = false
    }
  }

  async getHassNumericState(entityId: RequestableMeterValueKeys): Promise<number> {
    const hassEntityKey = this._entityNameTranslation[entityId]
    const rlkv = `returning last known value`
    //TODO entityId en duidelijke foutmelding als warning geven, undefined teruggeven
    const lastGood = this._lastGoodMeterValues[entityId] ?? 0
    const [error1, raw] = await tryit(this._axios.get)<HassStateResponse>(`states/${hassEntityKey}`)
    if (error1) {
      this._log.error(`Unable to get counter value ${entityId}: ${error1.message}`)
      return lastGood
    }

    const state = raw.data?.state
    if (!state) {
      const msg = `HASS returned unexpected ${entityId} ${JSON.stringify(raw)}, ${rlkv}`
      this._log.error(msg)
      return lastGood
    }

    if (state == 'unavailable') return lastGood // no error message in these cases - happens quite often

    const [error2, parsed] = tryit(() => parseFloat(state))()
    if (error2 || isNaN(parsed)) {
      const msg = `state values "${state}" for entity "${entityId}" can't be parsed, ${rlkv}`
      this._log.error(msg)
      return lastGood
    }
    return parsed
  }

  printMeteringResume(resume: MeteringResume, prices: UnitPrices | undefined) {
    const consTotalPrice = prices ? prices.consumption + prices.otherTotal : undefined
    const header = `${format(resume.from, 'HH:mm')} -> ${format(resume.till, 'HH:mm')} `
    const consumption = printSingle(resume.consumption, 'cons', consTotalPrice)
    const injection = printSingle(resume.injection, 'inj', prices?.injection)
    const charge = printSingle(resume.batCharge, 'batCh')
    const disCharge = printSingle(resume.batDischarge, 'batDis')

    this._log.log(header + [consumption, injection, charge, disCharge, prices?.tariff].join(', '))
  }
}

function printSingle(value: number, name: string, price?: number) {
  if (value < 0.001) return ''
  return `${name} ${(value * 1000).toFixed(0)}Wh ` + (price ? `@ ${price.toFixed(1)}c€/kWh, ` : '')
}

function getPeriod(date = new Date()): Date[] {
  const minutes = date.getMinutes()
  const minStart = minutes - (minutes % 15)
  const minEnd = minStart + 15
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMOnth = date.getDate()
  const hours = date.getHours()
  return [
    new Date(year, month, dayOfMOnth, hours, minStart, 0),
    new Date(year, month, dayOfMOnth, hours, minEnd, 0),
  ]
}

function roundTime(date = new Date()): Date {
  const seconds = Math.round(date.getSeconds() / 5) * 5
  const minutes = date.getMinutes()
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMOnth = date.getDate()
  const hours = date.getHours()
  return new Date(year, month, dayOfMOnth, hours, minutes, seconds)
}

function isQuarter(date = new Date()): boolean {
  return date.getMinutes() % 15 === 0 && date.getSeconds() === 0
}
