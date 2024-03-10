import { IPeriod } from '../period.model'
import { PriceFormulaSet } from './price-formula-set.model'

export type DualPriceFormulaSet = IPeriod & {
  peak: PriceFormulaSet
  'off-peak': Partial<PriceFormulaSet>
}
