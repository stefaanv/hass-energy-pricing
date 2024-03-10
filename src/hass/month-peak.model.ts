export class MonthPeak {
  public exceededThisQuarter: boolean
  constructor(
    private _time: Date,
    private _value: number,
  ) {
    this.exceededThisQuarter = false
  }

  get time() {
    return this._time
  }
  get value() {
    return this._value
  }

  quarterStart() {
    this.exceededThisQuarter = false
  }

  update(consumption: number, quarterStart: Date) {
    if (consumption > this._value) {
      this.exceededThisQuarter = true
      this._value = consumption
      this._time = quarterStart
    }
  }
}
