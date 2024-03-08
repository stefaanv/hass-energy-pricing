import { Migration } from '@mikro-orm/migrations'

export class Migration20240308154431 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE energy.metering ADD monthPeakTime TIMESTAMP DEFAULT NULL NULL;`)
    this.addSql(`ALTER TABLE energy.metering ADD monthPeakValue FLOAT DEFAULT 0 NULL;`)
  }
}
