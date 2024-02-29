import { Injectable, Logger, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { Axios } from 'axios'
import { tryit } from 'radash'
import { addHours, format, parseISO } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { listify, mapValues } from '@bruyland/utilities'
import { EntityManager } from '@mikro-orm/mariadb'
import { Cron } from '@nestjs/schedule'
import { HassStateResponse } from './hass-state.model'

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
export class EnergyService {
  private readonly _log: LoggerService
  private readonly _axios: Axios
  lastMeterValues?: MeterValues = undefined

  constructor(
    private readonly _config: ConfigService,
    private readonly _em: EntityManager,
  ) {
    this._log = new Logger(EnergyService.name)
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
    const meterValues = this.getMeasurements()
  }

  @Cron('0 * * * * *')
  // @Cron('0 */15 * * * *')
  async getMeasurements() {
    const meterValues = {} as MeterValues
    meterValues.timestamp = new Date()
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
    if (this.lastMeterValues) {
      const resume = this.makeResume(meterValues, this.lastMeterValues)
      this.printMeteringResume(resume)
      //TODO metingen opslaan in DB !
    }
    this.lastMeterValues = meterValues
  }

  async getHassNumericState(entityId: string) {
    const [error1, raw] = await tryit(this._axios.get)<HassStateResponse>(`states/${entityId}`)
    if (error1) throw new Error(`Unable to get counter value ${entityId}: ${error1.message}`)

    const [error2, parsed] = tryit(parseFloat)(raw?.data.state ?? '0')
    if (error2) throw new Error(`Unable to parse ${raw?.data.state}: ${error2.message}`)

    return parsed
  }

  printMeteringResume(r: MeteringResume) {
    const msg =
      `metering ${format(r.from, 'hh:mm')} -> ${format(r.till, 'hh:mm')}  ` +
      `c ${(r.consumption * 1000).toFixed(1)}Wh, i ${(r.injection * 1000).toFixed(1)}Wh, ` +
      `bCh ${(r.batCharge * 1000).toFixed(1)}Wh, bDis ${(r.batDischarge * 1000).toFixed(1)}Wh, ` +
      `gas ${r.gas.toFixed(1)}, ${r.tariff}`
    this._log.verbose!(msg)
  }

  makeResume(till: MeterValues, from: MeterValues): MeteringResume {
    return {
      from: from.timestamp,
      till: till.timestamp,
      tariff:
        till.consOffPeak - from.consOffPeak > till.consPeak - from.consPeak ? 'off-peak' : 'peak',
      consumption: till.consOffPeak + till.consPeak - (from.consOffPeak + from.consPeak),
      injection: till.injOffPeak + till.injPeak - (from.injOffPeak + from.injPeak),
      batCharge: till.batCharge - from.batCharge,
      batDischarge: till.batDischarge - from.batDischarge,
      gas: till.gas - from.gas,
    }
  }
}
