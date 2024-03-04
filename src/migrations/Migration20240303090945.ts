import { Migration } from '@mikro-orm/migrations'
// set foreign_key_checks = 0;
// set foreign_key_checks = 1;"

export class Migration20240303090945 extends Migration {
  async up(): Promise<void> {
    this.addSql(`set names utf8mb4;`)
    this.addSql(
      `create table if not exists "metering-snapshots" (
      "timestamp" datetime not null primary key, 
      "consPeak" float not null, 
      "consOffPeak" float not null, 
      "injPeak" float not null, 
      "injOffPeak" float not null, 
      "batCharge" float not null, 
      "batDischarge" float not null, 
      "gas" float not null, 
      default character set utf8mb4 engine = InnoDB;`.replaceAll(/"/g, '`'),
    )
  }
}
