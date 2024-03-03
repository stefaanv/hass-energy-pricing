import { Migration } from '@mikro-orm/migrations'
// set foreign_key_checks = 0;
// set foreign_key_checks = 1;"

export class Migration20240303090945 extends Migration {
  async up(): Promise<void> {
    this.addSql(`set names utf8mb4;`)
    this.addSql(
      `create table if not exists "metering" (
      "from" datetime not null primary key, 
      "till" datetime not null, 
      "consumption" float not null, 
      "injection" float not null, 
      "batCharge" float not null, 
      "batDischarge" float not null, 
      "gas" float not null, 
      "tariff" enum('peak', 'off-peak') not null) 
      default character set utf8mb4 engine = InnoDB;`.replaceAll(/"/g, '`'),
    )
    this.addSql(
      `create table if not exists "price" (
      "from" datetime not null primary key, 
      "till" datetime not null, 
      "index" float not null, 
      "consumption" float not null, 
      "injection" float not null, 
      "otherTotalPeak" float not null, 
      "otherTotalOffPeak" float not null, 
      "otherDetails" json not null) 
      default character set utf8mb4 engine = InnoDB;`.replaceAll(/"/g, '`'),
    )
  }
}
