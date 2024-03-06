import 'dotenv/config'
import { EntityCaseNamingStrategy, MariaDbDriver, Options } from '@mikro-orm/mariadb'
import { Migrator, TSMigrationGenerator } from '@mikro-orm/migrations'
import config from './config'
import { readdirSync } from 'fs'
import { resolve } from 'path'

const cfg = config()
const dbCfg = cfg.database
const onDev = __dirname.endsWith('dist')
const mikroOrmCli = __dirname.endsWith('src')

const options: Options = {
  entities: onDev ? ['./dist/**/*.entity.js'] : ['./**/*.entity.js'],
  entitiesTs: onDev ? ['./src/**/*.entity.ts'] : [],
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
  debug: false,
  charset: 'utf8mb4',
  extensions: [Migrator],
  migrations: {
    tableName: 'mikro_orm_migrations', // name of database table with log of executed transactions
    path: onDev ? './dist/migrations' : mikroOrmCli ? 'src/migrations' : './migrations',
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

console.log(`__dirname = ${__dirname}`)
console.log(`. = ${resolve('.')}`)
console.log(`Migrations folder = ${options.migrations?.path}`)
if (options.migrations?.path) {
  const migrations = readdirSync(options.migrations.path).filter(f => f.endsWith('.js'))
  console.log(`migrations files`)
  migrations.forEach(f => console.log('  - ' + f))
}
export default options
