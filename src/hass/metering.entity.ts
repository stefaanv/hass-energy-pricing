import { EntitySchema } from '@mikro-orm/mariadb'
import { MeteringResume } from './metering-resume.model'

export const MeteringEntity = new EntitySchema<MeteringResume>({
  name: 'metering',
  properties: {
    from: { type: Date, primary: true },
    till: { type: Date },
    consumption: { type: 'float' },
    injection: { type: 'float' },
    batCharge: { type: 'float' },
    batDischarge: { type: 'float' },
    gas: { type: 'float' },
    tariff: { enum: true, items: () => ['peak', 'off-peak'] },
  },
})
