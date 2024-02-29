import { EntitySchema } from '@mikro-orm/mariadb'

export interface IBaseEntity {
  id: number
  createdAt: Date
  updatedAt: Date
}

export const BaseEntity = new EntitySchema<IBaseEntity>({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    createdAt: { type: 'Date', onCreate: () => new Date(), nullable: true },
    updatedAt: {
      type: 'Date',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      nullable: true,
    },
  },
})
