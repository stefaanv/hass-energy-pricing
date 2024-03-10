import { Period } from '@src/pricing/period.model'
import { addMinutes } from 'date-fns'
import { MeterValues } from './meter-values.model'
import { Tariff } from './tariff.type'

export class MeteringResume extends Period {
  from = new Date()
  till = new Date()
  /** consumption from the grid in kWh */
  consumption = 0
  /** injection into the grid in kWh */
  injection = 0
  /** amount of energy charged into the battery in kWh */
  batCharge = 0
  /** amount of energy discharged from the battery in kWh */
  batDischarge = 0
  /** amount of gas used in kWh */
  gas = 0

  /** monthly peak was exceeded during this quarter */
  monthPeakExceeding = false
  /** metering snapshot at the at of the quarter */
  public readonly startQuarterValues: MeterValues

  constructor(
    /** metering snapshot at the at of the quarter */
    startQuarterValues: MeterValues,
    /** electricity peak/off-peak period */
    public tariff: Tariff,
    /** Size of the peak in Wh per quarter */
    public monthPeakValue: number,
    /** date and time when the omnthly peak occurred */
    public monthPeakTime: Date,
  ) {
    super()
    this.startQuarterValues = new MeterValues(startQuarterValues)
    this.tariff = tariff
    this.from = this.startQuarterValues.timestamp
    this.till = addMinutes(this.from, 15)
    this.monthPeakValue
  }

  static fromEntity(resume: MeteringResume, startQuarter: MeterValues): MeteringResume {
    const result = new MeteringResume(startQuarter, 'peak', 0, new Date())
    Object.assign(result, resume)
    return result
  }

  quarterStart() {
    this.monthPeakExceeding = false
  }

  update(current: MeterValues, logFn: (msg: string) => void) {
    const sqv = this.startQuarterValues
    this.consumption = Math.max(0, current.consTotal - this.startQuarterValues.consTotal)
    this.injection = Math.max(0, current.injTotal - this.startQuarterValues.injTotal)
    let batCharge = current.batCharge - this.startQuarterValues.batCharge
    let batDischarge = current.batDischarge - this.startQuarterValues.batDischarge
    if (isNaN(batCharge)) batCharge = 0
    if (isNaN(batDischarge)) batDischarge = 0
    this.batCharge = batCharge
    this.batDischarge = batDischarge
    this.gas = current.gas - this.startQuarterValues.gas
    this.till = current.timestamp
    if (this.consumption > this.monthPeakValue) {
      this.monthPeakExceeding = true
      logFn(`Exceeding month peak: ${this.consumption}`)
      this.monthPeakValue = this.consumption
      this.monthPeakTime = this.from
    }
  }
}
