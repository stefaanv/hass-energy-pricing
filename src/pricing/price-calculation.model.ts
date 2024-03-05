export interface PriceFormulaParameterSetDetail {
  slope: number
  intersect?: number
}

export type PriceFormulaParameterSet =
  | PriceFormulaParameterSetDetail
  | {
      peak: PriceFormulaParameterSetDetail
      offPeak: PriceFormulaParameterSetDetail
    }

export interface PriceFormula {
  /** start of the time periode */
  from: Date
  /** end of the time periode */
  till: Date
  /** price per kWh for consuming from the grid */
  consumption: PriceFormulaParameterSet
  /** price per kWh for injecting into the grid */
  injection: PriceFormulaParameterSet
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotalPeak: PriceFormulaParameterSet
  /** other per-kWh costs (transport, distribution, taxes) */
  otherTotalOffPeak: PriceFormulaParameterSet
  /** Object detailing the elements in the `other costs` price */
  otherDetails:
    | {
        peak: Record<string, PriceFormulaParameterSet>
        'off-peak': Record<string, PriceFormulaParameterSet>
      }
    | {
        both: Record<string, PriceFormulaParameterSet>
      }
}
