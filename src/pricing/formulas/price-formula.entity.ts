import { EntitySchema } from '@mikro-orm/mariadb'
import { DualPriceFormulaSet } from './dual-price-formula-set.model'

export const PriceFormulaEntity = new EntitySchema<DualPriceFormulaSet>({
  name: 'PriceFormulaEntity',
  tableName: 'pricing-formula',
  properties: {
    from: { type: Date, primary: true },
    till: { type: Date },
    peak: { type: 'json' },
    'off-peak': { type: 'json' },
  },
})
