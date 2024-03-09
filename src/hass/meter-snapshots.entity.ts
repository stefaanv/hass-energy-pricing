import { EntitySchema } from '@mikro-orm/mariadb'
import { IMeterValues } from './meter-values.model'

export const MeteringSnapshotEntity = new EntitySchema<IMeterValues>({
  name: 'metering-snapshots',
  properties: {
    timestamp: { type: 'timestamp', primary: true },
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
