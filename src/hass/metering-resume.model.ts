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
  monthPeakValue: number
  monthPeakTime: Date
}

export const emptyResume: MeteringResume = {
  from: new Date(),
  till: new Date(),
  consumption: 0,
  injection: 0,
  batCharge: 0,
  batDischarge: 0,
  gas: 0,
  tariff: 'off-peak',
  monthPeakValue: 0,
  monthPeakTime: new Date(),
}
