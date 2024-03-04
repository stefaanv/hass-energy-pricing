import { ConsoleLogger, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { MikroORM } from '@mikro-orm/core'
import { INestApplication } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger(),
  })
  const config = app.get(ConfigService)
  const port = config.get('port', 3000)
  await app.listen(port)
  const logger = new Logger('main')
  logger.log(`hass-energy-pricing started, listening to port ${port}`)
  await updateSchema(app)
}
bootstrap()

async function updateSchema(app: INestApplication) {
  const orm = app.get(MikroORM)
  const migrator = orm.getMigrator()
  await migrator.up()
}
