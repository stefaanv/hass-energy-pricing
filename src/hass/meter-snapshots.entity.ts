import { EntitySchema } from '@mikro-orm/mariadb'
import { MeterValues } from './meter-values.model'

export const MeteringSnapshotEntity = new EntitySchema<MeterValues>({
  name: 'metering-snapshots',
  properties: {
    timestamp: { type: Date, primary: true },
    consPeak: { type: 'float' },
    consOffPeak: { type: 'float' },
    injPeak: { type: 'float' },
    injOffPeak: { type: 'float' },
    batCharge: { type: 'float' },
    batDischarge: { type: 'float' },
    batSOC: { type: 'float' },
    gas: { type: 'float' },
  },
})
