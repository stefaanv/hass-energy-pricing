export interface DataPoint {
  st: string
  p: string
}

export interface PriceDetail {
  /** start of the time periode */
  from: Date
  /** end of the time periode */
  till: Date
  /** index (belpex spot) from which the prices are deduced */
  index: number
  /** price per kWh for consuming from the grid */
  consumption: number
  /** price per kWh for injecting into the grid */
  injection: number
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotalPeak: number
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotalOffPeak: number
  /** Object detailing the elements in the `other costs` price */
  otherDetails: Record<string, number>
}

export interface SpotResult {
  updated: string
  data: Array<DataPoint>
}
