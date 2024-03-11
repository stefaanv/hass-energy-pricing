import { Period } from '@src/pricing/period.model'
import { addMinutes, differenceInSeconds } from 'date-fns'
import { MeterValues } from './meter-values.model'
import { Tariff } from './tariff.type'
import { pick } from '@bruyland/utilities'
import { MeteringResumeEntity } from './metering-resume.entity'

export class MeteringResume extends Period {
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

  private _lastExceededReport?: Date
  private _startQuarterValues: MeterValues

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
    this._startQuarterValues = new MeterValues(startQuarterValues)
    this.tariff = tariff
    this.from = this._startQuarterValues.timestamp
    this.till = addMinutes(this.from, 15)
    this.monthPeakValue
  }

  update(current: MeterValues, logFn: (msg: string) => void) {
    const sqv = this._startQuarterValues
    this.consumption = Math.max(0, current.consTotal - this._startQuarterValues.consTotal)
    this.injection = Math.max(0, current.injTotal - this._startQuarterValues.injTotal)
    let batCharge = current.batCharge - this._startQuarterValues.batCharge
    let batDischarge = current.batDischarge - this._startQuarterValues.batDischarge
    if (isNaN(batCharge)) batCharge = 0
    if (isNaN(batDischarge)) batDischarge = 0
    this.batCharge = batCharge
    this.batDischarge = batDischarge
    this.gas = current.gas - this._startQuarterValues.gas
    this.till = current.timestamp
    if (this.consumption > this.monthPeakValue) {
      if (
        !this._lastExceededReport ||
        differenceInSeconds(new Date(), this._lastExceededReport) > 60
      ) {
        logFn(`Exceeding month peak: ${this.consumption}`)
        this._lastExceededReport = new Date()
      }
      this.monthPeakValue = this.consumption
      this.monthPeakTime = this.from
    }
  }

  newQuarter(startQuarterValues: MeterValues, tariff: Tariff, newMonth = false) {
    //TODO nog na te kijken of dit correct werkt
    this._startQuarterValues = startQuarterValues
    this.tariff = tariff
    if (newMonth) {
      this.monthPeakValue = 0
      this.monthPeakTime = startQuarterValues.timestamp
    }
  }

  toEntity() {
    const entityKeys = Object.keys(MeteringResumeEntity.meta.properties) as (keyof MeteringResume)[]
    return pick(this, entityKeys) as MeteringResume
  }

  static fromEntity(resume: MeteringResume, startQuarter: MeterValues): MeteringResume {
    const result = new MeteringResume(startQuarter, 'peak', 0, new Date())
    Object.assign(result, resume)
    return result
  }
}
