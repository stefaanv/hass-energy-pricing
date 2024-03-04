export interface MeterValues {
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
}

export const emptyMeterValues: MeterValues = {
  batCharge: 0,
  batDischarge: 0,
  consOffPeak: 0,
  consPeak: 0,
  gas: 0,
  injOffPeak: 0,
  injPeak: 0,
  timestamp: new Date(),
}

export interface MeteringResume {
  /** start of the time periode */
  from: Date
  /** end of the time periode */
  till: Date
  /** consumption from the grid in kWh */
  consumption: number
  /** injection into the grid in kWh */
  injection: number
  /** amount of energy charged into the battery in kWh */
  batCharge: number
  /** amount of energy discharged from the battery in kWh */
  batDischarge: number
  /** amount of gas used in kWh */
  gas: number
  /** electricity peak/off-peak period */
  tariff: 'peak' | 'off-peak'
}
