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
  /** battery State-Of_Charge */
  batSOC: number
}

export const emptyMeterValues: MeterValues = {
  batCharge: 0,
  batDischarge: 0,
  consOffPeak: 0,
  consPeak: 0,
  gas: 0,
  injOffPeak: 0,
  injPeak: 0,
  batSOC: 0,
  timestamp: new Date(),
}
