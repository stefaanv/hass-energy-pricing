import 'dotenv/config'
import { EntityCaseNamingStrategy, MariaDbDriver, Options } from '@mikro-orm/mariadb'
import { Migrator, TSMigrationGenerator } from '@mikro-orm/migrations'
import config from '@src/config'
import { resolve } from 'path'

const cfg = config()
const dbCfg = cfg.database

const options: Options = {
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  forceUndefined: true,
  dbName: dbCfg.dbName,
  allowGlobalContext: true,
  host: dbCfg.host,
  user: dbCfg.user,
  password: dbCfg.password,
  driver: MariaDbDriver,
  namingStrategy: EntityCaseNamingStrategy,
  driverOptions: {
    timezone: 'Europe/Brussels',
  },
  charset: 'utf8mb4',
  extensions: [Migrator],
  migrations: {
    tableName: 'mikro_orm_migrations', // name of database table with log of executed transactions
    path: './dist/migrations',
    // glob: '!(*.d).{js,ts}', // how to match migration files (all .js and .ts files, but not .d.ts)
    transactional: true, // wrap each migration in a transaction
    disableForeignKeys: true, // wrap statements with `set foreign_key_checks = 0` or equivalent
    // allOrNothing: true, // wrap all migrations in master transaction
    dropTables: false, // allow to disable table dropping
    // safe: false, // allow to disable table and column dropping
    snapshot: true, // save snapshot when creating new migrations
    // emit: 'ts', // migration generation mode
    generator: TSMigrationGenerator, // migration generator, e.g. to allow custom formatting
  },
}

export default options
