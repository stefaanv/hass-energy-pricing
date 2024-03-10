import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import config from '@src/config'
import { PricingService } from './pricing/pricing.service'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { MariaDbDriver, EntityManager } from '@mikro-orm/mariadb'
import { EntityCaseNamingStrategy } from '@mikro-orm/core'
import { ScheduleModule } from '@nestjs/schedule'
import { MeteringService } from '@src/metering/metering.service'
import dbConfig from './mikro-orm.config'
import { CostService } from './pricing/cost.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
    MikroOrmModule.forRoot({ ...dbConfig, forceUndefined: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, PricingService, MeteringService, CostService],
})
export class AppModule {}

function mikroOrmConfigFactory() {
  const cfg = config()
  const dbCfg = cfg.database

  return {
    entities: ['./dist/**/*.entity.js'],
    // entitiesTs: ['./src/**/*.entity.ts'],
    forceUndefined: true,
    dbName: dbCfg.dbName,
    allowGlobalContext: true,
    registerRequestContext: false,
    host: dbCfg.host,
    user: dbCfg.user,
    password: dbCfg.password,
    driver: MariaDbDriver,
    namingStrategy: EntityCaseNamingStrategy,
    driverOptions: {
      timezone: 'Europe/Brussels',
    },
    charset: 'utf8mb4',
  }
}
