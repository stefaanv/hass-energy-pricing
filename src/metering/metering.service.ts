import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { Axios } from 'axios'
import { format } from 'date-fns'
import { EntityManager } from '@mikro-orm/mariadb'
import { Cron } from '@nestjs/schedule'
import { HassStateResponse } from '@src/hass/hass-state.model'
import { MeteringResumeEntity } from './metering.entity'
import { PricingService } from '@src/pricing/pricing.service'
import { MeteringSnapshotEntity } from './meter-snapshots.entity'
import { first, omit, tryit } from '@bruyland/utilities'
import { MeterValues, RequestableMeterValueKeys } from './meter-values.model'
import { UnitPrices } from '@src/pricing/unit-prices.model'
import { MeteringResume } from './metering-resume.model'
import { MonthPeak } from './month-peak.model'
import { roundTime15m, isQuarter } from './time.helpers'

type EntityTransTable = Record<RequestableMeterValueKeys, string>

@Injectable()
export class MeteringService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  startQuarterMeterValues = new MeterValues()
  private _lastGoodMeterValues!: MeterValues
  private readonly _entityNameTranslation: EntityTransTable
  monthPeakExceededFlagged = false
  resume = new MeteringResume(new MeterValues(), 'off-peak', 0, new Date()) // will be replaced immediately
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
      if (resume && snap) {
        this.resume = MeteringResume.fromEntity(resume as MeteringResume, snap as MeterValues)
        this._log.verbose!(`collected previous resume from ${format(resume.from, 'd/M @ HH:mm')}`)
      } else {
        // fallback when no resume found in the database
        this.resume = new MeteringResume(snap as MeterValues, 'peak', 0, snap.timestamp)
        this._log.warn(`Unable to retreive previous resume from database, using fallback`)
      }
    } else {
      const snap = new MeterValues()
      this.startQuarterMeterValues = snap
      this._lastGoodMeterValues = snap
      this.resume = new MeteringResume(snap, 'peak', 0, snap.timestamp)
      this._log.warn(`Unable to retreive meters snapshot from database, using fallback`)
    }
  }

  @Cron('*/10 * * * * *')
  async getMeasurements() {
    const em = this._em.fork()
    const meterValues = new MeterValues(new Date())

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
    }
    this.resume.update(meterValues, (msg: string) => this._log.log(msg))
    const tariff = 'peak' //TODO! nog berekenen !
    //TODO: prijzen cachen
    const prices = await this._pricingService.getUnitPricesSet(meterValues.timestamp)

    try {
      await em.upsert(
        MeteringResumeEntity,
        omit(this.resume, ['monthPeakExceeding', 'startQuarterValues']),
      )
      if (isQuarter(meterValues.timestamp)) {
        // 15min boundary
        await em.upsert(MeteringSnapshotEntity, omit(meterValues, ['exceedingPeak']))
        this.printMeteringResume(this.resume, prices)
      }
    } catch (error) {
      console.error(error)
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
