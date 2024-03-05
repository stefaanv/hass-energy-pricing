import { Migration } from '@mikro-orm/migrations'

export class Migration20240303121757 extends Migration {
  async up(): Promise<void> {
    this.addSql(`set names utf8mb4;`)
    this.addSql(
      `CREATE TABLE "metering"  (
        "from" datetime NOT NULL PRIMARY KEY,
        "till" datetime NOT NULL,
        "consumption" float NOT NULL,
        "injection" float NOT NULL,
        "batCharge" float NOT NULL,
        "batDischarge" float NOT NULL,
        "gas" float NOT NULL,
        "tariff" enum('peak','off-peak') NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`.replaceAll(/"/g, '`'),
    )
  }
}
