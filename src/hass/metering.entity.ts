import { EntitySchema } from '@mikro-orm/mariadb'
import { BaseEntity, IBaseEntity } from '@src/base.entity'

export const MeteringEntity = new EntitySchema<MeteringResume, IBaseEntity>({
  name: 'metering',
  extends: BaseEntity,
  properties: {
    from: { type: Date },
    till: { type: Date },
    consumption: { type: 'float' },
    injection: { type: 'float' },
    batCharge: { type: 'float' },
    batDischarge: { type: 'float' },
    gas: { type: 'float' },
    tariff: { enum: true, items: () => ['peak', 'off-peak'] },
  },
})
