import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { Axios } from 'axios'
import { tryit } from 'radash'
import { format } from 'date-fns'
import { EntityManager } from '@mikro-orm/mariadb'
import { Cron } from '@nestjs/schedule'
import { HassStateResponse } from './hass-state.model'
import { MeteringEntity } from './metering.entity'
import { PricingService } from '@src/pricing/pricing.service'
import { PriceDetail } from '@src/pricing/spot-result.model'

type MeterValueKey = keyof Omit<MeterValues, 'timestamp'>
const ENERGY_ENTITIES: Record<MeterValueKey, string> = {
  consPeak: 'sensor.energy_consumed_tariff_1',
  consOffPeak: 'sensor.energy_consumed_tariff_2',
  injPeak: 'sensor.energy_produced_tariff_1',
  injOffPeak: 'sensor.energy_produced_tariff_2',
  batCharge: 'sensor.battery_total_charge',
  batDischarge: 'sensor.battery_total_discharge',
  gas: 'sensor.gas_consumed_belgium',
}

@Injectable()
export class MeteringService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  lastMeterValues?: MeterValues = undefined

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
  }

  @Cron('*/10 * * * * *')
  async getMeasurements() {
    const now = new Date()
    const meterValues = {} as MeterValues
    meterValues.timestamp = now

    const baseURL = this._config.get('homeAssistant.baseUrl')
    for (const [key, entityId] of Object.entries(ENERGY_ENTITIES) as [MeterValueKey, string][]) {
      const [error, value] = await tryit(() => this.getHassNumericState(entityId))()
      if (error) {
        this._log.error(error.message)
        meterValues[key] = this.lastMeterValues?.[key] ?? 0
      } else {
        meterValues[key] = value
      }
    }
    const [from, till] = this.getPeriod()
    if (this.lastMeterValues && this.isQuarter(now)) {
      const prices = await this._pricingService.getPrices(meterValues.timestamp)
      const resume = await this.makeResume(meterValues, this.lastMeterValues, prices)

      this.printMeteringResume(resume, prices)
      await this._em.fork().upsert(MeteringEntity, resume)
    }
    if (this.isQuarter(now)) {
      this._log.verbose!(`starting a new metering period at ${format(now, 'HH:mm')}`)
      this.lastMeterValues = meterValues
    }
  }

  async getHassNumericState(entityId: string) {
    const [error1, raw] = await tryit(this._axios.get)<HassStateResponse>(`states/${entityId}`)
    if (error1) throw new Error(`Unable to get counter value ${entityId}: ${error1.message}`)

    const [error2, parsed] = tryit(parseFloat)(raw?.data.state ?? '0')
    if (error2) throw new Error(`Unable to parse ${raw?.data.state}: ${error2.message}`)

    return parsed
  }

  printMeteringResume(r: MeteringResume, p: PriceDetail) {
    const andere = r.tariff === 'peak' ? p.otherTotalPeak : p.otherTotalOffPeak
    const totaal = andere + p.consumption
    const msg =
      `metering ${format(r.from, 'HH:mm')} -> ${format(r.till, 'HH:mm')}  ` +
      `cons ${(r.consumption * 1000).toFixed(0)}Wh @ ${totaal.toFixed(1)}c€/kWh, ` +
      (r.injection > 0
        ? `inj ${(r.injection * 1000).toFixed(0)}Wh,  @ ${p.injection.toFixed(1)}c€/kWh, `
        : '') +
      (r.batCharge > 0 || r.batDischarge > 0
        ? `bCh ${(r.batCharge * 1000).toFixed(0)}Wh, bDis ${(r.batDischarge * 1000).toFixed(0)}Wh, `
        : '') +
      +(r.gas > 0 ? `gas ${r.gas.toFixed(0)}, ${r.tariff}` : '')
  }

  async makeResume(till: MeterValues, from: MeterValues, prices: PriceDetail) {
    const consumption = till.consOffPeak + till.consPeak - (from.consOffPeak + from.consPeak)
    const injection = till.injOffPeak + till.injPeak - (from.injOffPeak + from.injPeak)
    const tariff =
      till.consOffPeak - from.consOffPeak > till.consPeak - from.consPeak ? 'off-peak' : 'peak'
    let [costElec, costGas, yieldElec] = [0, 0, 0]
    if (prices) {
      const priceElekOther = tariff == 'peak' ? prices.otherTotalPeak : prices.otherTotalOffPeak
      costElec = (prices.consumption + priceElekOther) * consumption
      costGas = 0 * (till.gas - from.gas) //TODO! gasprijs
      yieldElec = prices.injection * injection
    }
    return {
      from: from.timestamp,
      till: till.timestamp,
      tariff,
      consumption,
      injection,
      batCharge: till.batCharge - from.batCharge,
      batDischarge: till.batDischarge - from.batDischarge,
      gas: till.gas - from.gas,
    } as MeteringResume
  }

  getPeriod(date = new Date()): Date[] {
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

  isQuarter(date = new Date()): boolean {
    return date.getMinutes() % 15 === 0 && date.getSeconds() === 0
  }
}
