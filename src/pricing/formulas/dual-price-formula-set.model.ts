import { Period } from '../period.model'
import { PriceFormulaSet } from './price-formula-set.model'

export type DualPriceFormulaSet = Period & {
  peak: PriceFormulaSet
  'off-peak': Partial<PriceFormulaSet>
}
