import { Period } from './period.model'

export interface SinglePriceFormula {
  slope: number
  intersect?: number
}

// export const priceElementNames = ['consumption', 'injection', 'other'] as const
// export type PriceElement = (typeof priceElementNames)[number]
// export const otherPriceElementNames = [
//   'distributie',
//   'transport',
//   'groene-stroom',
//   'wkk',
//   'accijnzen',
//   'vlaamse-energiebijdrage',
//   'federale-energiebijdrage',
// ] as const
// export type OtherPriceElement = (typeof otherPriceElementNames)[number]

export interface PriceFormulaSet {
  /** formula for consuming from the grid */
  consumption: SinglePriceFormula
  /** formula for injecting into the grid */
  injection: SinglePriceFormula
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotal: number
  /** Object detailing the elements in the `other costs` price */
  otherDetails: Record<string, number>
}

export type DualPriceFormulaSet = Period & {
  peak: PriceFormulaSet
  'off-peak': Partial<PriceFormulaSet>
}

export interface PriceIndexValue extends Period {
  /** index (belpex spot) from which the prices are deduced */
  index: number
}

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
