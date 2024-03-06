import { Period } from '../period.model'

export interface PriceIndexValue extends Period {
  /** index (belpex spot) from which the prices are deduced */
  index: number
}
