import { SinglePriceFormula } from '../single-price-formula.model'

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
