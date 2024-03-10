import { MeteringResume } from './metering-resume.model'
import { MonthPeak } from './month-peak.model'

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

  constructor(snap?: IMeterValues) {
    this.batCharge = snap ? snap.batCharge : 0
    this.batDischarge = snap ? snap.batDischarge : 0
    this.consOffPeak = snap ? snap.consOffPeak : 0
    this.consPeak = snap ? snap.consPeak : 0
    this.gas = snap ? snap.gas : 0
    this.injOffPeak = snap ? snap.injOffPeak : 0
    this.injPeak = snap ? snap.injPeak : 0
    this.batSOC = snap ? snap.batSOC : 0
    this.timestamp = snap ? snap.timestamp : new Date()
    this.exceedingPeak = false
  }

  updateResume(from: MeterValues, peak: MonthPeak) {
    const consDiff = this.consOffPeak + this.consPeak - (from.consOffPeak + from.consPeak)
    const consumption = Math.max(0, consDiff)
    const injDiff = this.injOffPeak + this.injPeak - (from.injOffPeak + from.injPeak)
    const injection = Math.max(0, injDiff)
    const tariff =
      this.consOffPeak - from.consOffPeak > this.consPeak - from.consPeak ? 'off-peak' : 'peak'
    let batCharge = this.batCharge - from.batCharge
    let batDischarge = this.batDischarge - from.batDischarge
    //TODO; nakijken of console.error weg kan
    if (isNaN(batCharge)) batCharge = 0
    if (isNaN(batDischarge)) batDischarge = 0
    peak.update(consumption, from.timestamp)
    return {
      from: from.timestamp,
      till: this.timestamp,
      tariff,
      consumption,
      injection,
      batCharge,
      batDischarge,
      gas: this.gas - from.gas,
    } as MeteringResume
  }
}
