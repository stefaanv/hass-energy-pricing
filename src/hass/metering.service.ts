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
import { MeteringResume, MeterValues } from './meter-values.model'
import { UnitPrices, UnitPricesWithPeriod } from '@src/pricing/price-calculation.model'

type MeterValueKey = keyof Omit<MeterValues, 'timestamp'>
const ENERGY_ENTITIES: Record<MeterValueKey, string> = {
  consPeak: 'sensor.energy_consumed_tariff_1',
  consOffPeak: 'sensor.energy_consumed_tariff_2',
  injPeak: 'sensor.energy_produced_tariff_1',
  injOffPeak: 'sensor.energy_produced_tariff_2',
  batCharge: 'sensor.battery_total_charge',
  batDischarge: 'sensor.battery_total_discharge',
  gas: 'sensor.gas_consumed_belgium',
  batSOC: 'sensor.battery_state_of_capacity',
}

@Injectable()
export class MeteringService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  startQuarterMeterValues?: MeterValues = undefined
  private _lastGoodMeterValues!: MeterValues
  prices?: UnitPricesWithPeriod = undefined

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
    this.startQuarterMeterValues = { ...snap }
    this._lastGoodMeterValues = { ...snap }
    this._log.log(`retreived metering snapshot timestamped ${format(snap.timestamp, 'HH:mm')}`)
  }

  @Cron('*/10 * * * * *')
  async getMeasurements() {
    const now = roundTime(new Date())
    const meterValues = {} as MeterValues
    meterValues.timestamp = now
    const em = this._em.fork()

    for (const [key, _] of Object.entries(ENERGY_ENTITIES) as [MeterValueKey, string][]) {
      const [error, value] = await tryit(() => this.getHassNumericState(key))()
      if (error) {
        this._log.error(error.message)
        meterValues[key] = this.startQuarterMeterValues?.[key] ?? 0
      } else {
        meterValues[key] = value
      }
    }
    const [from, till] = getPeriod()
    if (this.startQuarterMeterValues) {
      if (!this.prices || this.prices.till <= now)
        this.prices = await this._pricingService.getUnitPricesSet(meterValues.timestamp)
      const resume = await makeResume(
        meterValues,
        this.startQuarterMeterValues,
        this.prices,
        (msg: string) => this._log.error(msg),
      )

      try {
        //TODO bemerk in tabel - periode loopt maar over enkele seconden !
        await em.upsert(MeteringEntity, resume)
        if (isQuarter(now)) {
          // console.log(
          //   `Saved to metering tabel : from=${format(resume.from, 'HH:mm')}, cons=${resume.consumption}` +
          //     `, batsCh=${resume.batCharge}, batDisCh=${resume.batDischarge}`,
          // )
          try {
            await em.upsert(MeteringSnapshotEntity, meterValues)
          } catch (err2) {
            debugger
          }
          printMeteringResume(resume, this.prices, (msg: string) => this._log.log(msg))
          this.startQuarterMeterValues = meterValues
        } else {
        }
      } catch (error) {
        console.error(error)
      }
    }
  }

  async getHassNumericState(entityId: MeterValueKey): Promise<number> {
    const hassEntityKey = ENERGY_ENTITIES[entityId]
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
}

function printMeteringResume(r: MeteringResume, p: UnitPrices, logFn: (msg: string) => void) {
  // const andere = r.tariff === 'peak' ? p.otherTotalPeak : p.otherTotalOffPeak
  const totaal = 0 //andere + p.consumption
  const msg =
    `metering ${format(r.from, 'HH:mm')} -> ${format(r.till, 'HH:mm')}  ` +
    `cons ${(r.consumption * 1000).toFixed(0)}Wh @ ${totaal.toFixed(1)}c€/kWh, ` +
    (r.injection > 0.001
      ? `inj ${(r.injection * 1000).toFixed(0)}Wh @ ${p.injection.toFixed(1)}c€/kWh, `
      : '') +
    (r.batCharge > 0.001 || r.batDischarge > 0.001
      ? `batCh ${(r.batCharge * 1000).toFixed(0)}Wh, batDis ${(r.batDischarge * 1000).toFixed(0)}Wh, `
      : '')
  logFn(msg)
}

async function makeResume(
  till: MeterValues,
  from: MeterValues,
  prices: UnitPrices,
  errLogFn: (msg: string) => void,
) {
  const consDiff = till.consOffPeak + till.consPeak - (from.consOffPeak + from.consPeak)
  const consumption = Math.max(0, consDiff)
  const injDiff = till.injOffPeak + till.injPeak - (from.injOffPeak + from.injPeak)
  const injection = Math.max(0, injDiff)
  //TODO! zelfde als vorige nemen indien beide nul + 's nachts zo-bij-zo off-paek
  const tariff =
    till.consOffPeak - from.consOffPeak > till.consPeak - from.consPeak ? 'off-peak' : 'peak'
  let [costElec, costGas, yieldElec] = [0, 0, 0]
  if (prices) {
    const priceElecOther = 0 //tariff == 'peak' ? prices.otherTotalPeak : prices.otherTotalOffPeak
    costElec = (prices.consumption + priceElecOther) * consumption
    costGas = 0 * (till.gas - from.gas) //TODO! gasprijs
    yieldElec = prices.injection * injection
  }
  let batCharge = till.batCharge - from.batCharge
  let batDischarge = till.batDischarge - from.batDischarge
  if (isNaN(batCharge)) {
    batCharge = 0
    errLogFn(`batCharge is NaN`)
  }
  if (isNaN(batDischarge)) {
    batDischarge = 0
    errLogFn(`batDischarge is NaN`)
  }
  return {
    from: from.timestamp,
    till: till.timestamp,
    tariff,
    consumption,
    injection,
    batCharge,
    batDischarge,
    gas: till.gas - from.gas,
  } as MeteringResume
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
