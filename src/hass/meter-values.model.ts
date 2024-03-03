interface MeterValues {
  timestamp: Date
  consPeak: number
  consOffPeak: number
  injPeak: number
  injOffPeak: number
  batCharge: number
  batDischarge: number
  gas: number
}

interface MeteringResume {
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
