import { EntitySchema } from '@mikro-orm/mariadb'
import { BaseEntity, IBaseEntity } from '@src/base.entity'
import { PriceDetail } from './spot-result.model'

export const PriceEntity = new EntitySchema<PriceDetail, IBaseEntity>({
  name: 'price',
  extends: BaseEntity,
  properties: {
    from: { type: Date },
    till: { type: Date },
    index: { type: 'float' },
    energie: { type: 'float' },
    injectie: { type: 'float' },
    andereTotaalDag: { type: 'float' },
    andereTotaalNacht: { type: 'float' },
    andereDetail: { type: 'json' },
  },
})
