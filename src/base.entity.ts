import { EntitySchema } from '@mikro-orm/mariadb'

export interface IdPrimKeyBaseEntity {
  id: number
}

export const IdPrimKeyBaseEntity = new EntitySchema<IdPrimKeyBaseEntity>({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
  },
})
