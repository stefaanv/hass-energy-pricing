import { EntitySchema } from '@mikro-orm/mariadb'
import { PriceDetail } from './spot-result.model'

export const PriceEntity = new EntitySchema<PriceDetail>({
  name: 'price',
  properties: {
    from: { type: Date, primary: true },
    till: { type: Date },
    index: { type: 'float' },
    consumption: { type: 'float' },
    injection: { type: 'float' },
    otherTotalPeak: { type: 'float' },
    otherTotalOffPeak: { type: 'float' },
    otherDetails: { type: 'json' },
  },
})
