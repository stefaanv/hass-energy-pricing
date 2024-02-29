import { EntitySchema } from '@mikro-orm/mariadb'

export interface IBaseEntity {
  id: number
}

export const BaseEntity = new EntitySchema<IBaseEntity>({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
  },
})
