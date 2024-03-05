import { EntitySchema } from '@mikro-orm/mariadb'
import { PriceIndexValue } from './price-calculation.model'

export const IndexEntity = new EntitySchema<PriceIndexValue>({
  name: 'IndexEntity',
  tableName: 'index',
  properties: {
    from: { type: Date, primary: true },
    till: { type: Date },
    index: { type: 'float' },
  },
})
//
// consumption: { type: 'float' },
// injection: { type: 'float' },
// otherTotalPeak: { type: 'float' },
// otherTotalOffPeak: { type: 'float' },
// otherDetails: { type: 'json' },
