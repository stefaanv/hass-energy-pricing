import { PriceIndexValue } from './index-value/index-value.model'

export interface UnitPrices {
  /** price per kWh for consuming from the grid */
  consumption: number
  /** price per kWh for injecting into the grid */
  injection: number
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotal: number
  /** Object detailing the elements in the `other costs` price */
  otherDetails: Record<string, number>
}

export type UnitPricesWithPeriod = UnitPrices & PriceIndexValue
