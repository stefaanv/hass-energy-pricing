import { IPeriod } from '../period.model'

export interface PriceIndexValue extends IPeriod {
  /** index (belpex spot) from which the prices are deduced */
  index: number
}
