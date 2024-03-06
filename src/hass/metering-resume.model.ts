import { Period } from '@src/pricing/period.model'

export interface MeteringResume extends Period {
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
