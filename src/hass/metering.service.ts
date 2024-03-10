import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { Axios } from 'axios'
import { differenceInMinutes, format } from 'date-fns'
import { EntityManager } from '@mikro-orm/mariadb'
import { Cron } from '@nestjs/schedule'
import { HassStateResponse } from './hass-state.model'
import { MeteringResumeEntity } from './metering.entity'
import { PricingService } from '@src/pricing/pricing.service'
import { MeteringSnapshotEntity } from './meter-snapshots.entity'
import { first, omit, tryit } from '@bruyland/utilities'
import { MeterValues, RequestableMeterValueKeys } from './meter-values.model'
import { UnitPrices } from '@src/pricing/unit-prices.model'
import { emptyResume, MeteringResume } from './metering-resume.model'
import { MonthPeak } from './month-peak.model'

type EntityTransTable = Record<RequestableMeterValueKeys, string>

@Injectable()
export class MeteringService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  startQuarterMeterValues = new MeterValues()
  private _lastGoodMeterValues!: MeterValues
  private readonly _entityNameTranslation: EntityTransTable
  monthPeakExceededFlagged = false
  resume = emptyResume
  private _peak = new MonthPeak(new Date(), 0)

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
    const tTrans = this._config.get<EntityTransTable>('homeAssistant.entityNames')
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
    const em = this._em.fork()
    const wClause = (field: string) => ({ orderBy: { [field]: 'desc' }, limit: 1 })
    const snap = first(await em.find(MeteringSnapshotEntity, {}, wClause('timestamp')))
    const resume = first(await em.find(MeteringResumeEntity, {}, wClause('from')))
    if (snap) {
      this.startQuarterMeterValues = new MeterValues(snap)
      this._lastGoodMeterValues = new MeterValues(snap)
    }
    if (resume) {
      this._peak = new MonthPeak(resume.monthPeakTime ?? new Date(), resume.monthPeakValue)
      this.resume = resume
      console.log(`collected previous resume`)
      // console.log(this.resume)
    }
    this._log.log(`retreived previous metering data`)
  }

  @Cron('*/10 * * * * *')
  async getMeasurements() {
    const now = roundTime(new Date())
    const meterValues = new MeterValues()
    const em = this._em.fork()

    // get all requestable values from Home Assistant
    let errorLogged = false
    for (const key of Object.keys(this._entityNameTranslation) as RequestableMeterValueKeys[]) {
      const [error, value] = await tryit(() => this.getHassNumericState(key))()
      if (error) {
        if (!errorLogged) {
          this._log.error(error.message)
          errorLogged = true
        }
        meterValues[key] = this.startQuarterMeterValues?.[key] ?? 0
      } else {
        meterValues[key] = value
      }
      // update the monthly consumption peak if exceeded
      if (meterValues.consTotal > this.resume.monthPeakValue) {
        //TODO! hiervoor de MonthlyPeak klasse gebruiken
        if (!this.monthPeakExceededFlagged)
          this._log.log(`monthly consumption peak is being exceeded`)
        this.resume.monthPeakValue = meterValues.consTotal
        this.resume.monthPeakTime = this.startQuarterMeterValues?.timestamp ?? new Date()
        this.monthPeakExceededFlagged = true
      }
    }

    //TODO: prijzen cachen
    const prices = await this._pricingService.getUnitPricesSet(meterValues.timestamp)
    //TODO! Berekeningen nog eens nakijken
    //TODO nakijken of laatste piek waarde goed opgeladen wordt uit de DB
    // TODO! berekening van peak/off-peak volledige nakijken
    //TODO waar wordt de piek gereset in het begin v/d maand ?
    this.resume = meterValues.updateResume(this.startQuarterMeterValues, this._peak)

    try {
      //TODO piek waarden nog toevoegen
      this.resume.monthPeakTime = this._peak.time
      this.resume.monthPeakValue = this._peak.value
      await em.upsert(MeteringResumeEntity, this.resume)
      if (isQuarter(now)) {
        // 15min boundary
        await em.upsert(MeteringSnapshotEntity, omit(meterValues, ['exceedingPeak']))
        this.printMeteringResume(this.resume, prices)
        this.startQuarterMeterValues = meterValues
      }
    } catch (error) {
      console.error(error)
    }
    this.monthPeakExceededFlagged = false
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
