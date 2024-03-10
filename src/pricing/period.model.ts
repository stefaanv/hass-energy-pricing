import { getEmbracingQuarter } from '@src/metering/time.helpers'

export interface IPeriod {
  /** start of the time periode */
  from: Date
  /** end of the time periode */
  till: Date
}

export class Period {
  from: Date
  till: Date

  constructor() {
    const [from, till] = getEmbracingQuarter()
    this.from = from
    this.till = till
  }
}
