import { isDate } from 'radash'
import { roundTime15m, roundTime5s } from './time.helpers'
import { isObject } from '@bruyland/utilities'

export interface IMeterValues {
  timestamp: Date
  consPeak: number
  consOffPeak: number
  injPeak: number
  injOffPeak: number
  batCharge: number
  batDischarge: number
  gas: number
  batSOC: number
}

export const calculatedMeterValueKeys = [
  'timestamp',
  'monthPeak',
  'exceedingPeak',
  'consTotal',
  'injTotal',
] as const
export type CalculatedMeterValues = (typeof calculatedMeterValueKeys)[number]
export const requestableMeterValueKeys = [
  'consPeak',
  'consOffPeak',
  'injPeak',
  'injOffPeak',
  'gas',
  'batCharge',
  'batDischarge',
  'batSOC',
] as const
export type RequestableMeterValueKeys = (typeof requestableMeterValueKeys)[number]

export class MeterValues implements IMeterValues {
  /** Timestamp of the metering values capture */
  timestamp: Date
  /** consumption in tariff 1 (peak) */
  consPeak: number
  /** consumption in tariff 2 (off-peak) */
  consOffPeak: number
  /** injection in tariff 1 (peak) */
  injPeak: number
  /** injection in tariff 2 (off-peak) */
  injOffPeak: number
  /** total energy charged into the battery ever */
  batCharge: number
  /** total energy discharged from the battery ever */
  batDischarge: number
  /** gas consumption value */
  gas: number
  /** battery State-Of_Charge */
  batSOC: number
  /** indicates that the peak is being exceeded in the current quarter */
  exceedingPeak: boolean

  get consTotal() {
    return this.consOffPeak + this.consPeak
  }

  get injTotal() {
    return this.injOffPeak + this.injPeak
  }

  constructor(param?: IMeterValues | Date) {
    const now = roundTime5s(new Date())
    this.batCharge = 0
    this.batDischarge = 0
    this.consOffPeak = 0
    this.consPeak = 0
    this.gas = 0
    this.injOffPeak = 0
    this.injPeak = 0
    this.batSOC = 0
    this.exceedingPeak = false
    this.timestamp = new Date()
    if (isDate(param) || param === undefined) {
      this.timestamp = roundTime5s(param ?? now)
      return
    }
    Object.assign(this, param)
  }
}
