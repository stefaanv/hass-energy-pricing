import { Migration } from '@mikro-orm/migrations'

export class Migration20240304101438 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `CREATE TABLE if not exists "pricing-formula"  (
      "from" datetime NOT NULL PRIMARY KEY,
      "till" datetime NOT NULL,
      "peak" JSON NOT NULL,
      "off-peak" JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`.replaceAll(/"/g, '`'),
    )
  }
}
