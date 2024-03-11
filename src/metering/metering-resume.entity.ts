import { EntitySchema } from '@mikro-orm/mariadb'
import { MeteringResume } from './metering-resume.model'

export const MeteringResumeEntity = new EntitySchema<Omit<MeteringResume, 'toEntity'>>({
  name: 'metering',

  properties: {
    from: { type: 'timestamp', primary: true },
    till: { type: 'timestamp' },
    consumption: { type: 'float' },
    injection: { type: 'float' },
    batCharge: { type: 'float' },
    batDischarge: { type: 'float' },
    gas: { type: 'float' },
    tariff: { enum: true, items: () => ['peak', 'off-peak'] },
    monthPeakValue: { type: 'float' },
    monthPeakTime: { type: 'timestamp' },
  },
})
